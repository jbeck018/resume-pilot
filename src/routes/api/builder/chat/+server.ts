/**
 * Resume Builder Chat API Endpoint
 *
 * POST /api/builder/chat
 * Streaming chat endpoint for interactive resume generation
 * Uses AI SDK for SSE streaming responses
 */

import { streamText, type CoreMessage } from 'ai';
import { getAnthropicProvider } from '$lib/server/llm';
import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

const ChatRequestSchema = z.object({
	messages: z.array(
		z.object({
			role: z.enum(['user', 'assistant']),
			content: z.string()
		})
	),
	jobInfo: z
		.object({
			title: z.string().optional(),
			company: z.string().optional(),
			description: z.string().optional(),
			requirements: z.array(z.string()).optional(),
			skills: z.array(z.string()).optional()
		})
		.optional(),
	profileSummary: z.string().optional()
});

const SYSTEM_PROMPT = `You are an expert resume writer and career coach helping users create tailored, ATS-optimized resumes. You work conversationally to understand the user's background and craft compelling resume content.

Your approach:
1. Ask clarifying questions to understand their experience deeply
2. Suggest improvements and rewrites that highlight achievements
3. Use action verbs and quantified results where possible
4. Ensure content matches the job requirements
5. Keep responses focused and actionable

Guidelines:
- Be concise but helpful
- Ask one question at a time
- Provide specific suggestions with examples
- Focus on impact and achievements over duties
- Use the job description context to tailor recommendations
- When providing resume content, format it clearly

You have access to the job description and user's profile summary in the context.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	// Authentication required
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const validated = ChatRequestSchema.safeParse(body);

		if (!validated.success) {
			return json(
				{
					error: 'Invalid request',
					details: validated.error.issues
				},
				{ status: 400 }
			);
		}

		const { messages, jobInfo, profileSummary } = validated.data;

		// Build context for the AI
		let contextPrompt = SYSTEM_PROMPT;

		if (jobInfo) {
			contextPrompt += `\n\n## Job Context
Title: ${jobInfo.title || 'Not specified'}
Company: ${jobInfo.company || 'Not specified'}
${jobInfo.description ? `Description: ${jobInfo.description.slice(0, 2000)}` : ''}
${jobInfo.requirements?.length ? `Requirements: ${jobInfo.requirements.join(', ')}` : ''}
${jobInfo.skills?.length ? `Key Skills: ${jobInfo.skills.join(', ')}` : ''}`;
		}

		if (profileSummary) {
			contextPrompt += `\n\n## User Profile Summary
${profileSummary.slice(0, 2000)}`;
		}

		const anthropic = getAnthropicProvider();

		// Convert messages to CoreMessage format
		const coreMessages: CoreMessage[] = messages.map((m) => ({
			role: m.role,
			content: m.content
		}));

		// Stream the response
		const result = streamText({
			model: anthropic('claude-sonnet-4-20250514'),
			system: contextPrompt,
			messages: coreMessages,
			maxTokens: 2048,
			temperature: 0.7
		});

		// Return as SSE data stream
		return result.toDataStreamResponse();
	} catch (error) {
		console.error('Chat API error:', error);
		return json(
			{
				error: 'Failed to process chat request',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
