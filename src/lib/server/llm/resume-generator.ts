import { complete, selectModel, type CompletionResult } from './client';
import { checkBudget, recordUsage, getProviderFromModel, BudgetExceededError } from './budget';
import type { ExperienceItem, EducationItem } from '../database/schema';
import {
	getStyle,
	getDefaultStyle,
	buildStylePrompt,
	recommendStyleForJob,
	type ResumeStyle
} from '../resume-styles';

interface JobInfo {
	title: string;
	company: string;
	description: string;
	requirements?: string[];
}

interface ProfileInfo {
	fullName: string;
	email?: string;
	headline: string;
	summary: string;
	skills: string[];
	experience: ExperienceItem[];
	education: EducationItem[];
	linkedinUrl?: string;
	githubHandle?: string;
	portfolioUrls?: string[];
}

interface GenerationResult {
	content: string;
	model: string;
	cost: number;
	traceId?: string;
	styleId?: string;
	styleName?: string;
}

interface GenerationContext {
	userId: string;
	jobId?: string;
}

/**
 * Build a comprehensive system prompt that incorporates the style guidelines
 */
function buildStyledSystemPrompt(style: ResumeStyle): string {
	const styleInstructions = buildStylePrompt(style);

	return `You are an expert resume writer who creates highly targeted, ${style.atsOptimized ? 'ATS-optimized ' : ''}resumes. Your task is to tailor a resume specifically for a job posting while maintaining authenticity and accuracy.

${styleInstructions}

CORE GUIDELINES (NEVER VIOLATE):
1. NEVER fabricate experience or skills - only highlight and reframe existing qualifications
2. Use keywords from the job description naturally throughout the resume
3. Quantify achievements where possible (%, $, numbers)
4. Focus on relevant experience and skills for this specific role
5. Use strong action verbs and achievement-focused language
6. Maintain the candidate's authentic voice and background

OUTPUT FORMAT:
- Output the resume in clean markdown format
- Use proper heading hierarchy (# for name, ## for sections)
- Use bullet points for experience items
- Keep formatting simple for ATS compatibility
`;
}

/**
 * Build the user prompt with profile and job information
 */
function buildUserPrompt(params: {
	job: JobInfo;
	profile: ProfileInfo;
	originalResume: string;
	style: ResumeStyle;
}): string {
	const { job, profile, originalResume, style } = params;

	// Build sections based on style configuration
	const sectionOrder = style.sections
		.sort((a, b) => a.order - b.order)
		.map((s) => s.name)
		.join(' > ');

	// Format contact links based on style
	const contactLinks: string[] = [];
	if (profile.email) contactLinks.push(`Email: ${profile.email}`);
	if (profile.linkedinUrl) contactLinks.push(`LinkedIn: ${profile.linkedinUrl}`);
	if (profile.githubHandle) contactLinks.push(`GitHub: github.com/${profile.githubHandle}`);
	if (profile.portfolioUrls?.length) {
		contactLinks.push(`Portfolio: ${profile.portfolioUrls[0]}`);
	}

	return `# Job Details
**Position:** ${job.title}
**Company:** ${job.company}

**Job Description:**
${job.description}

${job.requirements?.length ? `**Key Requirements:**\n${job.requirements.map((r) => `- ${r}`).join('\n')}` : ''}

# Candidate Profile
**Name:** ${profile.fullName}
**Current Role:** ${profile.headline}
${contactLinks.length ? `**Contact/Links:** ${contactLinks.join(' | ')}` : ''}

**Summary:**
${profile.summary}

**Skills:**
${profile.skills.join(', ')}

**Experience:**
${profile.experience
	.map(
		(exp) => `
### ${exp.title} at ${exp.company}
${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || 'N/A'}
${exp.location || ''}
${exp.description || ''}
${exp.skills?.length ? `Technologies: ${exp.skills.join(', ')}` : ''}
`
	)
	.join('\n')}

**Education:**
${profile.education
	.map(
		(edu) => `
- ${edu.degree}${edu.field ? ` in ${edu.field}` : ''} - ${edu.institution}
  ${edu.startDate || ''} - ${edu.endDate || ''}
  ${edu.gpa ? `GPA: ${edu.gpa}` : ''}
`
	)
	.join('\n')}

${originalResume ? `**Original Resume Content (for additional context):**\n${originalResume}` : ''}

---

**SECTION ORDER FOR THIS STYLE:** ${sectionOrder}

Please create a tailored resume for the ${job.title} position at ${job.company}.
Follow the "${style.name}" style guidelines provided above.
Highlight the most relevant experience and skills while maintaining accuracy.`;
}

/**
 * Generate a tailored resume using a specific style
 */
export async function generateTailoredResume(params: {
	job: JobInfo;
	profile: ProfileInfo;
	originalResume: string;
	context: GenerationContext;
	styleId?: string;
}): Promise<GenerationResult> {
	const { job, profile, originalResume, context, styleId } = params;

	// Check budget before making LLM call
	const budgetCheck = await checkBudget(context.userId);
	if (!budgetCheck.allowed) {
		throw new BudgetExceededError(budgetCheck);
	}

	// Determine the style to use
	let style: ResumeStyle;
	let usedStyleId: string;

	if (styleId) {
		// Use specified style
		const specifiedStyle = getStyle(styleId);
		if (specifiedStyle) {
			style = specifiedStyle;
			usedStyleId = styleId;
		} else {
			// Fallback to recommendation if invalid style ID
			usedStyleId = recommendStyleForJob({
				jobTitle: job.title,
				company: job.company,
				experienceYears: calculateExperienceYears(profile.experience)
			});
			style = getStyle(usedStyleId) || getDefaultStyle();
		}
	} else {
		// Auto-recommend style based on job
		usedStyleId = recommendStyleForJob({
			jobTitle: job.title,
			company: job.company,
			experienceYears: calculateExperienceYears(profile.experience)
		});
		style = getStyle(usedStyleId) || getDefaultStyle();
	}

	const model = selectModel('resume');
	const systemPrompt = buildStyledSystemPrompt(style);
	const userPrompt = buildUserPrompt({ job, profile, originalResume, style });

	const result = await complete({
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt }
		],
		maxTokens: style.layout.maxPages > 2 ? 6000 : 4000,
		temperature: 0.5,
		userId: context.userId,
		jobId: context.jobId,
		metadata: {
			purpose: 'resume',
			styleId: usedStyleId,
			styleName: style.name
		}
	});

	// Record usage for tracking
	await recordUsage({
		userId: context.userId,
		model: result.model,
		provider: getProviderFromModel(result.model),
		promptTokens: result.usage.promptTokens,
		completionTokens: result.usage.completionTokens,
		totalTokens: result.usage.totalTokens,
		costCents: result.cost,
		purpose: 'resume',
		jobId: context.jobId,
		traceId: result.traceId,
		cached: result.cached
	});

	return {
		content: result.content,
		model: result.model,
		cost: result.cost,
		traceId: result.traceId,
		styleId: usedStyleId,
		styleName: style.name
	};
}

/**
 * Generate a cover letter
 */
export async function generateCoverLetter(params: {
	job: { title: string; company: string; description: string };
	profile: {
		fullName: string;
		headline: string;
		summary: string;
		skills: string[];
		experience: ExperienceItem[];
	};
	context: GenerationContext;
}): Promise<GenerationResult> {
	const { job, profile, context } = params;

	// Check budget before making LLM call
	const budgetCheck = await checkBudget(context.userId);
	if (!budgetCheck.allowed) {
		throw new BudgetExceededError(budgetCheck);
	}

	const model = selectModel('cover_letter');

	const systemPrompt = `You are an expert cover letter writer who creates compelling, personalized cover letters.

## TRUTHFULNESS REQUIREMENTS (MANDATORY)
1. NEVER fabricate achievements, experiences, or skills not provided in the candidate profile
2. ONLY reference accomplishments that appear in the provided experience data
3. If company information is limited, express genuine interest without making specific claims about company culture or values
4. Use phrases like "I'm drawn to the opportunity" rather than fabricating specific company knowledge
5. When highlighting achievements, use ONLY those explicitly described in the profile

## STYLE GUIDELINES
1. Conversational yet professional tone
2. Specific to the company and role - but only using verified information
3. Highlight 2-3 key relevant achievements FROM THE PROVIDED PROFILE
4. Show genuine interest without fabricating specific company knowledge
5. Keep to 3-4 paragraphs (about 300 words)
6. Avoid clichés and generic phrases

## WHEN DATA IS LIMITED
- If the candidate profile lacks specific achievements, focus on skills and experience areas
- If company information is unavailable, express interest in the role and industry generally
- Use language like "Based on my background in..." rather than making specific unverified claims

Output a clean cover letter ready to send.`;

	const userPrompt = `# Job Details
**Position:** ${job.title}
**Company:** ${job.company}

**Job Description:**
${job.description}

# Candidate Profile
**Name:** ${profile.fullName}
**Current Role:** ${profile.headline}

**Summary:**
${profile.summary}

**Key Skills:**
${profile.skills.slice(0, 10).join(', ')}

**Recent Experience:**
${profile.experience
	.slice(0, 2)
	.map(
		(exp) => `
- ${exp.title} at ${exp.company}: ${exp.description?.slice(0, 200) || 'N/A'}
`
	)
	.join('')}

---

Write a compelling cover letter for ${profile.fullName} applying to the ${job.title} position at ${job.company}.`;

	const result = await complete({
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt }
		],
		maxTokens: 1500,
		temperature: 0.7,
		userId: context.userId,
		jobId: context.jobId,
		metadata: { purpose: 'cover_letter' }
	});

	// Record usage for tracking
	await recordUsage({
		userId: context.userId,
		model: result.model,
		provider: getProviderFromModel(result.model),
		promptTokens: result.usage.promptTokens,
		completionTokens: result.usage.completionTokens,
		totalTokens: result.usage.totalTokens,
		costCents: result.cost,
		purpose: 'cover_letter',
		jobId: context.jobId,
		traceId: result.traceId,
		cached: result.cached
	});

	return {
		content: result.content,
		model: result.model,
		cost: result.cost,
		traceId: result.traceId
	};
}

/**
 * Generate a professional summary for a profile
 */
export async function generateProfileSummary(params: {
	experience: ExperienceItem[];
	skills: string[];
	education: EducationItem[];
	context: GenerationContext;
}): Promise<GenerationResult> {
	const { experience, skills, education, context } = params;

	// Check budget before making LLM call
	const budgetCheck = await checkBudget(context.userId);
	if (!budgetCheck.allowed) {
		throw new BudgetExceededError(budgetCheck);
	}

	const model = selectModel('summary');

	const prompt = `Based on the following professional profile, write a 2-3 sentence professional summary.

## TRUTHFULNESS REQUIREMENTS
- ONLY use information explicitly provided below
- Do NOT invent years of experience, specific achievements, or skills not listed
- If information is limited, keep the summary appropriately brief
- Use hedging language when generalizing: "Experienced professional" rather than specific unverified claims

## PROVIDED PROFILE DATA
Experience:
${experience
	.slice(0, 3)
	.map((e) => `- ${e.title} at ${e.company}${e.description ? `: ${e.description.slice(0, 100)}` : ''}`)
	.join('\n')}

Skills: ${skills.slice(0, 10).join(', ')}

Education: ${education.map((e) => `${e.degree} from ${e.institution}`).join(', ')}

## INSTRUCTIONS
Write a concise, impactful professional summary that:
1. Accurately reflects ONLY the provided experience and skills
2. Does NOT add specific metrics, years, or achievements not in the data
3. Uses strong language while remaining truthful to the source material

Write only the summary text.`;

	const result = await complete({
		model,
		messages: [{ role: 'user', content: prompt }],
		maxTokens: 300,
		temperature: 0.6,
		userId: context.userId,
		metadata: { purpose: 'summary' }
	});

	// Record usage for tracking
	await recordUsage({
		userId: context.userId,
		model: result.model,
		provider: getProviderFromModel(result.model),
		promptTokens: result.usage.promptTokens,
		completionTokens: result.usage.completionTokens,
		totalTokens: result.usage.totalTokens,
		costCents: result.cost,
		purpose: 'summary',
		traceId: result.traceId,
		cached: result.cached
	});

	return {
		content: result.content,
		model: result.model,
		cost: result.cost,
		traceId: result.traceId
	};
}

/**
 * Helper function to calculate years of experience from experience items
 */
function calculateExperienceYears(experience: ExperienceItem[]): number {
	if (!experience || experience.length === 0) return 0;

	// Find the earliest start date
	let earliestStart: Date | null = null;

	for (const exp of experience) {
		if (exp.startDate) {
			const start = parseDate(exp.startDate);
			if (start && (!earliestStart || start < earliestStart)) {
				earliestStart = start;
			}
		}
	}

	if (!earliestStart) return 0;

	const now = new Date();
	const years = (now.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24 * 365);
	return Math.floor(years);
}

/**
 * Parse a date string in various formats
 */
function parseDate(dateStr: string): Date | null {
	if (!dateStr) return null;

	// Try ISO format first
	let date = new Date(dateStr);
	if (!isNaN(date.getTime())) return date;

	// Try "Month Year" format (e.g., "January 2020")
	const monthYear = dateStr.match(/^(\w+)\s+(\d{4})$/);
	if (monthYear) {
		date = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
		if (!isNaN(date.getTime())) return date;
	}

	// Try "MM/YYYY" format
	const slashFormat = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
	if (slashFormat) {
		date = new Date(parseInt(slashFormat[2]), parseInt(slashFormat[1]) - 1, 1);
		if (!isNaN(date.getTime())) return date;
	}

	// Try year only
	const yearOnly = dateStr.match(/^(\d{4})$/);
	if (yearOnly) {
		return new Date(parseInt(yearOnly[1]), 0, 1);
	}

	return null;
}

// Re-export style utilities for convenience
export {
	getStyle,
	getDefaultStyle,
	recommendStyleForJob,
	type ResumeStyle
} from '../resume-styles';
