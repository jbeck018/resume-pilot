// =============================================================================
// Profile Agent
// =============================================================================

import { BaseAgent } from '../core/base-agent';
import type {
	AgentConfig,
	AgentContext,
	ProfileAgentInput,
	ProfileAgentOutput
} from '../types';
import { ProfileAnalyzerTool } from '../tools/profile-analyzer';
import { SkillExtractorTool } from '../tools/skill-extractor';
import { ContentGeneratorTool } from '../tools/content-generator';

/**
 * Profile Agent
 * Analyzes and enhances candidate profiles
 */
export class ProfileAgent extends BaseAgent<ProfileAgentInput, ProfileAgentOutput> {
	constructor() {
		const config: AgentConfig = {
			id: 'profile-agent',
			name: 'Profile Enhancement Agent',
			description: 'Analyzes profiles and suggests improvements',
			defaultModel: 'claude-3-haiku-20240307',
			maxRetries: 2,
			timeoutMs: 45000,
			priority: 'low'
		};

		super(config);

		// Register tools
		this.registerTool(ProfileAnalyzerTool);
		this.registerTool(SkillExtractorTool);
		this.registerTool(ContentGeneratorTool);
	}

	protected async executeInternal(
		input: ProfileAgentInput,
		context: AgentContext
	): Promise<ProfileAgentOutput> {
		const { profile, resume, targetRoles } = input;

		// Step 1: Analyze current profile
		const analysis = await this.executeTool<
			{ profile: typeof profile; analysisType: 'full' },
			{
				strengths: Array<{ area: string; description: string }>;
				weaknesses: Array<{ area: string; description: string; suggestions?: string[] }>;
				gaps: Array<{ area: string; description: string }>;
				recommendations: string[];
				keyHighlights: string[];
			}
		>('profile-analyzer', { profile, analysisType: 'full' }, context);

		// Step 2: Extract skills from experience descriptions
		const experienceText = profile.experience
			.map((e) => `${e.title} at ${e.company}: ${e.description || ''} ${e.skills?.join(', ') || ''}`)
			.join('\n');

		const extractedSkills = await this.executeTool<
			{ text: string; context: 'profile' },
			{ skills: Array<{ name: string; category: string }> }
		>('skill-extractor', { text: experienceText, context: 'profile' }, context);

		// Step 3: Generate enhanced summary
		const enhancedSummary = await this.generateEnhancedSummary(profile, targetRoles, context);

		// Step 4: Generate headline suggestions
		const headlineSuggestions = await this.generateHeadlineSuggestions(profile, targetRoles, context);

		// Step 5: Suggest skills based on experience
		const suggestedSkills = this.findMissingSkills(profile.skills, extractedSkills.skills);

		// Step 6: Generate experience enhancements
		const experienceEnhancements = await this.generateExperienceEnhancements(
			profile.experience,
			targetRoles,
			context
		);

		// Step 7: Calculate profile strength
		const profileStrength = this.calculateProfileStrength(profile, analysis);

		// Step 8: Compile recommendations
		const recommendations = this.compileRecommendations(
			analysis,
			suggestedSkills,
			profileStrength
		);

		return {
			enhancedSummary,
			headlineSuggestions,
			suggestedSkills,
			experienceEnhancements,
			profileStrength,
			recommendations
		};
	}

	private async generateEnhancedSummary(
		profile: ProfileAgentInput['profile'],
		targetRoles: string[] | undefined,
		context: AgentContext
	): Promise<string> {
		const prompt = `Write an enhanced professional summary based ONLY on the provided information.

## TRUTHFULNESS REQUIREMENTS (MANDATORY)
- ONLY use information explicitly provided below
- Do NOT invent years of experience unless calculable from the experience dates
- Do NOT add specific achievements or skills not listed
- If information is limited, keep the summary appropriately brief
- Use hedging language when generalizing: "Experienced professional" rather than specific unverified claims

## PROVIDED PROFILE DATA
NAME: ${profile.fullName}
CURRENT HEADLINE: ${profile.headline || '[Not provided]'}
CURRENT SUMMARY: ${profile.summary || '[Not provided]'}
KEY SKILLS: ${profile.skills.slice(0, 10).join(', ')}
EXPERIENCE: ${profile.experience.slice(0, 3).map((e) => `${e.title} at ${e.company}`).join(', ')}
${targetRoles?.length ? `TARGET ROLES: ${targetRoles.join(', ')}` : ''}

## GUIDELINES
- 2-3 impactful sentences
- Reference skills and experience ONLY from the data above
- Use active voice and strong verbs
- End with a value proposition based on demonstrated expertise

Write only the summary, no labels or explanations.`;

		const result = await this.generate(
			{
				model: this.config.defaultModel,
				userPrompt: prompt,
				maxTokens: 300,
				temperature: 0.6
			},
			context
		);

		return result.content.trim();
	}

	private async generateHeadlineSuggestions(
		profile: ProfileAgentInput['profile'],
		targetRoles: string[] | undefined,
		context: AgentContext
	): Promise<string[]> {
		const prompt = `Generate 3 professional headline options for LinkedIn/resume:

CURRENT: ${profile.headline || 'No headline'}
EXPERIENCE: ${profile.experience.slice(0, 2).map((e) => e.title).join(', ')}
SKILLS: ${profile.skills.slice(0, 8).join(', ')}
${targetRoles?.length ? `TARGETING: ${targetRoles.join(', ')}` : ''}

Guidelines:
- Max 120 characters each
- Include key skills/technologies
- Be specific, avoid generic titles
- Can include current company or status (e.g., "Open to opportunities")

Return 3 headlines, one per line, no numbers or bullets.`;

		const result = await this.generate(
			{
				model: 'gemini-1.5-flash',
				userPrompt: prompt,
				maxTokens: 200,
				temperature: 0.8
			},
			context
		);

		return result.content
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 10 && line.length < 150)
			.slice(0, 3);
	}

	private findMissingSkills(
		currentSkills: string[],
		extractedSkills: Array<{ name: string; category: string }>
	): string[] {
		const currentSkillsLower = new Set(currentSkills.map((s) => s.toLowerCase()));

		const suggestions: string[] = [];

		for (const skill of extractedSkills) {
			const skillLower = skill.name.toLowerCase();
			if (!currentSkillsLower.has(skillLower)) {
				// Check if it's not just a variation
				const isVariation = Array.from(currentSkillsLower).some(
					(cs) => cs.includes(skillLower) || skillLower.includes(cs)
				);
				if (!isVariation) {
					suggestions.push(skill.name);
				}
			}
		}

		// Remove duplicates and return top suggestions
		return [...new Set(suggestions)].slice(0, 10);
	}

	private async generateExperienceEnhancements(
		experience: ProfileAgentInput['profile']['experience'],
		targetRoles: string[] | undefined,
		context: AgentContext
	): Promise<Array<{ original: string; enhanced: string; reason: string }>> {
		const enhancements: Array<{ original: string; enhanced: string; reason: string }> = [];

		// Only enhance the top 3 most recent experiences
		const recentExperience = experience.slice(0, 3);

		for (const exp of recentExperience) {
			if (!exp.description || exp.description.length < 50) continue;

			const prompt = `Improve the clarity and impact of this job description while maintaining COMPLETE ACCURACY.

## CRITICAL: TRUTHFULNESS REQUIREMENTS
- You may ONLY rephrase and restructure the provided information
- Do NOT add metrics, numbers, percentages, or statistics not in the original
- Do NOT invent team sizes, revenue figures, or performance improvements
- Do NOT assume technologies, methodologies, or processes not mentioned
- If no quantifiable results exist, describe impact qualitatively

## WHAT YOU CAN DO
- Use stronger action verbs (e.g., "handled" -> "managed", "helped" -> "contributed to")
- Restructure sentences for clarity
- Highlight implicit skills that are directly evident from the description
- Improve readability and flow

## ORIGINAL DESCRIPTION
Role: ${exp.title} at ${exp.company}
Description: ${exp.description.slice(0, 300)}

${targetRoles?.length ? `Context: Candidate is targeting ${targetRoles.join(', ')} roles` : ''}

## OUTPUT FORMAT
Return JSON:
{
  "enhanced": "improved description using ONLY information from the original",
  "reason": "brief explanation of improvements made (must not include any fabricated data)"
}

IMPORTANT: If the original lacks detail, your enhanced version should also be appropriately brief. Do NOT pad with fabricated information.`;

			try {
				const result = await this.generate(
					{
						model: 'gemini-1.5-flash',
						userPrompt: prompt,
						maxTokens: 300,
						temperature: 0.5
					},
					context
				);

				const jsonMatch = result.content.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					const parsed = JSON.parse(jsonMatch[0]);
					enhancements.push({
						original: exp.description.slice(0, 200),
						enhanced: parsed.enhanced,
						reason: parsed.reason
					});
				}
			} catch (error) {
				console.error('Failed to enhance experience:', error);
			}
		}

		return enhancements;
	}

	private calculateProfileStrength(
		profile: ProfileAgentInput['profile'],
		analysis: {
			strengths: Array<{ area: string }>;
			weaknesses: Array<{ area: string }>;
			gaps: Array<{ area: string }>;
		}
	): number {
		let score = 50; // Base score

		// Completeness checks
		if (profile.summary && profile.summary.length > 50) score += 10;
		if (profile.headline && profile.headline.length > 10) score += 5;
		if (profile.skills.length >= 5) score += 10;
		if (profile.skills.length >= 10) score += 5;
		if (profile.experience.length >= 2) score += 10;
		if (profile.education.length >= 1) score += 5;
		if (profile.linkedinUrl) score += 3;
		if (profile.githubHandle) score += 2;

		// Quality checks from analysis
		score += Math.min(analysis.strengths.length * 3, 15);
		score -= Math.min(analysis.weaknesses.length * 2, 10);
		score -= Math.min(analysis.gaps.length * 3, 15);

		// Experience descriptions
		const hasDescriptions = profile.experience.filter((e) => e.description && e.description.length > 50).length;
		score += Math.min(hasDescriptions * 3, 10);

		return Math.max(0, Math.min(100, score));
	}

	private compileRecommendations(
		analysis: {
			weaknesses: Array<{ area: string; suggestions?: string[] }>;
			gaps: Array<{ area: string }>;
			recommendations: string[];
		},
		suggestedSkills: string[],
		profileStrength: number
	): string[] {
		const recommendations: string[] = [];

		// Add analysis recommendations
		recommendations.push(...analysis.recommendations.slice(0, 3));

		// Add skill suggestions
		if (suggestedSkills.length > 0) {
			recommendations.push(
				`Consider adding these skills based on your experience: ${suggestedSkills.slice(0, 5).join(', ')}`
			);
		}

		// Add weakness-based recommendations
		for (const weakness of analysis.weaknesses.slice(0, 2)) {
			if (weakness.suggestions && weakness.suggestions.length > 0) {
				recommendations.push(weakness.suggestions[0]);
			}
		}

		// Profile strength-based recommendations
		if (profileStrength < 50) {
			recommendations.push('Focus on completing your profile with a detailed summary and skills list');
		} else if (profileStrength < 70) {
			recommendations.push('Add quantifiable achievements to your experience descriptions');
		} else if (profileStrength < 85) {
			recommendations.push('Consider adding portfolio links or certifications to stand out');
		}

		// Remove duplicates and limit
		return [...new Set(recommendations)].slice(0, 8);
	}

	protected async validate(
		output: ProfileAgentOutput
	): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		// Check enhanced summary
		if (!output.enhancedSummary || output.enhancedSummary.length < 50) {
			errors.push('Enhanced summary is too short or empty');
		}

		// Check headline suggestions
		if (output.headlineSuggestions.length === 0) {
			errors.push('No headline suggestions generated');
		}

		// Check profile strength is reasonable
		if (output.profileStrength < 0 || output.profileStrength > 100) {
			errors.push('Profile strength score is out of range');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}

// Export singleton instance
export const profileAgent = new ProfileAgent();
