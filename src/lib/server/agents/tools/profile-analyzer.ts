// =============================================================================
// Profile Analyzer Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult, ProfileInfo, JobInfo } from '../types';
import { complete } from '../../llm/client';

export interface ProfileAnalysisInput {
	profile: ProfileInfo;
	targetJob?: JobInfo;
	analysisType: 'strength' | 'gaps' | 'match' | 'full';
}

export interface ProfileAnalysisOutput {
	strengths: AnalysisItem[];
	weaknesses: AnalysisItem[];
	gaps: AnalysisItem[];
	matchScore?: number;
	recommendations: string[];
	keyHighlights: string[];
}

interface AnalysisItem {
	area: string;
	description: string;
	severity?: 'low' | 'medium' | 'high';
	suggestions?: string[];
}

/**
 * Profile Analyzer Tool
 * Analyzes candidate profiles for strengths, gaps, and job fit
 */
export const ProfileAnalyzerTool: ToolDefinition<ProfileAnalysisInput, ProfileAnalysisOutput> = {
	id: 'profile-analyzer',
	name: 'Profile Analyzer',
	description:
		'Analyze a candidate profile to identify strengths, weaknesses, and gaps. ' +
		'Can also calculate job fit when a target job is provided.',
	inputSchema: {
		type: 'object',
		properties: {
			profile: { type: 'object', description: 'Candidate profile to analyze' },
			targetJob: { type: 'object', description: 'Target job for match analysis (optional)' },
			analysisType: {
				type: 'string',
				enum: ['strength', 'gaps', 'match', 'full'],
				description: 'Type of analysis to perform'
			}
		},
		required: ['profile', 'analysisType']
	},

	async execute(
		input: ProfileAnalysisInput,
		context: ToolContext
	): Promise<ToolResult<ProfileAnalysisOutput>> {
		const startTime = Date.now();

		try {
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Analysis cancelled',
					durationMs: Date.now() - startTime
				};
			}

			const prompt = buildAnalysisPrompt(input);

			const result = await complete({
				model: 'gemini-1.5-flash',
				messages: [{ role: 'user', content: prompt }],
				maxTokens: 2000,
				temperature: 0.3,
				userId: context.userId,
				metadata: { purpose: 'profile-analysis' }
			});

			const analysis = parseAnalysisResult(result.content);

			return {
				success: true,
				data: analysis,
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Analysis failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

function buildAnalysisPrompt(input: ProfileAnalysisInput): string {
	const { profile, targetJob, analysisType } = input;

	const profileSummary = `
PROFILE:
Name: ${profile.fullName}
Headline: ${profile.headline || 'Not provided'}
Summary: ${profile.summary || 'Not provided'}
Skills: ${profile.skills.join(', ')}
Experience: ${profile.experience.length} positions
- ${profile.experience
		.slice(0, 3)
		.map((e) => `${e.title} at ${e.company} (${e.startDate} - ${e.current ? 'Present' : e.endDate})`)
		.join('\n- ')}
Education: ${profile.education.map((e) => `${e.degree} from ${e.institution}`).join(', ')}
`;

	const jobSummary = targetJob
		? `
TARGET JOB:
Title: ${targetJob.title}
Company: ${targetJob.company}
Description: ${targetJob.description.slice(0, 500)}...
Requirements: ${targetJob.requirements?.join(', ') || 'Not specified'}
`
		: '';

	let analysisInstructions = '';
	switch (analysisType) {
		case 'strength':
			analysisInstructions = 'Focus on identifying the candidate\'s key strengths and competitive advantages.';
			break;
		case 'gaps':
			analysisInstructions = 'Focus on identifying gaps, missing skills, and areas for improvement.';
			break;
		case 'match':
			analysisInstructions =
				'Focus on how well the candidate matches the target job requirements. Calculate a match score.';
			break;
		case 'full':
			analysisInstructions = 'Perform a comprehensive analysis covering strengths, weaknesses, gaps, and recommendations.';
			break;
	}

	return `Analyze the following candidate profile. ${analysisInstructions}

${profileSummary}
${jobSummary}

Return a JSON object with the following structure:
{
  "strengths": [
    {"area": "string", "description": "string"}
  ],
  "weaknesses": [
    {"area": "string", "description": "string", "severity": "low|medium|high", "suggestions": ["string"]}
  ],
  "gaps": [
    {"area": "string", "description": "string", "severity": "low|medium|high", "suggestions": ["string"]}
  ],
  ${targetJob ? '"matchScore": number (0-100),' : ''}
  "recommendations": ["string"],
  "keyHighlights": ["string - top 3-5 things that stand out about this candidate"]
}

Be specific and actionable in your analysis. Return ONLY the JSON object.`;
}

function parseAnalysisResult(content: string): ProfileAnalysisOutput {
	const defaultOutput: ProfileAnalysisOutput = {
		strengths: [],
		weaknesses: [],
		gaps: [],
		recommendations: [],
		keyHighlights: []
	};

	try {
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			return {
				strengths: parsed.strengths || [],
				weaknesses: parsed.weaknesses || [],
				gaps: parsed.gaps || [],
				matchScore: parsed.matchScore,
				recommendations: parsed.recommendations || [],
				keyHighlights: parsed.keyHighlights || []
			};
		}
	} catch (error) {
		console.error('Failed to parse profile analysis result:', error);
	}

	return defaultOutput;
}
