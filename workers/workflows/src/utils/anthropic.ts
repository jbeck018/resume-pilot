// Anthropic client factory for Cloudflare Workflows

import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../types';

/**
 * Creates an Anthropic client, optionally routing through Cloudflare AI Gateway
 */
export function createAnthropicClient(env: Env): Anthropic {
	const baseURL = env.CLOUDFLARE_AI_GATEWAY_URL
		? `${env.CLOUDFLARE_AI_GATEWAY_URL}/anthropic`
		: undefined;

	return new Anthropic({
		apiKey: env.ANTHROPIC_API_KEY,
		baseURL
	});
}

/**
 * Generate text using Claude with standard options
 */
export async function generateWithClaude(
	env: Env,
	options: {
		model?: string;
		messages: Anthropic.MessageParam[];
		maxTokens?: number;
		temperature?: number;
		system?: string;
	}
): Promise<string> {
	const client = createAnthropicClient(env);

	const response = await client.messages.create({
		model: options.model || 'claude-sonnet-4-5-20250929',
		max_tokens: options.maxTokens || 4096,
		temperature: options.temperature || 0.3,
		system: options.system,
		messages: options.messages
	});

	// Extract text from response
	const textBlock = response.content.find(block => block.type === 'text');
	if (!textBlock || textBlock.type !== 'text') {
		throw new Error('No text response from Claude');
	}

	return textBlock.text;
}
