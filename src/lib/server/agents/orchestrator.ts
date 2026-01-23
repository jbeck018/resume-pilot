// =============================================================================
// Agent Orchestrator
// =============================================================================

import { Langfuse } from 'langfuse';
import type {
	AgentContext,
	AgentResult,
	JobInfo,
	ProfileInfo,
	ResumeInfo,
	ResumeAgentOutput,
	CoverLetterAgentOutput,
	JobMatchAgentOutput,
	ProfileAgentOutput,
	OrchestrationPlan,
	OrchestrationResult
} from './types';
import { resumeAgent } from './agents/resume-agent';
import { coverLetterAgent } from './agents/cover-letter-agent';
import { jobMatchAgent } from './agents/job-match-agent';
import { profileAgent } from './agents/profile-agent';
import { checkBudget, BudgetExceededError } from '../llm/budget';
import {
	isMCPEnabled,
	learnFromSuccess,
	learnFromFailure,
	storeAgentExecution,
	getGenerationRecommendations,
	coordinateBatchMatching,
	shutdownMCPClients
} from '../mcp';

// -----------------------------------------------------------------------------
// Orchestrator Configuration
// -----------------------------------------------------------------------------

interface OrchestratorConfig {
	/** Enable parallel execution where possible */
	parallelExecution: boolean;
	/** Maximum concurrent agent executions */
	maxConcurrency: number;
	/** Global timeout for orchestration */
	timeoutMs: number;
	/** Enable company research for all agents */
	includeResearch: boolean;
}

const defaultConfig: OrchestratorConfig = {
	parallelExecution: true,
	maxConcurrency: 3,
	timeoutMs: 300000, // 5 minutes
	includeResearch: true
};

// -----------------------------------------------------------------------------
// Langfuse Initialization
// -----------------------------------------------------------------------------

let langfuseInstance: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
	if (langfuseInstance) return langfuseInstance;

	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = process.env.LANGFUSE_SECRET_KEY;

	if (!publicKey || !secretKey) return null;

	langfuseInstance = new Langfuse({
		publicKey,
		secretKey,
		baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com'
	});

	return langfuseInstance;
}

// -----------------------------------------------------------------------------
// Application Generation Orchestration
// -----------------------------------------------------------------------------

export interface ApplicationGenerationInput {
	userId: string;
	job: JobInfo;
	profile: ProfileInfo;
	resume?: ResumeInfo;
	options?: {
		includeResearch?: boolean;
		generateCoverLetter?: boolean;
		tone?: 'formal' | 'conversational' | 'enthusiastic';
		/** Focus areas for resume generation (used by MCP pattern learning) */
		focusAreas?: string[];
	};
}

export interface ApplicationGenerationOutput {
	resume: ResumeAgentOutput;
	coverLetter?: CoverLetterAgentOutput;
	matchScore: JobMatchAgentOutput;
	totalCostCents: number;
	totalDurationMs: number;
	traceId: string;
}

/**
 * Orchestrate full application generation
 * Coordinates ResumeAgent, CoverLetterAgent, and JobMatchAgent
 * Now enhanced with MCP pattern learning
 */
export async function generateApplication(
	input: ApplicationGenerationInput,
	config: Partial<OrchestratorConfig> = {}
): Promise<ApplicationGenerationOutput> {
	const orchestratorConfig = { ...defaultConfig, ...config };
	const startTime = Date.now();
	const langfuse = getLangfuse();
	const executionId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

	// Create main trace
	const trace = langfuse?.trace({
		name: 'application-generation',
		userId: input.userId,
		metadata: {
			jobId: input.job.id,
			company: input.job.company,
			position: input.job.title,
			includeResearch: input.options?.includeResearch ?? orchestratorConfig.includeResearch,
			generateCoverLetter: input.options?.generateCoverLetter ?? true,
			mcpEnabled: isMCPEnabled()
		}
	});

	if (!trace) {
		throw new Error('Failed to create Langfuse trace');
	}

	// Check budget before starting
	const budgetCheck = await checkBudget(input.userId);
	if (!budgetCheck.allowed) {
		trace.update({
			metadata: {
				budgetStatus: 'exceeded',
				budgetRemaining: budgetCheck.remainingCents
			}
		});
		throw new BudgetExceededError(budgetCheck);
	}

	const context: AgentContext = {
		userId: input.userId,
		jobId: input.job.id,
		trace,
		metadata: {
			company: input.job.company,
			position: input.job.title
		}
	};

	// MCP Enhancement: Get recommendations from similar past successes
	let mcpRecommendations: Awaited<ReturnType<typeof getGenerationRecommendations>> | null = null;
	if (isMCPEnabled()) {
		try {
			mcpRecommendations = await getGenerationRecommendations({
				jobTitle: input.job.title,
				jobDescription: input.job.description,
				industry: extractIndustry(input.job.description),
				skills: input.profile.skills
			});

			if (mcpRecommendations.confidenceLevel === 'high') {
				trace.span({ name: 'mcp-pattern-lookup' }).end({
					output: {
						confidenceLevel: mcpRecommendations.confidenceLevel,
						estimatedAtsScore: mcpRecommendations.estimatedAtsScore,
						recommendedStrategies: mcpRecommendations.recommendedStrategies
					}
				});
			}
		} catch (error) {
			// MCP recommendation lookup failed - continuing without MCP recommendations
		}
	}

	try {
		// Step 1: Calculate job match score (fast, informs other agents)
		const matchSpan = trace.span({ name: 'job-match-calculation' });
		const matchResult = await jobMatchAgent.execute(
			{
				job: input.job,
				profile: input.profile
			},
			{ ...context, parentSpan: matchSpan }
		);
		matchSpan.end({ output: { score: matchResult.data?.overallScore } });

		if (!matchResult.success || !matchResult.data) {
			throw new Error(`Job match failed: ${matchResult.error}`);
		}

		// Step 2: Generate resume (primary deliverable)
		const resumeSpan = trace.span({ name: 'resume-generation' });
		const resumeResult = await resumeAgent.execute(
			{
				job: input.job,
				profile: input.profile,
				resume: input.resume,
				options: {
					includeResearch: input.options?.includeResearch ?? orchestratorConfig.includeResearch,
					// MCP Enhancement: Use recommended focus areas from past successes
					focusAreas: mcpRecommendations?.recommendedStrategies.includes('focus:')
						? mcpRecommendations.recommendedStrategies
								.filter((s) => s.startsWith('focus:'))
								.map((s) => s.replace('focus:', '').split(','))
								.flat()
						: undefined
				}
			},
			{ ...context, parentSpan: resumeSpan }
		);
		resumeSpan.end({ output: { atsScore: resumeResult.data?.atsScore } });

		if (!resumeResult.success || !resumeResult.data) {
			throw new Error(`Resume generation failed: ${resumeResult.error}`);
		}

		// Step 3: Generate cover letter (if requested)
		let coverLetterResult: AgentResult<CoverLetterAgentOutput> | undefined;

		if (input.options?.generateCoverLetter !== false) {
			const coverSpan = trace.span({ name: 'cover-letter-generation' });
			coverLetterResult = await coverLetterAgent.execute(
				{
					job: input.job,
					profile: input.profile,
					resume: input.resume,
					options: {
						includeResearch: input.options?.includeResearch ?? orchestratorConfig.includeResearch,
						tone: input.options?.tone || 'conversational'
					}
				},
				{ ...context, parentSpan: coverSpan }
			);
			coverSpan.end({ output: { qualityScore: coverLetterResult.data?.qualityScore } });

			// Cover letter failure is non-fatal
			if (!coverLetterResult.success) {
				// Cover letter generation failed - continuing without it
			}
		}

		// Calculate totals
		const totalCostCents =
			(matchResult.costCents || 0) +
			(resumeResult.costCents || 0) +
			(coverLetterResult?.costCents || 0);

		const totalDurationMs = Date.now() - startTime;

		// Update trace with final results
		trace.update({
			output: {
				matchScore: matchResult.data.overallScore,
				atsScore: resumeResult.data.atsScore,
				coverLetterScore: coverLetterResult?.data?.qualityScore,
				totalCostCents,
				totalDurationMs
			}
		});

		// MCP Enhancement: Store successful pattern for future learning
		if (isMCPEnabled() && resumeResult.data.atsScore >= 70) {
			// Non-blocking: store pattern in background
			learnFromSuccess({
				jobTitle: input.job.title,
				company: input.job.company,
				industry: extractIndustry(input.job.description),
				jobDescription: input.job.description,
				skills: resumeResult.data.matchedSkills,
				atsScore: resumeResult.data.atsScore,
				matchScore: matchResult.data.overallScore,
				generationStrategy: {
					includeResearch: input.options?.includeResearch ?? orchestratorConfig.includeResearch,
					focusAreas: input.options?.focusAreas
				}
			}).catch((error) => {
				// Failed to store success pattern - non-critical
			});

			// Store agent execution record for learning
			storeAgentExecution({
				executionId,
				agentType: 'resume-agent',
				inputSummary: {
					jobTitle: input.job.title,
					company: input.job.company,
					industry: extractIndustry(input.job.description),
					keySkills: input.profile.skills.slice(0, 10)
				},
				outputMetrics: {
					atsScore: resumeResult.data.atsScore,
					matchScore: matchResult.data.overallScore,
					qualityScore: coverLetterResult?.data?.qualityScore,
					tokensUsed: resumeResult.usage.totalTokens + (coverLetterResult?.usage.totalTokens || 0),
					durationMs: totalDurationMs,
					costCents: totalCostCents
				},
				success: true,
				timestamp: new Date().toISOString()
			}).catch((error) => {
				// Failed to store execution record - non-critical
			});
		}

		// Flush Langfuse
		langfuse?.flushAsync().catch(() => {
			// Langfuse flush error - non-critical
		});

		return {
			resume: resumeResult.data,
			coverLetter: coverLetterResult?.data,
			matchScore: matchResult.data,
			totalCostCents,
			totalDurationMs,
			traceId: trace.id
		};
	} catch (error) {
		trace.update({
			metadata: {
				error: error instanceof Error ? error.message : 'Orchestration failed',
				errorType: error instanceof Error ? error.name : 'UnknownError'
			}
		});

		// MCP Enhancement: Learn from failures too
		if (isMCPEnabled()) {
			learnFromFailure({
				jobTitle: input.job.title,
				company: input.job.company,
				industry: extractIndustry(input.job.description),
				error: error instanceof Error ? error.message : 'Unknown error'
			}).catch(() => {
			// Failed to learn from failure - non-critical
		});
		}

		langfuse?.flushAsync().catch(() => {
			// Langfuse flush error - non-critical
		});
		throw error;
	}
}

/**
 * Extract industry from job description (simple heuristic)
 */
function extractIndustry(description: string): string | undefined {
	const industries = [
		'technology', 'software', 'fintech', 'healthcare', 'finance',
		'e-commerce', 'retail', 'manufacturing', 'education', 'media',
		'consulting', 'telecommunications', 'energy', 'automotive'
	];

	const descLower = description.toLowerCase();
	return industries.find((ind) => descLower.includes(ind));
}

// -----------------------------------------------------------------------------
// Profile Analysis Orchestration
// -----------------------------------------------------------------------------

export interface ProfileAnalysisInput {
	userId: string;
	profile: ProfileInfo;
	resume?: ResumeInfo;
	targetRoles?: string[];
}

/**
 * Orchestrate profile analysis
 */
export async function analyzeProfile(
	input: ProfileAnalysisInput
): Promise<AgentResult<ProfileAgentOutput>> {
	const langfuse = getLangfuse();

	const trace = langfuse?.trace({
		name: 'profile-analysis',
		userId: input.userId,
		metadata: {
			profileId: input.profile.id,
			targetRoles: input.targetRoles
		}
	});

	if (!trace) {
		throw new Error('Failed to create Langfuse trace');
	}

	const context: AgentContext = {
		userId: input.userId,
		trace
	};

	try {
		const result = await profileAgent.execute(
			{
				profile: input.profile,
				resume: input.resume,
				targetRoles: input.targetRoles
			},
			context
		);

		trace.update({
			output: {
				profileStrength: result.data?.profileStrength,
				suggestionsCount: result.data?.recommendations.length
			}
		});

		langfuse?.flushAsync().catch(() => {
			// Langfuse flush error - non-critical
		});
		return result;
	} catch (error) {
		trace.update({
			metadata: {
				error: error instanceof Error ? error.message : 'Analysis failed',
				errorType: error instanceof Error ? error.name : 'UnknownError'
			}
		});
		langfuse?.flushAsync().catch(() => {
			// Langfuse flush error - non-critical
		});
		throw error;
	}
}

// -----------------------------------------------------------------------------
// Batch Job Matching
// -----------------------------------------------------------------------------

export interface BatchMatchInput {
	userId: string;
	profile: ProfileInfo;
	jobs: JobInfo[];
	minScore?: number;
}

export interface BatchMatchOutput {
	matches: Array<{
		job: JobInfo;
		score: JobMatchAgentOutput;
	}>;
	totalCostCents: number;
	processedCount: number;
	filteredCount: number;
}

/**
 * Score multiple jobs against a profile
 * Now enhanced with MCP swarm coordination for parallel processing
 */
export async function batchMatchJobs(
	input: BatchMatchInput,
	config: Partial<OrchestratorConfig> = {}
): Promise<BatchMatchOutput> {
	const orchestratorConfig = { ...defaultConfig, ...config };
	const minScore = input.minScore ?? 50;
	const langfuse = getLangfuse();

	const trace = langfuse?.trace({
		name: 'batch-job-matching',
		userId: input.userId,
		metadata: {
			jobCount: input.jobs.length,
			minScore,
			mcpEnabled: isMCPEnabled()
		}
	});

	if (!trace) {
		throw new Error('Failed to create Langfuse trace');
	}

	const context: AgentContext = {
		userId: input.userId,
		trace
	};

	// MCP Enhancement: Try swarm-coordinated batch matching for large batches
	if (isMCPEnabled() && input.jobs.length >= 5) {
		try {
			const swarmSpan = trace.span({ name: 'mcp-swarm-batch-matching' });
			const swarmResults = await coordinateBatchMatching(input.jobs, input.profile, {
				minScore,
				maxConcurrency: orchestratorConfig.maxConcurrency,
				timeoutMs: orchestratorConfig.timeoutMs
			});

			if (swarmResults.length > 0) {
				swarmSpan.end({
					output: {
						matchedJobs: swarmResults.length,
						topScore: swarmResults[0]?.matchScore,
						usedSwarm: true
					}
				});

				// Convert swarm results to expected format
				const matches = swarmResults.map((r) => ({
					job: r.job,
					score: {
						overallScore: r.matchScore,
						breakdown: {
							skills: { score: r.breakdown.skills, matched: [], missing: [] },
							experience: { score: r.breakdown.experience, relevance: '' },
							education: { score: r.breakdown.education, relevance: '' },
							location: { score: r.breakdown.location, compatible: true },
							salary: { score: 100, inRange: true }
						},
						matchReasons: r.reasons,
						suggestions: [],
						concerns: []
					} as JobMatchAgentOutput
				}));

				langfuse?.flushAsync().catch(() => {
			// Langfuse flush error - non-critical
		});

				return {
					matches,
					totalCostCents: 0, // Swarm-coordinated, cost tracked separately
					processedCount: input.jobs.length,
					filteredCount: matches.length
				};
			}

			swarmSpan.end({ output: { usedSwarm: false, fallbackToLocal: true } });
		} catch (error) {
			// Swarm batch matching failed, falling back to local processing
		}
	}

	// Fallback to local batch processing
	const matches: Array<{ job: JobInfo; score: JobMatchAgentOutput }> = [];
	let totalCostCents = 0;

	// Process jobs with controlled concurrency
	const batchSize = orchestratorConfig.maxConcurrency;

	for (let i = 0; i < input.jobs.length; i += batchSize) {
		const batch = input.jobs.slice(i, i + batchSize);

		const batchResults = await Promise.all(
			batch.map(async (job) => {
				const result = await jobMatchAgent.execute(
					{ job, profile: input.profile },
					{ ...context, jobId: job.id }
				);

				totalCostCents += result.costCents;

				if (result.success && result.data && result.data.overallScore >= minScore) {
					return { job, score: result.data };
				}
				return null;
			})
		);

		// Collect non-null results
		for (const result of batchResults) {
			if (result) matches.push(result);
		}
	}

	// Sort by score descending
	matches.sort((a, b) => b.score.overallScore - a.score.overallScore);

	trace.update({
		output: {
			totalJobs: input.jobs.length,
			matchedJobs: matches.length,
			topScore: matches[0]?.score.overallScore,
			totalCostCents
		}
	});

	langfuse?.flushAsync().catch(() => {
		// Langfuse flush error - non-critical
	});

	return {
		matches,
		totalCostCents,
		processedCount: input.jobs.length,
		filteredCount: matches.length
	};
}

// -----------------------------------------------------------------------------
// Custom Orchestration Plans
// -----------------------------------------------------------------------------

/**
 * Execute a custom orchestration plan
 * Allows flexible composition of agents
 */
export async function executeOrchestrationPlan(
	plan: OrchestrationPlan,
	userId: string
): Promise<OrchestrationResult> {
	const startTime = Date.now();
	const langfuse = getLangfuse();

	const trace = langfuse?.trace({
		name: `orchestration-${plan.name}`,
		userId,
		metadata: {
			planId: plan.id,
			stepCount: plan.steps.length
		}
	});

	if (!trace) {
		throw new Error('Failed to create Langfuse trace');
	}

	const stepResults: Record<string, AgentResult> = {};
	const executionContext: Record<string, unknown> = { ...plan.input };

	// Execute steps in dependency order
	const completedSteps = new Set<string>();

	while (completedSteps.size < plan.steps.length) {
		// Find steps ready to execute
		const readySteps = plan.steps.filter((step) => {
			if (completedSteps.has(step.id)) return false;
			if (!step.dependsOn) return true;
			return step.dependsOn.every((dep) => completedSteps.has(dep));
		});

		if (readySteps.length === 0 && completedSteps.size < plan.steps.length) {
			throw new Error('Circular dependency detected in orchestration plan');
		}

		// Execute ready steps (could be parallelized)
		for (const step of readySteps) {
			// Check condition if present
			if (step.condition && !step.condition(executionContext)) {
				if (!step.optional) {
					throw new Error(`Required step ${step.id} condition not met`);
				}
				completedSteps.add(step.id);
				continue;
			}

			// Build input from mapping
			const stepInput: Record<string, unknown> = {};
			for (const [key, source] of Object.entries(step.inputMapping)) {
				const [sourceStep, sourceKey] = source.split('.');
				if (sourceStep === 'input') {
					stepInput[key] = executionContext[sourceKey];
				} else if (stepResults[sourceStep]?.data) {
					stepInput[key] = (stepResults[sourceStep].data as Record<string, unknown>)[sourceKey];
				}
			}

			// Execute agent
			const agent = getAgentById(step.agentId);
			const stepSpan = trace.span({ name: step.name });

			// Use type assertion since the orchestrator dynamically builds input for each agent
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = await agent.execute(stepInput as any, {
				userId,
				trace,
				parentSpan: stepSpan
			});

			stepSpan.end({ output: { success: result.success } });

			stepResults[step.id] = result;
			completedSteps.add(step.id);

			// Fail fast on non-optional step failure
			if (!result.success && !step.optional) {
				throw new Error(`Required step ${step.id} failed: ${result.error}`);
			}
		}
	}

	const totalDurationMs = Date.now() - startTime;
	const totalCostCents = Object.values(stepResults).reduce((sum, r) => sum + (r.costCents || 0), 0);

	trace.update({
		output: {
			success: true,
			totalDurationMs,
			totalCostCents,
			stepsCompleted: completedSteps.size
		}
	});

	langfuse?.flushAsync().catch(() => {
		// Langfuse flush error - non-critical
	});

	return {
		planId: plan.id,
		success: true,
		stepResults,
		totalDurationMs,
		totalCostCents,
		traceId: trace.id
	};
}

function getAgentById(agentId: string) {
	switch (agentId) {
		case 'resume-agent':
			return resumeAgent;
		case 'cover-letter-agent':
			return coverLetterAgent;
		case 'job-match-agent':
			return jobMatchAgent;
		case 'profile-agent':
			return profileAgent;
		default:
			throw new Error(`Unknown agent: ${agentId}`);
	}
}

// -----------------------------------------------------------------------------
// Shutdown
// -----------------------------------------------------------------------------

export async function shutdown(): Promise<void> {
	// Shutdown Langfuse
	if (langfuseInstance) {
		await langfuseInstance.shutdownAsync();
	}

	// Shutdown MCP clients
	if (isMCPEnabled()) {
		await shutdownMCPClients();
	}
}
