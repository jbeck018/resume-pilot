// =============================================================================
// Base Agent Implementation
// =============================================================================

import { Langfuse } from 'langfuse';
import { env } from '$env/dynamic/private';
import type {
	AgentConfig,
	AgentContext,
	AgentResult,
	AgentState,
	AgentErrorCode,
	TokenUsage,
	ToolDefinition,
	ToolContext,
	ModelId,
	GenerationOptions,
	GenerationResult
} from '../types';
import { checkBudget, recordUsage, getProviderFromModel, BudgetExceededError } from '../../llm/budget';
import { complete, completeStream, type CompletionOptions } from '../../llm/client';

// -----------------------------------------------------------------------------
// Abstract Base Agent
// -----------------------------------------------------------------------------

/**
 * Abstract base class for all agents
 * Provides common functionality for:
 * - Langfuse tracing
 * - Budget management
 * - Error handling
 * - Tool execution
 */
export abstract class BaseAgent<TInput, TOutput> {
	protected config: AgentConfig;
	protected tools: Map<string, ToolDefinition> = new Map();
	protected state: AgentState = 'idle';
	private langfuse: Langfuse | null = null;

	constructor(config: AgentConfig) {
		this.config = config;
	}

	/**
	 * Initialize Langfuse client (lazy)
	 */
	protected getLangfuse(): Langfuse | null {
		if (this.langfuse) return this.langfuse;

		const publicKey = env.LANGFUSE_PUBLIC_KEY;
		const secretKey = env.LANGFUSE_SECRET_KEY;

		if (!publicKey || !secretKey) return null;

		this.langfuse = new Langfuse({
			publicKey,
			secretKey,
			baseUrl: env.LANGFUSE_HOST || 'https://cloud.langfuse.com'
		});

		return this.langfuse;
	}

	/**
	 * Register a tool for this agent
	 */
	protected registerTool<TIn, TOut>(tool: ToolDefinition<TIn, TOut>): void {
		this.tools.set(tool.id, tool as ToolDefinition);
	}

	/**
	 * Execute the agent with full tracing and budget management
	 */
	async execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>> {
		const startTime = Date.now();
		let totalCost = 0;
		let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

		// Create span for this agent execution
		const span = context.parentSpan
			? context.parentSpan.span({ name: this.config.id })
			: context.trace.span({ name: this.config.id });

		span.update({
			input,
			metadata: {
				agentId: this.config.id,
				agentName: this.config.name,
				priority: this.config.priority
			}
		});

		try {
			// Check budget before execution
			this.state = 'planning';
			const budgetCheck = await checkBudget(context.userId);

			if (!budgetCheck.allowed) {
				span.update({
					metadata: {
						budgetStatus: 'exceeded',
						budgetRemaining: budgetCheck.remainingCents
					}
				});
				throw new BudgetExceededError(budgetCheck);
			}

			// Execute the agent-specific logic
			this.state = 'executing';
			const agentContext: AgentContext = {
				...context,
				parentSpan: span
			};

			const result = await this.executeInternal(input, agentContext);

			// Validate the result
			this.state = 'validating';
			const validation = await this.validate(result, input, agentContext);

			if (!validation.valid) {
				throw new AgentValidationError(validation.errors);
			}

			// Success
			this.state = 'completed';
			const durationMs = Date.now() - startTime;

			span.end({
				output: result,
				metadata: {
					durationMs,
					costCents: totalCost,
					success: true
				}
			});

			// Flush Langfuse
			this.getLangfuse()?.flushAsync().catch(() => {
				// Langfuse flush error - non-critical
			});

			return {
				success: true,
				data: result,
				durationMs,
				costCents: totalCost,
				usage: totalUsage,
				traceId: context.trace.id
			};
		} catch (error) {
			this.state = 'failed';
			const durationMs = Date.now() - startTime;
			const errorCode = this.categorizeError(error);

			span.end({
				level: 'ERROR',
				statusMessage: error instanceof Error ? error.message : 'Unknown error',
				metadata: {
					durationMs,
					errorCode,
					success: false
				}
			});

			this.getLangfuse()?.flushAsync().catch(() => {
				// Langfuse flush error - non-critical
			});

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				errorCode,
				durationMs,
				costCents: totalCost,
				usage: totalUsage,
				traceId: context.trace.id
			};
		} finally {
			this.state = 'idle';
		}
	}

	/**
	 * Abstract method - implement agent-specific logic
	 */
	protected abstract executeInternal(input: TInput, context: AgentContext): Promise<TOutput>;

	/**
	 * Validate agent output (override for custom validation)
	 */
	protected async validate(
		_output: TOutput,
		_input: TInput,
		_context: AgentContext
	): Promise<{ valid: boolean; errors: string[] }> {
		return { valid: true, errors: [] };
	}

	/**
	 * Execute a tool with tracing
	 */
	protected async executeTool<TIn, TOut>(
		toolId: string,
		input: TIn,
		context: AgentContext
	): Promise<TOut> {
		const tool = this.tools.get(toolId);
		if (!tool) {
			throw new Error(`Tool not found: ${toolId}`);
		}

		const span = context.parentSpan!.span({
			name: `tool:${toolId}`,
			input
		});

		const toolContext: ToolContext = {
			userId: context.userId,
			span,
			abortSignal: context.abortSignal
		};

		try {
			const startTime = Date.now();
			const result = await tool.execute(input, toolContext);

			if (!result.success) {
				throw new Error(result.error || `Tool ${toolId} failed`);
			}

			span.end({
				output: result.data,
				metadata: {
					durationMs: result.durationMs,
					cached: result.cached
				}
			});

			return result.data as TOut;
		} catch (error) {
			span.end({
				level: 'ERROR',
				statusMessage: error instanceof Error ? error.message : 'Tool error'
			});
			throw error;
		}
	}

	/**
	 * Generate text using LLM with tracing and budget management
	 */
	protected async generate(options: GenerationOptions, context: AgentContext): Promise<GenerationResult> {
		// Check budget
		const budgetCheck = await checkBudget(context.userId);
		if (!budgetCheck.allowed) {
			throw new BudgetExceededError(budgetCheck);
		}

		// Create generation span
		const generation = context.parentSpan!.generation({
			name: 'llm-generation',
			model: options.model,
			input: {
				system: options.systemPrompt,
				user: options.userPrompt
			},
			modelParameters: {
				maxTokens: options.maxTokens ?? 4096,
				temperature: options.temperature ?? 0.7
			}
		});

		try {
			const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

			if (options.systemPrompt) {
				messages.push({ role: 'system', content: options.systemPrompt });
			}
			messages.push({ role: 'user', content: options.userPrompt });

			const result = await complete({
				model: options.model,
				messages,
				maxTokens: options.maxTokens ?? 4096,
				temperature: options.temperature ?? 0.7,
				userId: context.userId,
				jobId: context.jobId,
				metadata: {
					agentId: this.config.id,
					purpose: this.config.name
				}
			});

			// Record usage
			await recordUsage({
				userId: context.userId,
				model: result.model,
				provider: getProviderFromModel(result.model),
				promptTokens: result.usage.promptTokens,
				completionTokens: result.usage.completionTokens,
				totalTokens: result.usage.totalTokens,
				costCents: result.cost,
				purpose: this.config.id,
				jobId: context.jobId,
				traceId: result.traceId,
				cached: result.cached
			});

			generation.end({
				output: result.content,
				usage: {
					input: result.usage.promptTokens,
					output: result.usage.completionTokens,
					total: result.usage.totalTokens,
					unit: 'TOKENS'
				},
				metadata: {
					costCents: result.cost
				}
			});

			return {
				content: result.content,
				json: options.jsonMode ? this.tryParseJson(result.content) : undefined,
				model: options.model,
				usage: result.usage,
				costCents: result.cost,
				finishReason: 'stop'
			};
		} catch (error) {
			generation.end({
				level: 'ERROR',
				statusMessage: error instanceof Error ? error.message : 'Generation failed'
			});
			throw error;
		}
	}

	/**
	 * Generate with streaming (for real-time UI updates)
	 */
	protected async *generateStream(
		options: GenerationOptions,
		context: AgentContext
	): AsyncGenerator<string, GenerationResult> {
		// Check budget
		const budgetCheck = await checkBudget(context.userId);
		if (!budgetCheck.allowed) {
			throw new BudgetExceededError(budgetCheck);
		}

		const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
		if (options.systemPrompt) {
			messages.push({ role: 'system', content: options.systemPrompt });
		}
		messages.push({ role: 'user', content: options.userPrompt });

		const stream = completeStream({
			model: options.model,
			messages,
			maxTokens: options.maxTokens ?? 4096,
			temperature: options.temperature ?? 0.7,
			userId: context.userId,
			jobId: context.jobId,
			metadata: {
				agentId: this.config.id,
				purpose: this.config.name
			}
		});

		let result: Awaited<ReturnType<typeof complete>> | undefined;

		for await (const chunk of stream) {
			yield chunk;
		}

		// Get final result from generator return value
		const finalResult = await stream.next();
		if (finalResult.done && finalResult.value) {
			result = finalResult.value;
		}

		if (!result) {
			throw new Error('Stream completed without result');
		}

		// Record usage
		await recordUsage({
			userId: context.userId,
			model: result.model,
			provider: getProviderFromModel(result.model),
			promptTokens: result.usage.promptTokens,
			completionTokens: result.usage.completionTokens,
			totalTokens: result.usage.totalTokens,
			costCents: result.cost,
			purpose: this.config.id,
			jobId: context.jobId,
			traceId: result.traceId,
			cached: result.cached
		});

		return {
			content: result.content,
			model: options.model,
			usage: result.usage,
			costCents: result.cost,
			finishReason: 'stop'
		};
	}

	/**
	 * Get a prompt from Langfuse
	 */
	protected async getPrompt(
		promptName: string,
		variables: Record<string, string>,
		options?: { version?: number }
	): Promise<string> {
		const langfuse = this.getLangfuse();

		if (!langfuse) {
			throw new Error('Langfuse not configured - cannot fetch prompts');
		}

		const prompt = await langfuse.getPrompt(promptName, options?.version);
		return prompt.compile(variables);
	}

	/**
	 * Try to fetch prompt from Langfuse, fall back to provided default
	 */
	protected async getPromptWithFallback(
		promptName: string,
		variables: Record<string, string>,
		fallback: string
	): Promise<string> {
		try {
			return await this.getPrompt(promptName, variables);
		} catch {
			// Compile fallback with simple variable substitution
			let result = fallback;
			for (const [key, value] of Object.entries(variables)) {
				result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
			}
			return result;
		}
	}

	/**
	 * Categorize error for reporting
	 */
	private categorizeError(error: unknown): AgentErrorCode {
		if (error instanceof BudgetExceededError) return 'BUDGET_EXCEEDED';
		if (error instanceof AgentValidationError) return 'VALIDATION_FAILED';

		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message.includes('rate limit')) return 'RATE_LIMITED';
			if (message.includes('timeout')) return 'TIMEOUT';
			if (message.includes('cancelled') || message.includes('aborted')) return 'CANCELLED';
			if (message.includes('invalid')) return 'INVALID_INPUT';
			if (message.includes('tool')) return 'TOOL_FAILED';
		}

		return 'UNKNOWN';
	}

	/**
	 * Try to parse JSON from content
	 */
	private tryParseJson(content: string): unknown | undefined {
		try {
			// Try to find JSON in markdown code blocks
			const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) {
				return JSON.parse(jsonMatch[1].trim());
			}
			// Try direct parse
			return JSON.parse(content);
		} catch {
			return undefined;
		}
	}

	/**
	 * Get agent configuration
	 */
	getConfig(): AgentConfig {
		return { ...this.config };
	}

	/**
	 * Get current state
	 */
	getState(): AgentState {
		return this.state;
	}
}

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export class AgentValidationError extends Error {
	constructor(public errors: string[]) {
		super(`Validation failed: ${errors.join(', ')}`);
		this.name = 'AgentValidationError';
	}
}
