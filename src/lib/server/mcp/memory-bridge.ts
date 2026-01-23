// =============================================================================
// Memory Bridge for Claude-Flow Pattern Learning
// =============================================================================
// Provides high-level APIs for storing and retrieving patterns from the
// claude-flow memory system. Enables learning from successful resume generations.

import { callMCPTool, isMCPEnabled } from './client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * A learned pattern from successful resume generation
 */
export interface GenerationPattern {
	/** Unique pattern identifier */
	id: string;
	/** Pattern type */
	type: 'resume' | 'cover_letter' | 'job_match';
	/** Job industry/domain */
	industry?: string;
	/** Job title pattern */
	titlePattern?: string;
	/** Key skills that led to success */
	relevantSkills: string[];
	/** Successful prompt strategies */
	promptStrategies: string[];
	/** ATS score achieved */
	atsScore?: number;
	/** Match score achieved */
	matchScore?: number;
	/** User feedback */
	feedback?: 'positive' | 'negative' | 'neutral';
	/** Creation timestamp */
	createdAt: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Agent execution record for learning
 */
export interface AgentExecutionRecord {
	/** Execution ID */
	executionId: string;
	/** Agent type */
	agentType: string;
	/** Input summary */
	inputSummary: {
		jobTitle: string;
		company: string;
		industry?: string;
		keySkills: string[];
	};
	/** Output quality metrics */
	outputMetrics: {
		atsScore?: number;
		matchScore?: number;
		qualityScore?: number;
		tokensUsed: number;
		durationMs: number;
		costCents: number;
	};
	/** Whether execution was successful */
	success: boolean;
	/** Error if failed */
	error?: string;
	/** User feedback if available */
	userFeedback?: 'positive' | 'negative' | 'neutral';
	/** Timestamp */
	timestamp: string;
}

/**
 * Similar pattern search result
 */
export interface SimilarPattern {
	/** The pattern */
	pattern: GenerationPattern;
	/** Similarity score (0-1) */
	similarity: number;
	/** Why it matched */
	matchReasons: string[];
}

// -----------------------------------------------------------------------------
// Pattern Storage
// -----------------------------------------------------------------------------

/**
 * Store a successful generation pattern for future learning
 */
export async function storePattern(pattern: GenerationPattern): Promise<boolean> {
	if (!isMCPEnabled()) {
		console.debug('[MemoryBridge] MCP not enabled, skipping pattern storage');
		return false;
	}

	try {
		const result = await callMCPTool<{
			key: string;
			value: string;
			namespace?: string;
			metadata?: Record<string, unknown>;
		}, { success: boolean }>('memory_store', {
			key: `pattern:${pattern.type}:${pattern.id}`,
			value: JSON.stringify(pattern),
			namespace: 'resume-pilot-patterns',
			metadata: {
				type: pattern.type,
				industry: pattern.industry,
				atsScore: pattern.atsScore,
				matchScore: pattern.matchScore,
				feedback: pattern.feedback,
				createdAt: pattern.createdAt
			}
		});

		return result?.success ?? false;
	} catch (error) {
		console.error('[MemoryBridge] Failed to store pattern:', error);
		return false;
	}
}

/**
 * Find patterns similar to a job description
 */
export async function findSimilarPatterns(
	jobDescription: string,
	options?: {
		type?: 'resume' | 'cover_letter' | 'job_match';
		industry?: string;
		limit?: number;
		minScore?: number;
	}
): Promise<SimilarPattern[]> {
	if (!isMCPEnabled()) {
		return [];
	}

	const { type, industry, limit = 5, minScore = 0.5 } = options || {};

	try {
		// Use claude-flow's vector search capability
		const result = await callMCPTool<{
			query: string;
			namespace?: string;
			limit?: number;
			threshold?: number;
		}, {
			results: Array<{
				key: string;
				value: string;
				score: number;
				metadata?: Record<string, unknown>;
			}>;
		}>('memory_search', {
			query: buildSearchQuery(jobDescription, { type, industry }),
			namespace: 'resume-pilot-patterns',
			limit,
			threshold: minScore
		});

		if (!result?.results) {
			return [];
		}

		return result.results
			.map((r) => {
				try {
					const pattern = JSON.parse(r.value) as GenerationPattern;
					return {
						pattern,
						similarity: r.score,
						matchReasons: extractMatchReasons(pattern, jobDescription)
					};
				} catch {
					return null;
				}
			})
			.filter((p): p is SimilarPattern => p !== null);
	} catch (error) {
		console.error('[MemoryBridge] Failed to search patterns:', error);
		return [];
	}
}

/**
 * Get patterns by type with optional filters
 */
export async function getPatternsByType(
	type: 'resume' | 'cover_letter' | 'job_match',
	filters?: {
		industry?: string;
		minAtsScore?: number;
		minMatchScore?: number;
		feedback?: 'positive' | 'negative' | 'neutral';
		limit?: number;
	}
): Promise<GenerationPattern[]> {
	if (!isMCPEnabled()) {
		return [];
	}

	try {
		const result = await callMCPTool<{
			namespace?: string;
			limit?: number;
		}, {
			entries: Array<{
				key: string;
				value: string;
				metadata?: Record<string, unknown>;
			}>;
		}>('memory_list', {
			namespace: 'resume-pilot-patterns',
			limit: filters?.limit || 50
		});

		if (!result?.entries) {
			return [];
		}

		return result.entries
			.map((e) => {
				try {
					return JSON.parse(e.value) as GenerationPattern;
				} catch {
					return null;
				}
			})
			.filter((p): p is GenerationPattern => {
				if (!p) return false;
				if (p.type !== type) return false;
				if (filters?.industry && p.industry !== filters.industry) return false;
				if (filters?.minAtsScore && (p.atsScore ?? 0) < filters.minAtsScore) return false;
				if (filters?.minMatchScore && (p.matchScore ?? 0) < filters.minMatchScore) return false;
				if (filters?.feedback && p.feedback !== filters.feedback) return false;
				return true;
			});
	} catch (error) {
		console.error('[MemoryBridge] Failed to get patterns:', error);
		return [];
	}
}

// -----------------------------------------------------------------------------
// Agent Execution Tracking
// -----------------------------------------------------------------------------

/**
 * Store an agent execution record for learning
 */
export async function storeAgentExecution(record: AgentExecutionRecord): Promise<boolean> {
	if (!isMCPEnabled()) {
		return false;
	}

	try {
		const result = await callMCPTool<{
			key: string;
			value: string;
			namespace?: string;
			metadata?: Record<string, unknown>;
		}, { success: boolean }>('memory_store', {
			key: `execution:${record.agentType}:${record.executionId}`,
			value: JSON.stringify(record),
			namespace: 'resume-pilot-executions',
			metadata: {
				agentType: record.agentType,
				success: record.success,
				atsScore: record.outputMetrics.atsScore,
				matchScore: record.outputMetrics.matchScore,
				costCents: record.outputMetrics.costCents,
				timestamp: record.timestamp
			}
		});

		return result?.success ?? false;
	} catch (error) {
		console.error('[MemoryBridge] Failed to store execution:', error);
		return false;
	}
}

/**
 * Get agent execution statistics
 */
export async function getAgentStats(
	agentType: string,
	timeRangeMs?: number
): Promise<{
	totalExecutions: number;
	successRate: number;
	avgAtsScore: number;
	avgMatchScore: number;
	avgCostCents: number;
	avgDurationMs: number;
} | null> {
	if (!isMCPEnabled()) {
		return null;
	}

	try {
		const result = await callMCPTool<{
			namespace?: string;
			limit?: number;
		}, {
			entries: Array<{
				key: string;
				value: string;
				metadata?: Record<string, unknown>;
			}>;
		}>('memory_list', {
			namespace: 'resume-pilot-executions',
			limit: 100
		});

		if (!result?.entries) {
			return null;
		}

		const cutoffTime = timeRangeMs ? Date.now() - timeRangeMs : 0;

		const executions = result.entries
			.map((e) => {
				try {
					return JSON.parse(e.value) as AgentExecutionRecord;
				} catch {
					return null;
				}
			})
			.filter((e): e is AgentExecutionRecord => {
				if (!e) return false;
				if (e.agentType !== agentType) return false;
				if (cutoffTime && new Date(e.timestamp).getTime() < cutoffTime) return false;
				return true;
			});

		if (executions.length === 0) {
			return null;
		}

		const successCount = executions.filter((e) => e.success).length;
		const atsScores = executions.map((e) => e.outputMetrics.atsScore).filter((s): s is number => s !== undefined);
		const matchScores = executions.map((e) => e.outputMetrics.matchScore).filter((s): s is number => s !== undefined);

		return {
			totalExecutions: executions.length,
			successRate: successCount / executions.length,
			avgAtsScore: atsScores.length > 0 ? atsScores.reduce((a, b) => a + b, 0) / atsScores.length : 0,
			avgMatchScore: matchScores.length > 0 ? matchScores.reduce((a, b) => a + b, 0) / matchScores.length : 0,
			avgCostCents: executions.reduce((sum, e) => sum + e.outputMetrics.costCents, 0) / executions.length,
			avgDurationMs: executions.reduce((sum, e) => sum + e.outputMetrics.durationMs, 0) / executions.length
		};
	} catch (error) {
		console.error('[MemoryBridge] Failed to get agent stats:', error);
		return null;
	}
}

// -----------------------------------------------------------------------------
// Pattern Learning Hooks
// -----------------------------------------------------------------------------

/**
 * Learn from a successful resume generation
 * Call this after generating a resume that receives positive feedback
 */
export async function learnFromSuccess(params: {
	jobTitle: string;
	company: string;
	industry?: string;
	jobDescription: string;
	skills: string[];
	atsScore: number;
	matchScore: number;
	generationStrategy: {
		promptVersion?: string;
		includeResearch: boolean;
		focusAreas?: string[];
	};
}): Promise<void> {
	const pattern: GenerationPattern = {
		id: generatePatternId(),
		type: 'resume',
		industry: params.industry,
		titlePattern: extractTitlePattern(params.jobTitle),
		relevantSkills: params.skills.slice(0, 10), // Top 10 skills
		promptStrategies: buildPromptStrategies(params.generationStrategy),
		atsScore: params.atsScore,
		matchScore: params.matchScore,
		feedback: 'positive',
		createdAt: new Date().toISOString(),
		metadata: {
			company: params.company,
			originalTitle: params.jobTitle,
			includeResearch: params.generationStrategy.includeResearch,
			focusAreas: params.generationStrategy.focusAreas
		}
	};

	await storePattern(pattern);

	// Also notify claude-flow hooks for neural pattern training
	await callMCPTool('hooks_post-task', {
		taskId: pattern.id,
		success: true,
		quality: Math.min(params.atsScore, params.matchScore) / 100
	});
}

/**
 * Record negative feedback for learning
 */
export async function learnFromFailure(params: {
	jobTitle: string;
	company: string;
	industry?: string;
	error?: string;
	feedback?: string;
}): Promise<void> {
	const pattern: GenerationPattern = {
		id: generatePatternId(),
		type: 'resume',
		industry: params.industry,
		titlePattern: extractTitlePattern(params.jobTitle),
		relevantSkills: [],
		promptStrategies: [],
		feedback: 'negative',
		createdAt: new Date().toISOString(),
		metadata: {
			company: params.company,
			originalTitle: params.jobTitle,
			error: params.error,
			userFeedback: params.feedback
		}
	};

	await storePattern(pattern);

	// Notify claude-flow hooks
	await callMCPTool('hooks_post-task', {
		taskId: pattern.id,
		success: false
	});
}

// -----------------------------------------------------------------------------
// Recommendation Engine
// -----------------------------------------------------------------------------

/**
 * Get recommendations for generating a resume based on similar past successes
 */
export async function getGenerationRecommendations(params: {
	jobTitle: string;
	jobDescription: string;
	industry?: string;
	skills: string[];
}): Promise<{
	recommendedStrategies: string[];
	relevantSkillsToHighlight: string[];
	estimatedAtsScore: number;
	estimatedMatchScore: number;
	confidenceLevel: 'high' | 'medium' | 'low';
}> {
	const similarPatterns = await findSimilarPatterns(params.jobDescription, {
		type: 'resume',
		industry: params.industry,
		limit: 5,
		minScore: 0.6
	});

	if (similarPatterns.length === 0) {
		return {
			recommendedStrategies: ['Use standard ATS optimization', 'Include all relevant skills'],
			relevantSkillsToHighlight: params.skills.slice(0, 5),
			estimatedAtsScore: 70,
			estimatedMatchScore: 65,
			confidenceLevel: 'low'
		};
	}

	// Aggregate insights from similar patterns
	const allStrategies = similarPatterns.flatMap((p) => p.pattern.promptStrategies);
	const allSkills = similarPatterns.flatMap((p) => p.pattern.relevantSkills);

	// Count strategy frequency
	const strategyCount = new Map<string, number>();
	for (const strategy of allStrategies) {
		strategyCount.set(strategy, (strategyCount.get(strategy) || 0) + 1);
	}

	// Count skill frequency
	const skillCount = new Map<string, number>();
	for (const skill of allSkills) {
		skillCount.set(skill, (skillCount.get(skill) || 0) + 1);
	}

	// Get top strategies and skills
	const topStrategies = Array.from(strategyCount.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([s]) => s);

	const topSkills = Array.from(skillCount.entries())
		.filter(([skill]) => params.skills.includes(skill))
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([s]) => s);

	// Calculate average scores from similar patterns
	const avgAtsScore = similarPatterns.reduce((sum, p) => sum + (p.pattern.atsScore || 70), 0) / similarPatterns.length;
	const avgMatchScore = similarPatterns.reduce((sum, p) => sum + (p.pattern.matchScore || 65), 0) / similarPatterns.length;

	// Determine confidence based on similarity scores
	const avgSimilarity = similarPatterns.reduce((sum, p) => sum + p.similarity, 0) / similarPatterns.length;
	const confidenceLevel = avgSimilarity > 0.8 ? 'high' : avgSimilarity > 0.6 ? 'medium' : 'low';

	return {
		recommendedStrategies: topStrategies.length > 0 ? topStrategies : ['Use standard ATS optimization'],
		relevantSkillsToHighlight: topSkills.length > 0 ? topSkills : params.skills.slice(0, 5),
		estimatedAtsScore: Math.round(avgAtsScore),
		estimatedMatchScore: Math.round(avgMatchScore),
		confidenceLevel
	};
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function generatePatternId(): string {
	return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractTitlePattern(title: string): string {
	// Normalize title for pattern matching
	return title
		.toLowerCase()
		.replace(/\b(senior|junior|lead|staff|principal|sr|jr)\b/gi, '[level]')
		.replace(/\b(i|ii|iii|1|2|3)\b$/gi, '[tier]')
		.trim();
}

function buildPromptStrategies(strategy: {
	promptVersion?: string;
	includeResearch: boolean;
	focusAreas?: string[];
}): string[] {
	const strategies: string[] = [];

	if (strategy.includeResearch) {
		strategies.push('company_research');
	}

	if (strategy.focusAreas?.length) {
		strategies.push(`focus:${strategy.focusAreas.join(',')}`);
	}

	if (strategy.promptVersion) {
		strategies.push(`prompt_v${strategy.promptVersion}`);
	}

	return strategies;
}

function buildSearchQuery(
	jobDescription: string,
	options: { type?: string; industry?: string }
): string {
	const parts: string[] = [];

	// Extract key phrases from job description
	const keyPhrases = jobDescription
		.slice(0, 500) // Limit to first 500 chars
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 3)
		.slice(0, 20);

	parts.push(keyPhrases.join(' '));

	if (options.type) {
		parts.push(`type:${options.type}`);
	}

	if (options.industry) {
		parts.push(`industry:${options.industry}`);
	}

	return parts.join(' ');
}

function extractMatchReasons(pattern: GenerationPattern, jobDescription: string): string[] {
	const reasons: string[] = [];
	const descLower = jobDescription.toLowerCase();

	// Check skill matches
	const matchedSkills = pattern.relevantSkills.filter((s) => descLower.includes(s.toLowerCase()));
	if (matchedSkills.length > 0) {
		reasons.push(`Matched skills: ${matchedSkills.slice(0, 3).join(', ')}`);
	}

	// Check industry match
	if (pattern.industry && descLower.includes(pattern.industry.toLowerCase())) {
		reasons.push(`Same industry: ${pattern.industry}`);
	}

	// Check title pattern match
	if (pattern.titlePattern) {
		const normalizedTitle = extractTitlePattern(jobDescription.slice(0, 100));
		if (normalizedTitle.includes(pattern.titlePattern.replace('[level]', '').replace('[tier]', '').trim())) {
			reasons.push('Similar role type');
		}
	}

	// Check ATS score
	if (pattern.atsScore && pattern.atsScore > 85) {
		reasons.push(`High ATS score: ${pattern.atsScore}%`);
	}

	return reasons.length > 0 ? reasons : ['Similar context'];
}
