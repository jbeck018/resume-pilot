// =============================================================================
// Cover Letter Agent
// =============================================================================

import { BaseAgent } from '../core/base-agent';
import type {
	AgentConfig,
	AgentContext,
	CoverLetterAgentInput,
	CoverLetterAgentOutput,
	CompanyResearch
} from '../types';
import { WebSearchTool } from '../tools/web-search';
import { ProfileAnalyzerTool } from '../tools/profile-analyzer';
import { QualityScorerTool } from '../tools/quality-scorer';

/**
 * Cover Letter Agent
 * Generates company-aware, personalized cover letters
 */
export class CoverLetterAgent extends BaseAgent<CoverLetterAgentInput, CoverLetterAgentOutput> {
	constructor() {
		const config: AgentConfig = {
			id: 'cover-letter-agent',
			name: 'Cover Letter Generation Agent',
			description: 'Generates personalized cover letters with company research',
			defaultModel: 'gpt-4o',
			maxRetries: 2,
			timeoutMs: 60000,
			priority: 'normal'
		};

		super(config);

		// Register tools
		this.registerTool(WebSearchTool);
		this.registerTool(ProfileAnalyzerTool);
		this.registerTool(QualityScorerTool);
	}

	protected async executeInternal(
		input: CoverLetterAgentInput,
		context: AgentContext
	): Promise<CoverLetterAgentOutput> {
		const { job, profile, options } = input;

		// Step 1: Company research (if enabled)
		let companyResearch: CompanyResearch | undefined;
		if (options?.includeResearch) {
			const searchResult = await this.executeTool<
				{ query: string; type: 'company'; companyName: string },
				{ companyResearch?: CompanyResearch; summary?: string }
			>(
				'web-search',
				{
					query: `${job.company} company mission values recent news`,
					type: 'company',
					companyName: job.company
				},
				context
			);
			companyResearch = searchResult.companyResearch;
		}

		// Step 2: Analyze profile strengths
		const profileAnalysis = await this.executeTool<
			{ profile: typeof profile; targetJob: typeof job; analysisType: 'strength' },
			{ strengths: Array<{ area: string; description: string }>; keyHighlights: string[] }
		>('profile-analyzer', { profile, targetJob: job, analysisType: 'strength' }, context);

		// Step 3: Generate cover letter
		const coverLetter = await this.generateCoverLetter(
			input,
			profileAnalysis,
			companyResearch,
			context
		);

		// Step 4: Quality check
		const qualityScore = await this.executeTool<
			{ content: string; contentType: 'cover_letter'; targetJob: typeof job },
			{ overall: number; passed: boolean; suggestions: string[] }
		>(
			'quality-scorer',
			{
				content: coverLetter,
				contentType: 'cover_letter',
				targetJob: job
			},
			context
		);

		// Extract key points and customizations made
		const keyPoints = this.extractKeyPoints(coverLetter, profileAnalysis.keyHighlights);
		const customizations = this.identifyCustomizations(coverLetter, companyResearch, job);

		return {
			coverLetter,
			keyPoints,
			customizations,
			qualityScore: qualityScore.overall
		};
	}

	private async generateCoverLetter(
		input: CoverLetterAgentInput,
		analysis: { strengths: Array<{ area: string; description: string }>; keyHighlights: string[] },
		companyResearch: CompanyResearch | undefined,
		context: AgentContext
	): Promise<string> {
		const { job, profile, options } = input;

		const toneInstructions = {
			formal: 'Use a professional, formal tone throughout. Avoid contractions.',
			conversational: 'Use a warm, approachable tone while remaining professional. Light use of contractions is acceptable.',
			enthusiastic: 'Use an energetic, enthusiastic tone that conveys genuine excitement. Show passion for the opportunity.'
		};

		const tone = options?.tone || 'conversational';

		const systemPrompt = await this.getPromptWithFallback(
			'cover-letter-generation',
			{
				company_name: job.company,
				position: job.title,
				tone: tone
			},
			`You are an expert cover letter writer who creates compelling, personalized cover letters.

Guidelines:
1. ${toneInstructions[tone]}
2. Be specific to the company and role - avoid generic statements
3. Highlight 2-3 key achievements that directly relate to the position
4. Show genuine interest in the company's mission and work
5. Keep to 3-4 paragraphs (about 300-350 words)
6. Include a clear call to action in the closing
7. Never fabricate achievements or experience

Structure:
- Opening: Hook with a compelling reason for interest
- Body: 1-2 paragraphs highlighting relevant achievements
- Closing: Reiterate interest and include call to action`
		);

		const userPrompt = `# Job Details
**Position:** ${job.title}
**Company:** ${job.company}
${job.location ? `**Location:** ${job.location}` : ''}

**Job Description:**
${job.description.slice(0, 1500)}

${companyResearch ? `
# Company Research
**About ${companyResearch.name}:**
${companyResearch.description || '[Company description not available - do not fabricate]'}

${companyResearch.industry ? `**Industry:** ${companyResearch.industry}` : ''}
${companyResearch.values?.length ? `**Company Values:** ${companyResearch.values.join(', ')}` : ''}
${companyResearch.culture?.length ? `**Culture:** ${companyResearch.culture.join(', ')}` : ''}
${companyResearch.recentNews?.length ? `**Recent News:** ${companyResearch.recentNews[0]}` : ''}

NOTE: Only reference company values/culture if specific data is provided above. Do NOT fabricate company information.
` : `
# Company Research
Company research is not available. Express genuine interest in the role and company without making specific claims about company culture, values, or initiatives. Use general language like "I'm drawn to the opportunity" rather than fabricating knowledge about the company.
`}

# Candidate Profile
**Name:** ${profile.fullName}
**Current Role:** ${profile.headline || 'Professional'}

**Summary:**
${profile.summary || '[Summary not provided - focus on the experience listed below]'}

**Key Skills:** ${profile.skills.slice(0, 10).join(', ')}

**Top Achievements/Experience:**
${analysis.keyHighlights.map((h) => `- ${h}`).join('\n')}

**Recent Roles:**
${profile.experience.slice(0, 2).map((exp) => `
- ${exp.title} at ${exp.company}
  ${exp.description?.slice(0, 200) || ''}
`).join('\n')}

${options?.focusPoints?.length ? `
**Focus Points to Address:**
${options.focusPoints.map((p) => `- ${p}`).join('\n')}
` : ''}

---

Write a compelling cover letter for ${profile.fullName} applying to the ${job.title} position at ${job.company}.

Requirements:
- Address to "Hiring Manager" (no specific name available)
- Open with a strong hook showing genuine interest
- Highlight 2-3 specific achievements relevant to this role
- Reference something specific about the company (values, mission, recent work)
- Close with enthusiasm and a clear call to action
- Do NOT include a subject line or date`;

		const result = await this.generate(
			{
				model: this.config.defaultModel,
				systemPrompt,
				userPrompt,
				maxTokens: 1500,
				temperature: this.getToneTemperature(tone)
			},
			context
		);

		return this.formatCoverLetter(result.content, profile.fullName);
	}

	private getToneTemperature(tone: 'formal' | 'conversational' | 'enthusiastic'): number {
		switch (tone) {
			case 'formal':
				return 0.5;
			case 'conversational':
				return 0.7;
			case 'enthusiastic':
				return 0.8;
		}
	}

	private formatCoverLetter(content: string, name: string): string {
		// Clean up any formatting issues
		let formatted = content.trim();

		// Remove any "Subject:" or "Date:" lines that might have been added
		formatted = formatted.replace(/^(Subject|Date|RE):.*\n/gim, '');

		// Ensure proper closing signature if missing
		if (!formatted.toLowerCase().includes('sincerely') && !formatted.toLowerCase().includes('regards')) {
			formatted += `\n\nSincerely,\n${name}`;
		}

		return formatted;
	}

	private extractKeyPoints(coverLetter: string, highlights: string[]): string[] {
		const keyPoints: string[] = [];

		// Look for achievement-related sentences
		const sentences = coverLetter.split(/[.!?]+/);

		for (const sentence of sentences) {
			// Check if sentence contains quantifiable achievements
			if (/\d+%|\$\d+|\d+ (years|team|projects|clients)/i.test(sentence)) {
				keyPoints.push(sentence.trim());
			}
			// Check if it mentions specific skills or technologies
			else if (highlights.some((h) => sentence.toLowerCase().includes(h.toLowerCase().slice(0, 20)))) {
				keyPoints.push(sentence.trim());
			}
		}

		return keyPoints.slice(0, 5);
	}

	private identifyCustomizations(
		coverLetter: string,
		companyResearch: CompanyResearch | undefined,
		job: { company: string; title: string }
	): string[] {
		const customizations: string[] = [];

		// Check for company name mentions
		const companyMentions = (coverLetter.match(new RegExp(job.company, 'gi')) || []).length;
		if (companyMentions > 1) {
			customizations.push(`Referenced ${job.company} ${companyMentions} times`);
		}

		// Check for company values/culture mentions
		if (companyResearch?.values) {
			for (const value of companyResearch.values) {
				if (coverLetter.toLowerCase().includes(value.toLowerCase())) {
					customizations.push(`Aligned with company value: ${value}`);
				}
			}
		}

		// Check for role-specific mentions
		if (coverLetter.toLowerCase().includes(job.title.toLowerCase())) {
			customizations.push('Directly addressed target role');
		}

		// Check for industry-specific language
		if (companyResearch?.industry) {
			if (coverLetter.toLowerCase().includes(companyResearch.industry.toLowerCase())) {
				customizations.push(`Industry-specific language: ${companyResearch.industry}`);
			}
		}

		return customizations;
	}

	protected async validate(
		output: CoverLetterAgentOutput,
		input: CoverLetterAgentInput
	): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		// Check cover letter is not empty
		if (!output.coverLetter || output.coverLetter.length < 200) {
			errors.push('Cover letter is too short');
		}

		// Check word count (should be 200-500 words)
		const wordCount = output.coverLetter.split(/\s+/).length;
		if (wordCount < 150) {
			errors.push('Cover letter is below minimum word count');
		}
		if (wordCount > 600) {
			errors.push('Cover letter exceeds recommended length');
		}

		// Check for company mention
		if (!output.coverLetter.includes(input.job.company)) {
			errors.push('Cover letter does not mention the company name');
		}

		// Check quality score
		if (output.qualityScore < 60) {
			errors.push(`Quality score too low: ${output.qualityScore}%`);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}

// Export singleton instance
export const coverLetterAgent = new CoverLetterAgent();
