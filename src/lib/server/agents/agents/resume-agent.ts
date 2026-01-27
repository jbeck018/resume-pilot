// =============================================================================
// Resume Agent
// =============================================================================

import { BaseAgent } from '../core/base-agent';
import type {
	AgentConfig,
	AgentContext,
	ResumeAgentInput,
	ResumeAgentOutput,
	CompanyResearch,
	ExtractedSkill
} from '../types';
import { WebSearchTool } from '../tools/web-search';
import { SkillExtractorTool } from '../tools/skill-extractor';
import { ProfileAnalyzerTool } from '../tools/profile-analyzer';
import { QualityScorerTool } from '../tools/quality-scorer';

/**
 * Resume Agent
 * Multi-step resume tailoring with optional company research
 */
export class ResumeAgent extends BaseAgent<ResumeAgentInput, ResumeAgentOutput> {
	constructor() {
		const config: AgentConfig = {
			id: 'resume-agent',
			name: 'Resume Tailoring Agent',
			description: 'Tailors resumes to specific job postings with optional company research',
			defaultModel: 'claude-sonnet-4-5-20250929',
			maxRetries: 2,
			timeoutMs: 120000,
			priority: 'high'
		};

		super(config);

		// Register tools
		this.registerTool(WebSearchTool);
		this.registerTool(SkillExtractorTool);
		this.registerTool(ProfileAnalyzerTool);
		this.registerTool(QualityScorerTool);
	}

	protected async executeInternal(
		input: ResumeAgentInput,
		context: AgentContext
	): Promise<ResumeAgentOutput> {
		const { job, profile, resume, options } = input;

		// Step 1: Extract skills from job description
		const jobSkills = await this.executeTool<
			{ text: string; context: 'job_description' },
			{ skills: ExtractedSkill[]; requiredCount: number }
		>('skill-extractor', { text: job.description, context: 'job_description' }, context);

		// Step 2: Analyze profile against job
		const profileAnalysis = await this.executeTool<
			{ profile: typeof profile; targetJob: typeof job; analysisType: 'match' },
			{ matchScore: number; strengths: Array<{ area: string }>; gaps: Array<{ area: string }>; keyHighlights: string[] }
		>(
			'profile-analyzer',
			{ profile, targetJob: job, analysisType: 'match' },
			context
		);

		// Step 3: Company research (if enabled)
		let companyResearch: CompanyResearch | undefined;
		if (options?.includeResearch) {
			const searchResult = await this.executeTool<
				{ query: string; type: 'company'; companyName: string },
				{ companyResearch?: CompanyResearch }
			>(
				'web-search',
				{
					query: `${job.company} company culture values technology stack`,
					type: 'company',
					companyName: job.company
				},
				context
			);
			companyResearch = searchResult.companyResearch;
		}

		// Step 4: Generate tailored resume
		const resumeContent = await this.generateResume(
			input,
			jobSkills.skills,
			profileAnalysis,
			companyResearch,
			context
		);

		// Step 5: Quality check
		const qualityScore = await this.executeTool<
			{
				content: string;
				contentType: 'resume';
				targetJob: typeof job;
				originalProfile: { skills: string[]; experience: Array<{ title: string; company: string }> };
			},
			{ overall: number; passed: boolean; suggestions: string[] }
		>(
			'quality-scorer',
			{
				content: resumeContent,
				contentType: 'resume',
				targetJob: job,
				originalProfile: {
					skills: profile.skills,
					experience: profile.experience.map((e) => ({ title: e.title, company: e.company }))
				}
			},
			context
		);

		// If quality score is too low, regenerate with improvements
		if (!qualityScore.passed && qualityScore.suggestions.length > 0) {
			const improvedResume = await this.improveResume(
				resumeContent,
				qualityScore.suggestions,
				context
			);
			return this.buildOutput(improvedResume, jobSkills.skills, profileAnalysis, companyResearch, qualityScore.overall);
		}

		return this.buildOutput(resumeContent, jobSkills.skills, profileAnalysis, companyResearch, qualityScore.overall);
	}

	private async generateResume(
		input: ResumeAgentInput,
		jobSkills: ExtractedSkill[],
		analysis: { matchScore?: number; strengths: Array<{ area: string }>; gaps: Array<{ area: string }>; keyHighlights: string[] },
		companyResearch: CompanyResearch | undefined,
		context: AgentContext
	): Promise<string> {
		const { job, profile, resume, options } = input;

		// Build the prompt with all gathered context
		const systemPrompt = await this.getPromptWithFallback(
			'resume-generation',
			{
				company_name: job.company,
				position: job.title
			},
			`You are an expert resume writer specializing in creating highly targeted, ATS-optimized resumes.

Your task is to create a tailored resume for {{position}} at {{company_name}}.

CRITICAL RULES:
1. NEVER fabricate experience, skills, or achievements
2. Only highlight and reframe EXISTING qualifications
3. Use keywords from the job description naturally
4. Quantify achievements wherever data is available
5. Keep format clean and ATS-friendly (no tables, columns, or graphics)
6. Maximum 2 pages

Output the resume in clean markdown format.`
		);

		const requiredSkills = jobSkills.filter((s) => s.importance === 'required').map((s) => s.name);
		const preferredSkills = jobSkills.filter((s) => s.importance === 'preferred').map((s) => s.name);

		const userPrompt = `# Job Details
**Position:** ${job.title}
**Company:** ${job.company}
${job.location ? `**Location:** ${job.location}${job.isRemote ? ' (Remote)' : ''}` : ''}

**Description:**
${job.description}

**Required Skills:** ${requiredSkills.join(', ')}
**Preferred Skills:** ${preferredSkills.join(', ')}

${companyResearch ? `
# Company Research
**Industry:** ${companyResearch.industry || 'N/A'}
**Culture:** ${companyResearch.culture?.join(', ') || 'N/A'}
**Technologies:** ${companyResearch.technologies?.join(', ') || 'N/A'}
**Values:** ${companyResearch.values?.join(', ') || 'N/A'}
` : ''}

# Candidate Profile
**Name:** ${profile.fullName}
${profile.email ? `**Email:** ${profile.email}` : ''}
${profile.location ? `**Location:** ${profile.location}` : ''}
**Headline:** ${profile.headline || 'Professional'}

**Summary:**
${profile.summary || 'Not provided'}

**Skills:** ${profile.skills.join(', ')}

**Experience:**
${profile.experience.map((exp) => `
### ${exp.title} at ${exp.company}
${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || 'N/A'}
${exp.location ? `Location: ${exp.location}` : ''}
${exp.description || ''}
${exp.skills?.length ? `Technologies: ${exp.skills.join(', ')}` : ''}
`).join('\n')}

**Education:**
${profile.education.map((edu) => `
- ${edu.degree}${edu.field ? ` in ${edu.field}` : ''} - ${edu.institution}
  ${edu.startDate || ''} - ${edu.endDate || ''}
`).join('\n')}

${resume?.parsedContent ? `
**Original Resume Content:**
${resume.parsedContent.slice(0, 3000)}
` : ''}

# Analysis
**Match Score:** ${analysis.matchScore || 'N/A'}%
**Key Strengths:** ${analysis.keyHighlights.join(', ')}
**Gaps to Address:** ${analysis.gaps.map((g) => g.area).join(', ')}

${options?.focusAreas?.length ? `**Focus Areas:** ${options.focusAreas.join(', ')}` : ''}
${options?.maxLength ? `**Target Length:** ${options.maxLength === 'one_page' ? 'One page' : 'Two pages'}` : ''}

---

Create a tailored resume that:
1. Emphasizes the candidate's most relevant experience for this role
2. Incorporates required and preferred skills naturally
3. Addresses identified gaps through strategic framing
4. Highlights achievements with quantifiable results
5. Uses language and keywords from the job description`;

		const result = await this.generate(
			{
				model: this.config.defaultModel,
				systemPrompt,
				userPrompt,
				maxTokens: 4000,
				temperature: 0.5
			},
			context
		);

		return result.content;
	}

	private async improveResume(
		resume: string,
		suggestions: string[],
		context: AgentContext
	): Promise<string> {
		const prompt = `Improve this resume based on the following suggestions:

SUGGESTIONS:
${suggestions.map((s) => `- ${s}`).join('\n')}

CURRENT RESUME:
${resume}

Apply the suggestions while maintaining accuracy and professionalism. Return the improved resume in markdown format.`;

		const result = await this.generate(
			{
				model: 'claude-sonnet-4-5-20250929',
				userPrompt: prompt,
				maxTokens: 4000,
				temperature: 0.4
			},
			context
		);

		return result.content;
	}

	private buildOutput(
		resume: string,
		jobSkills: ExtractedSkill[],
		analysis: { matchScore?: number; strengths: Array<{ area: string }>; gaps: Array<{ area: string }>; keyHighlights: string[] },
		companyResearch: CompanyResearch | undefined,
		atsScore: number
	): ResumeAgentOutput {
		// Identify matched skills
		const resumeLower = resume.toLowerCase();
		const matchedSkills = jobSkills
			.filter((skill) => resumeLower.includes(skill.name.toLowerCase()))
			.map((s) => s.name);

		const missingSkills = jobSkills
			.filter((skill) => !resumeLower.includes(skill.name.toLowerCase()))
			.filter((s) => s.importance === 'required')
			.map((s) => s.name);

		return {
			resume,
			highlights: analysis.keyHighlights,
			matchedSkills,
			gaps: missingSkills,
			atsScore,
			companyResearch
		};
	}

	protected async validate(
		output: ResumeAgentOutput,
		input: ResumeAgentInput
	): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		// Check resume is not empty
		if (!output.resume || output.resume.length < 200) {
			errors.push('Resume content is too short or empty');
		}

		// Check for basic sections
		const resumeLower = output.resume.toLowerCase();
		if (!resumeLower.includes('experience') && !resumeLower.includes('work')) {
			errors.push('Resume missing experience section');
		}

		// Check that name is included
		if (!output.resume.includes(input.profile.fullName)) {
			errors.push('Resume missing candidate name');
		}

		// Check ATS score threshold
		if (output.atsScore < 50) {
			errors.push(`ATS score too low: ${output.atsScore}%`);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}

// Export singleton instance
export const resumeAgent = new ResumeAgent();
