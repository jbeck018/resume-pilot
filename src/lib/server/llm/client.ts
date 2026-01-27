// LLM Client using Cloudflare AI Gateway + Vercel AI SDK + Langfuse
// Architecture: Request → Cloudflare AI Gateway (caching, analytics) → Provider APIs

import { generateText, streamText, type CoreMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Langfuse } from 'langfuse';
import { env } from '$env/dynamic/private';

// Environment variables
const CLOUDFLARE_AI_GATEWAY_URL = env.CLOUDFLARE_AI_GATEWAY_URL; // e.g., https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = env.OPENAI_API_KEY;
const GOOGLE_API_KEY = env.GOOGLE_API_KEY;
const LANGFUSE_PUBLIC_KEY = env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = env.LANGFUSE_SECRET_KEY;
const LANGFUSE_HOST = env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

// Initialize Langfuse for observability (lazy initialization)
let langfuseInstance: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
	if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
		return null;
	}
	if (!langfuseInstance) {
		langfuseInstance = new Langfuse({
			publicKey: LANGFUSE_PUBLIC_KEY,
			secretKey: LANGFUSE_SECRET_KEY,
			baseUrl: LANGFUSE_HOST
		});
	}
	return langfuseInstance;
}

// Create providers with Cloudflare AI Gateway (if configured)
function getAnthropicProvider() {
	const baseURL = CLOUDFLARE_AI_GATEWAY_URL
		? `${CLOUDFLARE_AI_GATEWAY_URL}/anthropic`
		: undefined;

	return createAnthropic({
		apiKey: ANTHROPIC_API_KEY,
		baseURL
	});
}

function getOpenAIProvider() {
	const baseURL = CLOUDFLARE_AI_GATEWAY_URL
		? `${CLOUDFLARE_AI_GATEWAY_URL}/openai`
		: undefined;

	return createOpenAI({
		apiKey: OPENAI_API_KEY,
		baseURL
	});
}

function getGoogleProvider() {
	const baseURL = CLOUDFLARE_AI_GATEWAY_URL
		? `${CLOUDFLARE_AI_GATEWAY_URL}/google-ai-studio`
		: undefined;

	return createGoogleGenerativeAI({
		apiKey: GOOGLE_API_KEY,
		baseURL
	});
}

export type Model =
	| 'claude-sonnet-4-5-20250929'
	| 'claude-3-5-haiku-20241022'
	| 'gpt-4o'
	| 'gpt-4o-mini'
	| 'gemini-1.5-pro'
	| 'gemini-1.5-flash';

export interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface CompletionOptions {
	model: Model;
	messages: Message[];
	maxTokens?: number;
	temperature?: number;
	// Tracking metadata
	userId?: string;
	jobId?: string;
	traceId?: string;
	metadata?: Record<string, string>;
}

export interface CompletionResult {
	content: string;
	model: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	cost: number; // Estimated cost in cents
	traceId?: string;
	cached?: boolean;
}

// Cost per 1M tokens (in cents) - 2025 pricing
const MODEL_COSTS: Record<Model, { input: number; output: number }> = {
	'claude-sonnet-4-5-20250929': { input: 300, output: 1500 },
	'claude-3-5-haiku-20241022': { input: 80, output: 400 },
	'gpt-4o': { input: 250, output: 1000 },
	'gpt-4o-mini': { input: 15, output: 60 },
	'gemini-1.5-pro': { input: 125, output: 500 },
	'gemini-1.5-flash': { input: 7.5, output: 30 }
};

export function getModelProvider(model: Model) {
	if (model.startsWith('claude')) {
		const provider = getAnthropicProvider();
		return provider(model);
	}
	if (model.startsWith('gpt')) {
		const provider = getOpenAIProvider();
		return provider(model);
	}
	if (model.startsWith('gemini')) {
		const provider = getGoogleProvider();
		return provider(model);
	}
	throw new Error(`Unknown model: ${model}`);
}

export async function complete(options: CompletionOptions): Promise<CompletionResult> {
	const {
		model,
		messages,
		maxTokens = 4096,
		temperature = 0.7,
		userId,
		jobId,
		traceId,
		metadata
	} = options;

	const langfuse = getLangfuse();
	const startTime = Date.now();

	// Create Langfuse trace for observability
	const trace = langfuse?.trace({
		id: traceId,
		name: 'llm-completion',
		userId,
		metadata: {
			model,
			jobId,
			...metadata
		}
	});

	const generation = trace?.generation({
		name: 'generate',
		model,
		input: messages,
		modelParameters: {
			maxTokens,
			temperature
		}
	});

	try {
		// Convert messages to AI SDK format
		const coreMessages: CoreMessage[] = messages.map((m) => ({
			role: m.role,
			content: m.content
		}));

		// Call the model via AI SDK (routed through Cloudflare AI Gateway if configured)
		const result = await generateText({
			model: getModelProvider(model),
			messages: coreMessages,
			maxTokens,
			temperature,
			// Pass metadata for Cloudflare AI Gateway custom metadata
			...(jobId
				? {
						experimental_providerMetadata: {
							cloudflare: {
								cacheKey: `job-${jobId}-${model}`,
								metadata: {
									userId: userId || 'unknown',
									jobId: jobId,
									purpose: metadata?.purpose || 'generation'
								}
							}
						}
					}
				: {})
		});

		const usage = result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
		const cost = calculateCost(model, usage.promptTokens, usage.completionTokens);
		const duration = Date.now() - startTime;

		// Record generation in Langfuse
		generation?.end({
			output: result.text,
			usage: {
				input: usage.promptTokens,
				output: usage.completionTokens,
				total: usage.totalTokens,
				unit: 'TOKENS'
			},
			metadata: {
				cost,
				duration,
				cached: false // AI Gateway caching info not available in response yet
			}
		});

		// Flush Langfuse events (non-blocking)
		langfuse?.flushAsync().catch(() => {
		// Langfuse flush error - non-critical, events may be lost but won't impact the response
	});

		return {
			content: result.text,
			model: model,
			usage: {
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
				totalTokens: usage.totalTokens
			},
			cost,
			traceId: trace?.id,
			cached: false
		};
	} catch (error) {
		// Record error in Langfuse
		generation?.end({
			statusMessage: error instanceof Error ? error.message : 'Unknown error',
			level: 'ERROR'
		});
		langfuse?.flushAsync().catch(() => {
		// Langfuse flush error - non-critical, events may be lost but won't impact the response
	});

		throw error;
	}
}

// Streaming completion for real-time UI updates
export async function* completeStream(options: CompletionOptions): AsyncGenerator<string, CompletionResult> {
	const {
		model,
		messages,
		maxTokens = 4096,
		temperature = 0.7,
		userId,
		jobId,
		metadata
	} = options;

	const langfuse = getLangfuse();
	const startTime = Date.now();

	const trace = langfuse?.trace({
		name: 'llm-stream',
		userId,
		metadata: { model, jobId, ...metadata }
	});

	const generation = trace?.generation({
		name: 'stream',
		model,
		input: messages
	});

	try {
		const coreMessages: CoreMessage[] = messages.map((m) => ({
			role: m.role,
			content: m.content
		}));

		const result = streamText({
			model: getModelProvider(model),
			messages: coreMessages,
			maxTokens,
			temperature
		});

		let fullContent = '';

		for await (const chunk of result.textStream) {
			fullContent += chunk;
			yield chunk;
		}

		const finalResult = await result;
		// Await the usage promise
		const usageData = await finalResult.usage;
		const usage = usageData || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
		const cost = calculateCost(model, usage.promptTokens, usage.completionTokens);
		const duration = Date.now() - startTime;

		generation?.end({
			output: fullContent,
			usage: {
				input: usage.promptTokens,
				output: usage.completionTokens,
				total: usage.totalTokens,
				unit: 'TOKENS'
			},
			metadata: { cost, duration }
		});

		langfuse?.flushAsync().catch(() => {
		// Langfuse flush error - non-critical, events may be lost but won't impact the response
	});

		return {
			content: fullContent,
			model,
			usage: {
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
				totalTokens: usage.totalTokens
			},
			cost,
			traceId: trace?.id
		};
	} catch (error) {
		generation?.end({
			statusMessage: error instanceof Error ? error.message : 'Unknown error',
			level: 'ERROR'
		});
		langfuse?.flushAsync().catch(() => {
		// Langfuse flush error - non-critical, events may be lost but won't impact the response
	});
		throw error;
	}
}

export function calculateCost(model: Model, inputTokens: number, outputTokens: number): number {
	const costs = MODEL_COSTS[model] || { input: 0, output: 0 };
	return Math.ceil((inputTokens * costs.input + outputTokens * costs.output) / 1_000_000);
}

// Helper to select the best model based on task complexity
export function selectModel(
	task: 'resume' | 'cover_letter' | 'summary' | 'embedding' | 'job_match'
): Model {
	switch (task) {
		case 'resume':
			// High quality needed for resume generation
			return 'claude-sonnet-4-5-20250929';
		case 'cover_letter':
			// Good quality, slightly cheaper
			return 'gpt-4o';
		case 'job_match':
			// Fast and cheap for matching/scoring
			return 'gemini-1.5-flash';
		case 'summary':
			// Fast for simple summaries
			return 'claude-3-5-haiku-20241022';
		default:
			return 'gpt-4o-mini';
	}
}

// Shutdown Langfuse gracefully
export async function shutdown(): Promise<void> {
	if (langfuseInstance) {
		await langfuseInstance.shutdownAsync();
	}
}
