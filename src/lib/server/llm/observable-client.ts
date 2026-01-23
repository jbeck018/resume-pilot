// Observable AI Client - Comprehensive LLM Observability Wrapper
// Wraps Vercel AI SDK with: budget validation, rate limiting, caching, tracing, quality scoring
// Architecture: Pre-call hooks → AI SDK → Post-call hooks → Tracing/Recording

import { generateText, streamText, type CoreMessage, type LanguageModel } from 'ai';
import { Langfuse } from 'langfuse';
import { createHash } from 'crypto';
import {
	checkBudget,
	recordUsage,
	BudgetExceededError,
	getProviderFromModel,
	type BudgetCheck
} from './budget';
import { getModelProvider, calculateCost, type Model } from './client';

// ============================================================================
// Types
// ============================================================================

export interface ObservableOptions {
	// Required
	model: Model;
	messages: CoreMessage[];
	userId: string;

	// Optional generation params
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;

	// Tracking & observability
	purpose?: string; // 'resume', 'cover_letter', 'job_match', etc.
	jobId?: string;
	traceId?: string;
	parentSpanId?: string;
	metadata?: Record<string, unknown>;

	// Langfuse prompt management
	promptName?: string; // Fetch prompt from Langfuse instead of using messages
	promptVersion?: number | 'production'; // Default: 'production'

	// Caching
	enableCache?: boolean; // Default: true
	cacheTTL?: number; // Seconds, default: based on purpose
	cacheNamespace?: string; // Default: model name

	// Rate limiting
	skipRateLimit?: boolean; // Default: false

	// Budget
	skipBudgetCheck?: boolean; // Default: false

	// Retries
	maxRetries?: number; // Default: 3
	retryDelay?: number; // Milliseconds, default: 1000

	// Quality scoring (post-call)
	enableQualityScore?: boolean; // Default: true
}

export interface ObservableResult {
	content: string;
	model: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	cost: number; // Cents
	traceId?: string;
	spanId?: string;
	cached: boolean;
	cacheKey?: string;
	qualityScore?: number; // 0-100
	latencyMs: number;
	budgetCheck?: BudgetCheck;
}

interface CacheEntry {
	content: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	timestamp: number;
	ttl: number;
	metadata: Record<string, unknown>;
}

interface RateLimitState {
	tokens: number;
	lastRefill: number;
}

// ============================================================================
// Observable AI Client
// ============================================================================

export class ObservableAIClient {
	private langfuse: Langfuse | null = null;
	private cache: Map<string, CacheEntry> = new Map();
	private rateLimitStates: Map<string, RateLimitState> = new Map();

	// Rate limiting config (token bucket algorithm)
	private readonly RATE_LIMIT_CAPACITY = 100; // Max tokens
	private readonly RATE_LIMIT_REFILL_RATE = 10; // Tokens per second

	// Default cache TTLs by purpose (seconds)
	private readonly DEFAULT_CACHE_TTLS: Record<string, number> = {
		resume: 3600, // 1 hour (user data changes infrequently)
		cover_letter: 1800, // 30 minutes
		job_match: 300, // 5 minutes (job data can change)
		summary: 3600, // 1 hour
		embedding: 86400, // 24 hours (stable)
		general: 600 // 10 minutes
	};

	constructor(langfuse?: Langfuse) {
		this.langfuse = langfuse || null;
	}

	/**
	 * Generate text with full observability
	 */
	async generate(options: ObservableOptions): Promise<ObservableResult> {
		const startTime = Date.now();
		const traceId = options.traceId || this.generateId();
		const spanId = this.generateId();

		// Create Langfuse trace
		const trace = this.langfuse?.trace({
			id: traceId,
			name: 'observable-llm-generation',
			userId: options.userId,
			metadata: {
				model: options.model,
				purpose: options.purpose,
				jobId: options.jobId,
				...options.metadata
			}
		});

		// Create parent span for this generation
		const parentSpan = trace?.span({
			id: spanId,
			name: 'llm-generation',
			input: options.messages,
			metadata: {
				temperature: options.temperature,
				maxTokens: options.maxTokens
			}
		});

		try {
			// === PRE-CALL HOOKS ===

			// 1. Budget validation
			const budgetCheck = await this.checkBudgetHook(options, parentSpan);

			// 2. Rate limiting
			await this.rateLimitHook(options, parentSpan);

			// 3. Input sanitization
			const sanitizedMessages = await this.sanitizeInputHook(options.messages, parentSpan);

			// 4. Prompt retrieval from Langfuse (if specified)
			const messages = options.promptName
				? await this.fetchPromptHook(options, parentSpan)
				: sanitizedMessages;

			// 5. Cache check
			const cachedResult = await this.cacheCheckHook(options, messages, parentSpan);
			if (cachedResult) {
				parentSpan?.end({ output: cachedResult.content, metadata: { cached: true } });
				await this.langfuse?.flushAsync();
				return {
					...cachedResult,
					traceId,
					spanId,
					latencyMs: Date.now() - startTime,
					budgetCheck
				};
			}

			// === CALL LLM ===
			const generationResult = await this.executeWithRetry(
				options,
				messages,
				parentSpan,
				traceId
			);

			// === POST-CALL HOOKS ===

			// 1. Usage recording to database
			await this.recordUsageHook(options, { ...generationResult, cached: false }, parentSpan);

			// 2. Quality scoring
			const qualityScore = options.enableQualityScore
				? await this.qualityScoreHook(generationResult, options, parentSpan)
				: undefined;

			// 3. Cache storage
			if (options.enableCache !== false) {
				await this.cacheStoreHook(options, messages, generationResult, parentSpan);
			}

			const result: ObservableResult = {
				...generationResult,
				traceId,
				spanId,
				latencyMs: Date.now() - startTime,
				budgetCheck,
				qualityScore,
				cached: false
			};

			// End span and flush
			parentSpan?.end({
				output: result.content,
				metadata: {
					cost: result.cost,
					latency: result.latencyMs,
					qualityScore
				}
			});
			await this.langfuse?.flushAsync();

			return result;
		} catch (error) {
			// Error handling
			parentSpan?.end({
				level: 'ERROR',
				statusMessage: error instanceof Error ? error.message : 'Unknown error'
			});
			await this.langfuse?.flushAsync();
			throw error;
		}
	}

	/**
	 * Stream text with observability (simplified - no caching)
	 */
	async *generateStream(
		options: ObservableOptions
	): AsyncGenerator<string, ObservableResult> {
		const startTime = Date.now();
		const traceId = options.traceId || this.generateId();
		const spanId = this.generateId();

		const trace = this.langfuse?.trace({
			id: traceId,
			name: 'observable-llm-stream',
			userId: options.userId,
			metadata: {
				model: options.model,
				purpose: options.purpose,
				...options.metadata
			}
		});

		const parentSpan = trace?.span({
			id: spanId,
			name: 'llm-stream'
		});

		try {
			// Pre-call hooks (no caching for streams)
			const budgetCheck = await this.checkBudgetHook(options, parentSpan);
			await this.rateLimitHook(options, parentSpan);
			const messages = options.promptName
				? await this.fetchPromptHook(options, parentSpan)
				: await this.sanitizeInputHook(options.messages, parentSpan);

			// Execute stream
			const result = streamText({
				model: getModelProvider(options.model),
				messages,
				maxTokens: options.maxTokens,
				temperature: options.temperature
			});

			let fullContent = '';
			for await (const chunk of result.textStream) {
				fullContent += chunk;
				yield chunk;
			}

			const finalResult = await result;
			// Await the usage promise
			const usageData = await finalResult.usage;
			const usage = usageData || {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0
			};
			const cost = calculateCost(options.model, usage.promptTokens, usage.completionTokens);

			// Post-call hooks
			await this.recordUsageHook(
				options,
				{
					model: options.model,
					usage,
					cost,
					cached: false
				},
				parentSpan
			);

			const streamResult: ObservableResult = {
				content: fullContent,
				model: options.model,
				usage,
				cost,
				traceId,
				spanId,
				cached: false,
				latencyMs: Date.now() - startTime,
				budgetCheck
			};

			parentSpan?.end({ output: fullContent });
			await this.langfuse?.flushAsync();

			return streamResult;
		} catch (error) {
			parentSpan?.end({
				level: 'ERROR',
				statusMessage: error instanceof Error ? error.message : 'Unknown error'
			});
			await this.langfuse?.flushAsync();
			throw error;
		}
	}

	// ============================================================================
	// PRE-CALL HOOKS
	// ============================================================================

	private async checkBudgetHook(
		options: ObservableOptions,
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<BudgetCheck> {
		if (options.skipBudgetCheck) {
			return {
				allowed: true,
				remainingCents: Infinity,
				usagePercent: 0,
				message: null
			};
		}

		const budgetSpan = span?.span({ name: 'budget-check' });

		try {
			const budgetCheck = await checkBudget(options.userId);

			budgetSpan?.end({
				output: budgetCheck,
				metadata: { allowed: budgetCheck.allowed }
			});

			if (!budgetCheck.allowed) {
				throw new BudgetExceededError(budgetCheck);
			}

			return budgetCheck;
		} catch (error) {
			budgetSpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
			throw error;
		}
	}

	private async rateLimitHook(
		options: ObservableOptions,
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<void> {
		if (options.skipRateLimit) return;

		const rateLimitSpan = span?.span({ name: 'rate-limit-check' });
		const key = `${options.userId}:${options.model}`;

		try {
			const now = Date.now() / 1000;
			let state = this.rateLimitStates.get(key) || {
				tokens: this.RATE_LIMIT_CAPACITY,
				lastRefill: now
			};

			// Refill tokens based on time elapsed (token bucket)
			const timeSinceRefill = now - state.lastRefill;
			const tokensToAdd = timeSinceRefill * this.RATE_LIMIT_REFILL_RATE;
			state.tokens = Math.min(this.RATE_LIMIT_CAPACITY, state.tokens + tokensToAdd);
			state.lastRefill = now;

			// Check if tokens available
			if (state.tokens < 1) {
				const waitTime = (1 - state.tokens) / this.RATE_LIMIT_REFILL_RATE;
				rateLimitSpan?.end({
					level: 'WARNING',
					statusMessage: `Rate limit exceeded, retry after ${waitTime}s`
				});
				throw new Error(
					`Rate limit exceeded. Please retry after ${Math.ceil(waitTime)} seconds.`
				);
			}

			// Consume token
			state.tokens -= 1;
			this.rateLimitStates.set(key, state);

			rateLimitSpan?.end({ metadata: { tokensRemaining: state.tokens } });
		} catch (error) {
			rateLimitSpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
			throw error;
		}
	}

	private async sanitizeInputHook(
		messages: CoreMessage[],
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<CoreMessage[]> {
		const sanitizeSpan = span?.span({ name: 'input-sanitization' });

		try {
			// Basic sanitization: trim whitespace, limit length
			const sanitized: CoreMessage[] = messages.map((msg) => ({
				role: msg.role,
				content:
					typeof msg.content === 'string'
						? msg.content.trim().slice(0, 100000) // 100k char limit
						: msg.content
			})) as CoreMessage[];

			sanitizeSpan?.end({ metadata: { messageCount: sanitized.length } });
			return sanitized;
		} catch (error) {
			sanitizeSpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
			throw error;
		}
	}

	private async fetchPromptHook(
		options: ObservableOptions,
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<CoreMessage[]> {
		if (!this.langfuse || !options.promptName) {
			return options.messages;
		}

		const promptSpan = span?.span({ name: 'fetch-prompt-langfuse' });

		try {
			const prompt = await this.langfuse.getPrompt(
				options.promptName,
				options.promptVersion === 'production' || options.promptVersion === undefined
					? undefined
					: options.promptVersion
			);

			// Convert Langfuse prompt to CoreMessage format
			const messages: CoreMessage[] = [
				{
					role: 'user',
					content: prompt.prompt
				}
			];

			promptSpan?.end({
				output: { promptName: options.promptName, version: prompt.version },
				metadata: { promptVersion: prompt.version }
			});

			// Link prompt to trace
			span?.span({
				name: 'prompt-link',
				metadata: {
					promptName: options.promptName,
					promptVersion: prompt.version
				}
			});

			return messages;
		} catch (error) {
			promptSpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
			// Fallback to provided messages
			return options.messages;
		}
	}

	private async cacheCheckHook(
		options: ObservableOptions,
		messages: CoreMessage[],
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<ObservableResult | null> {
		if (options.enableCache === false) return null;

		const cacheSpan = span?.span({ name: 'cache-check' });

		try {
			const cacheKey = this.generateCacheKey(options, messages);
			const entry = this.cache.get(cacheKey);

			if (!entry) {
				cacheSpan?.end({ metadata: { hit: false } });
				return null;
			}

			// Check TTL
			const age = (Date.now() - entry.timestamp) / 1000;
			if (age > entry.ttl) {
				this.cache.delete(cacheKey);
				cacheSpan?.end({ metadata: { hit: false, reason: 'expired' } });
				return null;
			}

			cacheSpan?.end({ metadata: { hit: true, age } });

			return {
				content: entry.content,
				model: entry.model,
				usage: entry.usage,
				cost: 0, // Cached responses have zero cost
				cached: true,
				cacheKey,
				latencyMs: 0
			};
		} catch (error) {
			cacheSpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
			return null;
		}
	}

	// ============================================================================
	// POST-CALL HOOKS
	// ============================================================================

	private async recordUsageHook(
		options: ObservableOptions,
		result: Pick<ObservableResult, 'model' | 'usage' | 'cost' | 'cached'>,
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<void> {
		const recordSpan = span?.span({ name: 'record-usage' });

		try {
			await recordUsage({
				userId: options.userId,
				model: result.model,
				provider: getProviderFromModel(result.model),
				promptTokens: result.usage.promptTokens,
				completionTokens: result.usage.completionTokens,
				totalTokens: result.usage.totalTokens,
				costCents: result.cost,
				purpose: options.purpose,
				jobId: options.jobId,
				traceId: options.traceId,
				cached: result.cached,
				metadata: options.metadata
			});

			recordSpan?.end({ metadata: { cost: result.cost } });
		} catch (error) {
			recordSpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
			// Don't throw - usage recording shouldn't block response
		}
	}

	private async qualityScoreHook(
		result: Pick<ObservableResult, 'content'>,
		options: ObservableOptions,
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<number> {
		const qualitySpan = span?.span({ name: 'quality-scoring' });

		try {
			// Simple heuristic-based quality scoring (0-100)
			let score = 50; // Baseline

			// Length check (reasonable length)
			if (result.content.length > 100 && result.content.length < 10000) score += 20;

			// Coherence check (basic - no repeated phrases)
			const words = result.content.split(/\s+/);
			const uniqueWords = new Set(words);
			const uniqueRatio = uniqueWords.size / words.length;
			if (uniqueRatio > 0.5) score += 20;

			// Structure check (has paragraphs/sections)
			if (result.content.includes('\n\n')) score += 10;

			qualitySpan?.end({ output: { score } });
			return Math.min(100, score);
		} catch (error) {
			qualitySpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
			return 50; // Default neutral score
		}
	}

	private async cacheStoreHook(
		options: ObservableOptions,
		messages: CoreMessage[],
		result: Pick<ObservableResult, 'content' | 'model' | 'usage'>,
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>
	): Promise<void> {
		const cacheSpan = span?.span({ name: 'cache-store' });

		try {
			const cacheKey = this.generateCacheKey(options, messages);
			const ttl = options.cacheTTL || this.getDefaultTTL(options.purpose || 'general');

			const entry: CacheEntry = {
				content: result.content,
				usage: result.usage,
				model: result.model,
				timestamp: Date.now(),
				ttl,
				metadata: {
					purpose: options.purpose,
					temperature: options.temperature
				}
			};

			this.cache.set(cacheKey, entry);

			cacheSpan?.end({ metadata: { cacheKey, ttl } });
		} catch (error) {
			cacheSpan?.end({ level: 'ERROR', statusMessage: (error as Error).message });
		}
	}

	// ============================================================================
	// LLM EXECUTION WITH RETRY
	// ============================================================================

	private async executeWithRetry(
		options: ObservableOptions,
		messages: CoreMessage[],
		span?: ReturnType<NonNullable<typeof this.langfuse>['span']>,
		traceId?: string
	): Promise<Pick<ObservableResult, 'content' | 'model' | 'usage' | 'cost'>> {
		const maxRetries = options.maxRetries || 3;
		const retryDelay = options.retryDelay || 1000;

		let lastError: Error | null = null;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const attemptSpan = span?.span({
				name: `llm-call-attempt-${attempt + 1}`,
				metadata: { attempt: attempt + 1 }
			});

			try {
				const result = await generateText({
					model: getModelProvider(options.model),
					messages,
					maxTokens: options.maxTokens,
					temperature: options.temperature,
					topP: options.topP,
					frequencyPenalty: options.frequencyPenalty,
					presencePenalty: options.presencePenalty
				});

				const usage = result.usage || {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0
				};
				const cost = calculateCost(options.model, usage.promptTokens, usage.completionTokens);

				attemptSpan?.end({
					output: result.text,
					metadata: { success: true, cost }
				});

				return {
					content: result.text,
					model: options.model,
					usage,
					cost
				};
			} catch (error) {
				lastError = error instanceof Error ? error : new Error('Unknown error');
				attemptSpan?.end({
					level: 'ERROR',
					statusMessage: lastError.message
				});

				// Exponential backoff
				if (attempt < maxRetries - 1) {
					const delay = retryDelay * Math.pow(2, attempt);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw lastError || new Error('Max retries exceeded');
	}

	// ============================================================================
	// HELPER METHODS
	// ============================================================================

	private generateCacheKey(options: ObservableOptions, messages: CoreMessage[]): string {
		// Deterministic hash: model + temperature + messages
		const normalizedMessages = messages.map((m) => ({
			role: m.role,
			content: typeof m.content === 'string' ? m.content.trim() : m.content
		}));

		const keyData = {
			model: options.model,
			temperature: options.temperature || 0.7,
			maxTokens: options.maxTokens || 4096,
			messages: normalizedMessages,
			purpose: options.purpose
		};

		const hash = createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
		return `${options.cacheNamespace || options.model}:${hash}`;
	}

	private getDefaultTTL(purpose: string): number {
		return this.DEFAULT_CACHE_TTLS[purpose] || this.DEFAULT_CACHE_TTLS.general;
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	}

	/**
	 * Clear expired cache entries
	 */
	public pruneCache(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			const age = (now - entry.timestamp) / 1000;
			if (age > entry.ttl) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats(): {
		size: number;
		hitRate: number;
		totalEntries: number;
	} {
		return {
			size: this.cache.size,
			hitRate: 0, // Would need to track hits/misses
			totalEntries: this.cache.size
		};
	}
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let defaultClient: ObservableAIClient | null = null;

export function getObservableClient(langfuse?: Langfuse): ObservableAIClient {
	if (!defaultClient) {
		defaultClient = new ObservableAIClient(langfuse);
	}
	return defaultClient;
}
