// =============================================================================
// Content Reframer Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult } from '../types';
import { complete } from '../../llm/client';
import type { ReframingStrategyType, ReframingStrategy } from '../types/confidence';

// -----------------------------------------------------------------------------
// Input/Output Types
// -----------------------------------------------------------------------------

export interface JobContext {
	/** Target job title */
	title: string;
	/** Target company name */
	company: string;
	/** Industry of the target job */
	industry?: string;
	/** Keywords from the job description to align with */
	keywords?: string[];
}

export interface ContentReframeInput {
	/** Original content from candidate's profile */
	originalContent: string;
	/** The specific job requirement to align with */
	targetRequirement: string;
	/** Reframing strategy to apply */
	strategy: ReframingStrategyType;
	/** Job context for better alignment */
	jobContext: JobContext;
}

export interface ContentReframeOutput {
	/** Reframed content that better aligns with the requirement */
	reframedContent: string;
	/** Explanation of what meaning was preserved */
	preservedMeaning: string;
	/** List of elements that were adapted */
	adaptedElements: string[];
	/** Confidence score (0-100) - below 50 indicates content couldn't be truthfully reframed */
	confidence: number;
	/** Strategy that was applied */
	strategyApplied: ReframingStrategyType;
	/** Whether the content was returned unchanged */
	unchanged: boolean;
	/** Reason if content was returned unchanged */
	unchangedReason?: string;
}

// -----------------------------------------------------------------------------
// Strategy Descriptions
// -----------------------------------------------------------------------------

const STRATEGY_DESCRIPTIONS: Record<ReframingStrategyType, string> = {
	keyword_alignment:
		'Preserve the core meaning but adjust terminology to match job posting language. ' +
		'Example: "Led experimental design" -> "Led data science programs"',
	emphasis_shift:
		'Keep all facts the same but shift the focus to different aspects. ' +
		'Example: Focus on business outcomes instead of technical methods.',
	abstraction_adjust:
		'Adjust the level of technical specificity - make more general or more specific as needed. ' +
		'Example: "Built MATLAB-based system" -> "Developed automated evaluation system"',
	scale_emphasis:
		'Highlight the relevant scale aspects of the achievement. ' +
		'Example: "Managed project with 3 stakeholders" -> "Led cross-functional initiative"'
};

// -----------------------------------------------------------------------------
// Tool Definition
// -----------------------------------------------------------------------------

/**
 * Content Reframer Tool
 * Reframes candidate content to better match job requirements while preserving truthfulness.
 * NEVER fabricates or exaggerates - only adjusts framing, emphasis, and terminology.
 */
export const ContentReframerTool: ToolDefinition<ContentReframeInput, ContentReframeOutput> = {
	id: 'content-reframer',
	name: 'Content Reframer',
	description:
		'Reframe candidate content to better align with job requirements while strictly ' +
		'preserving truthfulness. Supports keyword alignment, emphasis shifting, ' +
		'abstraction adjustment, and scale emphasis strategies.',
	inputSchema: {
		type: 'object',
		properties: {
			originalContent: {
				type: 'string',
				description: 'Original content from candidate profile to reframe'
			},
			targetRequirement: {
				type: 'string',
				description: 'The job requirement to align the content with'
			},
			strategy: {
				type: 'string',
				enum: ['keyword_alignment', 'emphasis_shift', 'abstraction_adjust', 'scale_emphasis'],
				description: 'Reframing strategy to apply'
			},
			jobContext: {
				type: 'object',
				description: 'Context about the target job',
				properties: {
					title: { type: 'string', description: 'Job title' },
					company: { type: 'string', description: 'Company name' },
					industry: { type: 'string', description: 'Industry' },
					keywords: {
						type: 'array',
						items: { type: 'string' },
						description: 'Keywords from job description'
					}
				},
				required: ['title', 'company']
			}
		},
		required: ['originalContent', 'targetRequirement', 'strategy', 'jobContext']
	},

	async execute(
		input: ContentReframeInput,
		context: ToolContext
	): Promise<ToolResult<ContentReframeOutput>> {
		const startTime = Date.now();

		try {
			// Check for abort
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Reframing cancelled',
					durationMs: Date.now() - startTime
				};
			}

			// Validate input
			if (!input.originalContent.trim()) {
				return {
					success: false,
					error: 'Original content cannot be empty',
					durationMs: Date.now() - startTime
				};
			}

			const prompt = buildReframingPrompt(input);

			const result = await complete({
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: prompt }],
				maxTokens: 1000,
				temperature: 0.3, // Low temperature for consistent, truthful reframing
				userId: context.userId,
				metadata: { purpose: 'content-reframing', strategy: input.strategy }
			});

			const parsed = parseReframingResult(result.content, input);

			return {
				success: true,
				data: parsed,
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Reframing failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

// -----------------------------------------------------------------------------
// Prompt Building
// -----------------------------------------------------------------------------

function buildReframingPrompt(input: ContentReframeInput): string {
	const { originalContent, targetRequirement, strategy, jobContext } = input;
	const strategyDescription = STRATEGY_DESCRIPTIONS[strategy];

	const keywordsList = jobContext.keywords?.length
		? `\nRELEVANT KEYWORDS: ${jobContext.keywords.join(', ')}`
		: '';

	return `You are a professional resume content reframer. Your task is to reframe the candidate's content to better align with a job requirement.

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:
1. NEVER fabricate or exaggerate any claims
2. NEVER add skills, experiences, or achievements not present in the original content
3. NEVER change factual claims (numbers, dates, titles, companies)
4. ONLY adjust framing, emphasis, and terminology
5. Preserve ALL factual claims from the original
6. If the original content CANNOT be truthfully reframed to align with the requirement, return it UNCHANGED with confidence below 50

ORIGINAL CONTENT:
"${originalContent}"

TARGET JOB REQUIREMENT:
"${targetRequirement}"

JOB CONTEXT:
- Position: ${jobContext.title} at ${jobContext.company}
${jobContext.industry ? `- Industry: ${jobContext.industry}` : ''}${keywordsList}

REFRAMING STRATEGY: ${strategy}
${strategyDescription}

Analyze whether the original content can be truthfully reframed to better align with the requirement using the ${strategy} strategy.

Return a JSON object with this exact structure:
{
  "reframedContent": "the reframed content (or original if unchanged)",
  "preservedMeaning": "explanation of what core meaning/facts were preserved",
  "adaptedElements": ["list", "of", "elements", "that", "were", "adapted"],
  "confidence": <number 0-100>,
  "unchanged": <true if content couldn't be truthfully reframed, false otherwise>,
  "unchangedReason": "reason if unchanged (optional)"
}

CONFIDENCE SCORING:
- 90-100: Strong alignment possible with truthful reframing
- 70-89: Good alignment with minor adaptations
- 50-69: Moderate alignment, some stretching of framing
- Below 50: Cannot truthfully reframe - return unchanged

Return ONLY the JSON object, no other text.`;
}

// -----------------------------------------------------------------------------
// Result Parsing
// -----------------------------------------------------------------------------

interface ReframingJsonResult {
	reframedContent?: string;
	preservedMeaning?: string;
	adaptedElements?: string[];
	confidence?: number;
	unchanged?: boolean;
	unchangedReason?: string;
}

function parseReframingResult(content: string, input: ContentReframeInput): ContentReframeOutput {
	try {
		// Try to find JSON in response
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]) as ReframingJsonResult;

			// Validate and sanitize the parsed result
			const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 50;
			const unchanged = parsed.unchanged === true || confidence < 50;

			return {
				reframedContent: unchanged
					? input.originalContent
					: (parsed.reframedContent || input.originalContent),
				preservedMeaning: parsed.preservedMeaning || 'Core meaning preserved',
				adaptedElements: Array.isArray(parsed.adaptedElements) ? parsed.adaptedElements : [],
				confidence: Math.max(0, Math.min(100, confidence)),
				strategyApplied: input.strategy,
				unchanged,
				unchangedReason: unchanged
					? (parsed.unchangedReason || 'Content could not be truthfully reframed')
					: undefined
			};
		}
	} catch (error) {
		console.error('Failed to parse reframing result:', error);
	}

	// Fallback: return original content unchanged
	return {
		reframedContent: input.originalContent,
		preservedMeaning: 'Unable to parse reframing result',
		adaptedElements: [],
		confidence: 0,
		strategyApplied: input.strategy,
		unchanged: true,
		unchangedReason: 'Failed to parse AI response'
	};
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Get a human-readable description of a reframing strategy
 */
export function getStrategyDescription(strategy: ReframingStrategyType): string {
	return STRATEGY_DESCRIPTIONS[strategy];
}

/**
 * Suggest the best reframing strategy based on content and requirement analysis
 */
export function suggestStrategy(
	originalContent: string,
	targetRequirement: string
): ReframingStrategyType {
	const contentLower = originalContent.toLowerCase();
	const requirementLower = targetRequirement.toLowerCase();

	// Check for scale-related keywords in requirement
	const scaleKeywords = ['led', 'managed', 'scale', 'team', 'cross-functional', 'enterprise'];
	if (scaleKeywords.some((kw) => requirementLower.includes(kw))) {
		return 'scale_emphasis';
	}

	// Check for outcome/results focus in requirement
	const outcomeKeywords = ['improved', 'increased', 'reduced', 'delivered', 'achieved', 'impact'];
	if (outcomeKeywords.some((kw) => requirementLower.includes(kw))) {
		return 'emphasis_shift';
	}

	// Check if content is very technical but requirement is general
	const technicalTerms = ['implemented', 'built', 'developed', 'coded', 'engineered'];
	const generalTerms = ['experience with', 'knowledge of', 'familiar with', 'understanding'];
	if (
		technicalTerms.some((t) => contentLower.includes(t)) &&
		generalTerms.some((t) => requirementLower.includes(t))
	) {
		return 'abstraction_adjust';
	}

	// Default to keyword alignment
	return 'keyword_alignment';
}
