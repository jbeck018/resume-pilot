// =============================================================================
// Confidence Scorer Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult, JobInfo } from '../types';
import type {
	ConfidenceScore,
	ConfidenceTier,
	ContentSource,
	ReframingStrategy,
	ReframingStrategyType
} from '../types/confidence';
import { complete } from '../../llm/client';

export interface ConfidenceScorerInput {
	/** The job requirement text to match against */
	requirement: string;
	/** Content sources from the candidate's profile */
	candidateContent: ContentSource[];
	/** Job context for better matching */
	jobContext: {
		title: string;
		company: string;
		industry?: string;
		keywords?: string[];
	};
}

export interface ConfidenceScorerOutput {
	/** The computed confidence score with breakdown */
	score: ConfidenceScore;
	/** Best matching source content */
	bestMatch: ContentSource | null;
	/** Suggested reframing strategy if score is in 'adjacent' or 'weak' tier */
	reframingStrategy?: ReframingStrategy;
	/** Explanation of the scoring rationale */
	rationale: string;
}

/**
 * Confidence Scorer Tool
 * Scores how well candidate content matches a job requirement using a
 * weighted multi-factor model:
 * - Direct keyword match: 40% weight
 * - Transferable skills: 30% weight
 * - Adjacent experience: 20% weight
 * - Impact alignment: 10% weight
 */
export const ConfidenceScorerTool: ToolDefinition<ConfidenceScorerInput, ConfidenceScorerOutput> = {
	id: 'confidence-scorer',
	name: 'Confidence Scorer',
	description:
		'Score how well candidate content matches a job requirement. ' +
		'Uses a weighted multi-factor model to determine match confidence ' +
		'and suggests reframing strategies for weaker matches.',
	inputSchema: {
		type: 'object',
		properties: {
			requirement: { type: 'string', description: 'Job requirement text to match against' },
			candidateContent: {
				type: 'array',
				description: 'Content sources from candidate profile',
				items: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							enum: ['experience', 'skill', 'project', 'education', 'certification']
						},
						id: { type: 'string' },
						originalText: { type: 'string' },
						relevanceScore: { type: 'number' }
					}
				}
			},
			jobContext: {
				type: 'object',
				properties: {
					title: { type: 'string' },
					company: { type: 'string' },
					industry: { type: 'string' },
					keywords: { type: 'array', items: { type: 'string' } }
				}
			}
		},
		required: ['requirement', 'candidateContent', 'jobContext']
	},

	async execute(
		input: ConfidenceScorerInput,
		context: ToolContext
	): Promise<ToolResult<ConfidenceScorerOutput>> {
		const startTime = Date.now();

		try {
			// Check for abort
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Scoring cancelled',
					durationMs: Date.now() - startTime
				};
			}

			// Handle empty candidate content
			if (input.candidateContent.length === 0) {
				return {
					success: true,
					data: {
						score: createGapScore(),
						bestMatch: null,
						rationale: 'No candidate content available to match against this requirement.'
					},
					durationMs: Date.now() - startTime
				};
			}

			const prompt = buildScoringPrompt(input);

			const result = await complete({
				model: 'gemini-1.5-flash',
				messages: [{ role: 'user', content: prompt }],
				maxTokens: 2000,
				temperature: 0.2,
				userId: context.userId,
				metadata: { purpose: 'confidence-scoring' }
			});

			const parsed = parseScoringResult(result.content, input.candidateContent);

			return {
				success: true,
				data: parsed,
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Scoring failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

/**
 * Build the prompt for the AI to analyze the match
 */
function buildScoringPrompt(input: ConfidenceScorerInput): string {
	const contentSummary = input.candidateContent
		.map((c, i) => `[${i + 1}] (${c.type}) ${c.originalText}`)
		.join('\n');

	return `You are an expert resume optimization specialist. Analyze how well the candidate's content matches the job requirement.

JOB REQUIREMENT:
"${input.requirement}"

JOB CONTEXT:
- Title: ${input.jobContext.title}
- Company: ${input.jobContext.company}
${input.jobContext.industry ? `- Industry: ${input.jobContext.industry}` : ''}
${input.jobContext.keywords?.length ? `- Key terms: ${input.jobContext.keywords.join(', ')}` : ''}

CANDIDATE CONTENT:
${contentSummary}

Score each dimension from 0-100:

1. KEYWORD MATCH (40% weight): How directly do keywords, terminology, and specific skills match?
   - 90-100: Exact or near-exact keyword matches
   - 70-89: Similar terminology that clearly relates
   - 50-69: Loosely related terms
   - 0-49: No meaningful keyword overlap

2. TRANSFERABLE SKILLS (30% weight): How well do the underlying skills transfer?
   - 90-100: Skills directly transfer with no adaptation needed
   - 70-89: Skills transfer with minor reframing
   - 50-69: Skills partially transfer, some gaps exist
   - 0-49: Skills don't meaningfully transfer

3. ADJACENT EXPERIENCE (20% weight): How related is the experience context?
   - 90-100: Same or very similar domain/context
   - 70-89: Related domain with clear parallels
   - 50-69: Different domain but applicable patterns
   - 0-49: Unrelated experience context

4. IMPACT ALIGNMENT (10% weight): Do the results/outcomes align with what's needed?
   - 90-100: Demonstrated impact directly relevant to requirement
   - 70-89: Impact shows relevant capabilities
   - 50-69: Impact partially relevant
   - 0-49: Impact not relevant to requirement

Return ONLY a JSON object with this structure:
{
  "breakdown": {
    "keyword": <number 0-100>,
    "transferable": <number 0-100>,
    "adjacent": <number 0-100>,
    "impact": <number 0-100>
  },
  "bestMatchIndex": <0-based index of best matching content, or -1 if none>,
  "rationale": "<2-3 sentence explanation of the scoring>",
  "reframingStrategy": {
    "needed": <boolean>,
    "type": "<keyword_alignment|emphasis_shift|abstraction_adjust|scale_emphasis>",
    "suggestion": "<how to reframe the content if needed>"
  }
}`;
}

/**
 * Parse the AI response and compute the final confidence score
 */
function parseScoringResult(
	content: string,
	candidateContent: ContentSource[]
): ConfidenceScorerOutput {
	try {
		// Extract JSON from response
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error('No JSON found in response');
		}

		const parsed = JSON.parse(jsonMatch[0]) as {
			breakdown: {
				keyword: number;
				transferable: number;
				adjacent: number;
				impact: number;
			};
			bestMatchIndex: number;
			rationale: string;
			reframingStrategy?: {
				needed: boolean;
				type: string;
				suggestion: string;
			};
		};

		// Validate and clamp scores to 0-100
		const breakdown = {
			keyword: clampScore(parsed.breakdown.keyword),
			transferable: clampScore(parsed.breakdown.transferable),
			adjacent: clampScore(parsed.breakdown.adjacent),
			impact: clampScore(parsed.breakdown.impact)
		};

		// Calculate weighted overall score
		const overall = Math.round(
			breakdown.keyword * 0.4 +
				breakdown.transferable * 0.3 +
				breakdown.adjacent * 0.2 +
				breakdown.impact * 0.1
		);

		// Determine tier based on overall score
		const tier = determineTier(overall);

		const score: ConfidenceScore = {
			overall,
			tier,
			breakdown
		};

		// Get best match
		const bestMatchIndex = parsed.bestMatchIndex;
		const bestMatch =
			bestMatchIndex >= 0 && bestMatchIndex < candidateContent.length
				? candidateContent[bestMatchIndex]
				: null;

		// Build reframing strategy if needed
		let reframingStrategy: ReframingStrategy | undefined;
		if (
			parsed.reframingStrategy?.needed &&
			(tier === 'adjacent' || tier === 'weak') &&
			bestMatch
		) {
			reframingStrategy = {
				type: validateReframingType(parsed.reframingStrategy.type),
				originalText: bestMatch.originalText,
				reframedText: '', // Will be filled by content generator
				preservedMeaning: extractCoreMeaning(bestMatch.originalText),
				adaptedElements: [parsed.reframingStrategy.suggestion]
			};
		}

		return {
			score,
			bestMatch,
			reframingStrategy,
			rationale: parsed.rationale || 'Unable to determine match rationale.'
		};
	} catch (error) {
		console.error('Failed to parse confidence scoring result:', error);

		// Return a conservative gap score on parse failure
		return {
			score: createGapScore(),
			bestMatch: null,
			rationale: 'Failed to analyze content match. Treating as unmatched requirement.'
		};
	}
}

/**
 * Determine the confidence tier based on overall score
 */
function determineTier(overall: number): ConfidenceTier {
	if (overall >= 90) return 'direct';
	if (overall >= 75) return 'transferable';
	if (overall >= 60) return 'adjacent';
	if (overall >= 45) return 'weak';
	return 'gap';
}

/**
 * Create a gap score for cases with no match
 */
function createGapScore(): ConfidenceScore {
	return {
		overall: 0,
		tier: 'gap',
		breakdown: {
			keyword: 0,
			transferable: 0,
			adjacent: 0,
			impact: 0
		}
	};
}

/**
 * Clamp a score to the valid 0-100 range
 */
function clampScore(score: number): number {
	return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Validate and normalize the reframing strategy type
 */
function validateReframingType(type: string): ReframingStrategyType {
	const validTypes: ReframingStrategyType[] = [
		'keyword_alignment',
		'emphasis_shift',
		'abstraction_adjust',
		'scale_emphasis'
	];

	const normalized = type.toLowerCase().replace(/\s+/g, '_') as ReframingStrategyType;
	return validTypes.includes(normalized) ? normalized : 'emphasis_shift';
}

/**
 * Extract the core meaning from original text for preservation during reframing
 */
function extractCoreMeaning(text: string): string {
	// For now, return a truncated version as the core meaning
	// In a more sophisticated implementation, this would use NLP
	const maxLength = 100;
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + '...';
}
