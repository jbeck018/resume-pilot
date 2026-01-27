// =============================================================================
// Swarm Coordinator for Claude-Flow Integration
// =============================================================================
// Provides high-level APIs for coordinating multi-agent operations using
// claude-flow's swarm capabilities. Enables parallel job matching and
// consensus-based quality checking.

import { callMCPTool, isMCPEnabled } from './client';
import type { JobInfo, ProfileInfo } from '../agents/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SwarmConfig {
	/** Swarm topology type */
	topology: 'hierarchical' | 'mesh' | 'hierarchical-mesh' | 'star';
	/** Maximum concurrent agents */
	maxAgents: number;
	/** Agent strategy */
	strategy: 'specialized' | 'balanced' | 'adaptive';
	/** Consensus algorithm for quality checks */
	consensusAlgorithm?: 'raft' | 'byzantine' | 'gossip';
}

export interface SwarmStatus {
	/** Whether swarm is initialized */
	initialized: boolean;
	/** Active agent count */
	activeAgents: number;
	/** Pending tasks */
	pendingTasks: number;
	/** Completed tasks */
	completedTasks: number;
	/** Current topology */
	topology?: string;
	/** Health status */
	health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface BatchMatchResult {
	/** Job being matched */
	job: JobInfo;
	/** Match score (0-100) */
	matchScore: number;
	/** Score breakdown */
	breakdown: {
		skills: number;
		experience: number;
		education: number;
		location: number;
	};
	/** Match reasons */
	reasons: string[];
	/** Processing time in ms */
	processingTimeMs: number;
}

export interface ConsensusResult {
	/** Final verdict */
	verdict: 'approved' | 'rejected' | 'needs_revision';
	/** Confidence score (0-1) */
	confidence: number;
	/** Number of agents that voted */
	voterCount: number;
	/** Individual votes */
	votes: Array<{
		agentId: string;
		vote: 'approve' | 'reject' | 'revise';
		score: number;
		feedback: string;
	}>;
	/** Aggregated feedback */
	aggregatedFeedback: string[];
	/** Recommendations */
	recommendations: string[];
}

// -----------------------------------------------------------------------------
// Swarm Initialization
// -----------------------------------------------------------------------------

/**
 * Initialize a swarm for complex operations
 */
export async function initializeSwarm(config: Partial<SwarmConfig> = {}): Promise<boolean> {
	if (!isMCPEnabled()) {
		return false;
	}

	const effectiveConfig: SwarmConfig = {
		topology: config.topology || 'hierarchical',
		maxAgents: config.maxAgents || 8,
		strategy: config.strategy || 'specialized',
		consensusAlgorithm: config.consensusAlgorithm || 'raft'
	};

	try {
		const result = await callMCPTool<{
			topology?: string;
			maxAgents?: number;
			strategy?: string;
			config?: Record<string, unknown>;
		}, { success: boolean; swarmId?: string }>('swarm_init', {
			topology: effectiveConfig.topology,
			maxAgents: effectiveConfig.maxAgents,
			strategy: effectiveConfig.strategy,
			config: {
				consensusAlgorithm: effectiveConfig.consensusAlgorithm,
				purpose: 'howlerhire'
			}
		});

		return result?.success ?? false;
	} catch (error) {
		console.error('[SwarmCoordinator] Failed to initialize swarm:', error);
		return false;
	}
}

/**
 * Get current swarm status
 */
export async function getSwarmStatus(): Promise<SwarmStatus> {
	if (!isMCPEnabled()) {
		return {
			initialized: false,
			activeAgents: 0,
			pendingTasks: 0,
			completedTasks: 0,
			health: 'unhealthy'
		};
	}

	try {
		const result = await callMCPTool<{}, {
			status?: string;
			activeAgents?: number;
			pendingTasks?: number;
			completedTasks?: number;
			topology?: string;
			health?: string;
		}>('swarm_status', {});

		return {
			initialized: result?.status === 'active' || result?.status === 'running',
			activeAgents: result?.activeAgents ?? 0,
			pendingTasks: result?.pendingTasks ?? 0,
			completedTasks: result?.completedTasks ?? 0,
			topology: result?.topology,
			health: (result?.health as 'healthy' | 'degraded' | 'unhealthy') ?? 'unhealthy'
		};
	} catch (error) {
		console.error('[SwarmCoordinator] Failed to get swarm status:', error);
		return {
			initialized: false,
			activeAgents: 0,
			pendingTasks: 0,
			completedTasks: 0,
			health: 'unhealthy'
		};
	}
}

/**
 * Shutdown the swarm
 */
export async function shutdownSwarm(graceful: boolean = true): Promise<boolean> {
	if (!isMCPEnabled()) {
		return true;
	}

	try {
		const result = await callMCPTool<{ graceful?: boolean }, { success: boolean }>('swarm_shutdown', {
			graceful
		});

		return result?.success ?? false;
	} catch (error) {
		console.error('[SwarmCoordinator] Failed to shutdown swarm:', error);
		return false;
	}
}

// -----------------------------------------------------------------------------
// Batch Job Matching
// -----------------------------------------------------------------------------

/**
 * Coordinate parallel job matching using swarm agents
 * More efficient than sequential matching for large job batches
 */
export async function coordinateBatchMatching(
	jobs: JobInfo[],
	profile: ProfileInfo,
	options?: {
		minScore?: number;
		maxConcurrency?: number;
		timeoutMs?: number;
	}
): Promise<BatchMatchResult[]> {
	if (!isMCPEnabled() || jobs.length === 0) {
		return [];
	}

	const { minScore = 50, maxConcurrency = 5, timeoutMs = 60000 } = options || {};

	// Ensure swarm is initialized
	const status = await getSwarmStatus();
	if (!status.initialized) {
		const initialized = await initializeSwarm({
			topology: 'hierarchical',
			maxAgents: maxConcurrency,
			strategy: 'specialized'
		});

		if (!initialized) {
			// Swarm not available, falling back to sequential matching
			return [];
		}
	}

	try {
		// Create batch task using swarm orchestration
		const result = await callMCPTool<{
			task: string;
			agents?: string[];
			strategy?: string;
			timeout?: number;
		}, {
			success: boolean;
			results?: Array<{
				jobId: string;
				matchScore: number;
				breakdown?: {
					skills?: number;
					experience?: number;
					education?: number;
					location?: number;
				};
				reasons?: string[];
				processingTimeMs?: number;
			}>;
		}>('coordination_orchestrate', {
			task: JSON.stringify({
				type: 'batch_job_matching',
				jobs: jobs.map((j) => ({
					id: j.id,
					title: j.title,
					company: j.company,
					description: j.description?.slice(0, 2000), // Limit description size
					requirements: j.requirements?.slice(0, 10),
					location: j.location,
					isRemote: j.isRemote
				})),
				profile: {
					id: profile.id,
					skills: profile.skills,
					experience: profile.experience.map((e) => ({
						title: e.title,
						company: e.company,
						skills: e.skills
					})),
					education: profile.education.map((e) => ({
						degree: e.degree,
						field: e.field
					})),
					location: profile.location
				},
				minScore
			}),
			agents: ['job-match-agent'],
			strategy: 'parallel',
			timeout: timeoutMs
		});

		if (!result?.success || !result.results) {
			return [];
		}

		// Map results back to jobs
		const jobMap = new Map(jobs.map((j) => [j.id, j]));

		return result.results
			.filter((r) => r.matchScore >= minScore)
			.map((r) => ({
				job: jobMap.get(r.jobId) || jobs.find((j) => j.id === r.jobId)!,
				matchScore: r.matchScore,
				breakdown: {
					skills: r.breakdown?.skills ?? 0,
					experience: r.breakdown?.experience ?? 0,
					education: r.breakdown?.education ?? 0,
					location: r.breakdown?.location ?? 0
				},
				reasons: r.reasons || [],
				processingTimeMs: r.processingTimeMs || 0
			}))
			.filter((r) => r.job !== undefined);
	} catch (error) {
		console.error('[SwarmCoordinator] Batch matching failed:', error);
		return [];
	}
}

// -----------------------------------------------------------------------------
// Consensus Quality Checking
// -----------------------------------------------------------------------------

/**
 * Run multi-agent consensus quality check on generated content
 * Uses multiple agents to vote on quality with byzantine fault tolerance
 */
export async function runConsensusQualityCheck(
	content: string,
	contentType: 'resume' | 'cover_letter',
	context: {
		jobTitle: string;
		company: string;
		jobDescription: string;
		originalProfile: {
			skills: string[];
			experience: string[];
		};
	},
	options?: {
		voterCount?: number;
		consensusThreshold?: number;
		timeoutMs?: number;
	}
): Promise<ConsensusResult | null> {
	if (!isMCPEnabled()) {
		return null;
	}

	const { voterCount = 3, consensusThreshold = 0.66, timeoutMs = 30000 } = options || {};

	// Ensure swarm is initialized with consensus capability
	const status = await getSwarmStatus();
	if (!status.initialized) {
		const initialized = await initializeSwarm({
			topology: 'mesh', // Mesh topology for consensus
			maxAgents: voterCount,
			strategy: 'specialized',
			consensusAlgorithm: 'byzantine'
		});

		if (!initialized) {
			return null;
		}
	}

	try {
		// Create consensus proposal for quality check
		const result = await callMCPTool<{
			action: string;
			type?: string;
			value?: unknown;
		}, {
			success: boolean;
			proposalId?: string;
			votes?: Array<{
				agentId: string;
				vote: string;
				score?: number;
				feedback?: string;
			}>;
			finalVerdict?: string;
			confidence?: number;
		}>('hive-mind_consensus', {
			action: 'propose',
			type: 'quality_check',
			value: {
				contentType,
				content: content.slice(0, 5000), // Limit content size
				context: {
					jobTitle: context.jobTitle,
					company: context.company,
					jobDescription: context.jobDescription.slice(0, 2000),
					profileSkills: context.originalProfile.skills.slice(0, 20),
					profileExperience: context.originalProfile.experience.slice(0, 5)
				},
				criteria: {
					atsCompatibility: true,
					keywordCoverage: true,
					contentRelevance: true,
					professionalTone: true,
					noFabrication: true
				},
				threshold: consensusThreshold
			}
		});

		if (!result?.success || !result.votes) {
			return null;
		}

		// Process votes
		const approveVotes = result.votes.filter((v) => v.vote === 'approve').length;
		const rejectVotes = result.votes.filter((v) => v.vote === 'reject').length;
		const reviseVotes = result.votes.filter((v) => v.vote === 'revise').length;

		let verdict: 'approved' | 'rejected' | 'needs_revision';
		if (approveVotes / result.votes.length >= consensusThreshold) {
			verdict = 'approved';
		} else if (rejectVotes / result.votes.length >= consensusThreshold) {
			verdict = 'rejected';
		} else {
			verdict = 'needs_revision';
		}

		// Aggregate feedback
		const allFeedback = result.votes
			.map((v) => v.feedback)
			.filter((f): f is string => !!f);

		// Extract unique recommendations
		const recommendations = extractRecommendations(allFeedback);

		return {
			verdict,
			confidence: result.confidence ?? (Math.max(approveVotes, rejectVotes, reviseVotes) / result.votes.length),
			voterCount: result.votes.length,
			votes: result.votes.map((v) => ({
				agentId: v.agentId,
				vote: v.vote as 'approve' | 'reject' | 'revise',
				score: v.score ?? 0,
				feedback: v.feedback ?? ''
			})),
			aggregatedFeedback: allFeedback,
			recommendations
		};
	} catch (error) {
		console.error('[SwarmCoordinator] Consensus quality check failed:', error);
		return null;
	}
}

// -----------------------------------------------------------------------------
// Agent Spawning for Specific Tasks
// -----------------------------------------------------------------------------

/**
 * Spawn specialized agents for a complex task
 */
export async function spawnSpecializedAgents(
	task: 'research' | 'generation' | 'review' | 'optimization',
	count: number = 2
): Promise<string[]> {
	if (!isMCPEnabled()) {
		return [];
	}

	const agentTypeMap: Record<string, string> = {
		research: 'researcher',
		generation: 'coder',
		review: 'reviewer',
		optimization: 'perf-analyzer'
	};

	const agentType = agentTypeMap[task] || 'worker';
	const spawnedAgentIds: string[] = [];

	try {
		for (let i = 0; i < count; i++) {
			const result = await callMCPTool<{
				agentType: string;
				agentId?: string;
				task?: string;
				model?: string;
			}, {
				success: boolean;
				agentId?: string;
			}>('agent_spawn', {
				agentType,
				agentId: `howlerhire-${task}-${i + 1}`,
				task: `HowlerHire ${task} agent`,
				model: 'haiku' // Use fast/cheap model for most tasks
			});

			if (result?.success && result.agentId) {
				spawnedAgentIds.push(result.agentId);
			}
		}

		return spawnedAgentIds;
	} catch (error) {
		console.error('[SwarmCoordinator] Failed to spawn agents:', error);
		return spawnedAgentIds;
	}
}

/**
 * Terminate spawned agents
 */
export async function terminateAgents(agentIds: string[]): Promise<void> {
	if (!isMCPEnabled() || agentIds.length === 0) {
		return;
	}

	await Promise.allSettled(
		agentIds.map((agentId) =>
			callMCPTool<{ agentId: string; force?: boolean }, { success: boolean }>('agent_terminate', {
				agentId,
				force: false
			})
		)
	);
}

// -----------------------------------------------------------------------------
// Hive-Mind Operations
// -----------------------------------------------------------------------------

/**
 * Broadcast a message to all active agents
 */
export async function broadcastToAgents(
	message: string,
	priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
): Promise<boolean> {
	if (!isMCPEnabled()) {
		return false;
	}

	try {
		const result = await callMCPTool<{
			message: string;
			priority?: string;
			fromId?: string;
		}, { success: boolean }>('hive-mind_broadcast', {
			message,
			priority,
			fromId: 'howlerhire-orchestrator'
		});

		return result?.success ?? false;
	} catch (error) {
		console.error('[SwarmCoordinator] Broadcast failed:', error);
		return false;
	}
}

/**
 * Store data in hive shared memory
 */
export async function storeInHiveMemory(
	key: string,
	value: unknown
): Promise<boolean> {
	if (!isMCPEnabled()) {
		return false;
	}

	try {
		const result = await callMCPTool<{
			action: string;
			key?: string;
			value?: unknown;
		}, { success: boolean }>('hive-mind_memory', {
			action: 'set',
			key: `howlerhire:${key}`,
			value
		});

		return result?.success ?? false;
	} catch (error) {
		console.error('[SwarmCoordinator] Failed to store in hive memory:', error);
		return false;
	}
}

/**
 * Retrieve data from hive shared memory
 */
export async function retrieveFromHiveMemory<T>(key: string): Promise<T | null> {
	if (!isMCPEnabled()) {
		return null;
	}

	try {
		const result = await callMCPTool<{
			action: string;
			key?: string;
		}, { success: boolean; value?: T }>('hive-mind_memory', {
			action: 'get',
			key: `howlerhire:${key}`
		});

		return result?.value ?? null;
	} catch (error) {
		console.error('[SwarmCoordinator] Failed to retrieve from hive memory:', error);
		return null;
	}
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function extractRecommendations(feedbackList: string[]): string[] {
	const recommendations = new Set<string>();

	// Common patterns to extract recommendations
	const patterns = [
		/should\s+(.+?)(?:\.|$)/gi,
		/recommend\s+(.+?)(?:\.|$)/gi,
		/consider\s+(.+?)(?:\.|$)/gi,
		/improve\s+(.+?)(?:\.|$)/gi,
		/add\s+(.+?)(?:\.|$)/gi
	];

	for (const feedback of feedbackList) {
		for (const pattern of patterns) {
			const matches = feedback.matchAll(pattern);
			for (const match of matches) {
				if (match[1] && match[1].length > 10 && match[1].length < 200) {
					recommendations.add(match[1].trim());
				}
			}
		}
	}

	return Array.from(recommendations).slice(0, 10); // Limit to 10 recommendations
}
