// =============================================================================
// Content Generator Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult } from '../types';
import { complete, completeStream } from '../../llm/client';
import type { Model } from '../../llm/client';

export interface ContentGenerateInput {
	templateType: 'resume_section' | 'cover_paragraph' | 'summary' | 'bullet_point' | 'custom';
	context: {
		job?: { title: string; company: string; description?: string };
		profile?: { name: string; headline?: string; skills?: string[] };
		section?: string;
		tone?: 'formal' | 'conversational' | 'enthusiastic';
		maxLength?: number;
	};
	customPrompt?: string;
	streaming?: boolean;
}

export interface ContentGenerateOutput {
	content: string;
	alternatives?: string[];
	metadata: {
		wordCount: number;
		model: string;
		costCents: number;
	};
}

/**
 * Content Generator Tool
 * Generates various types of content for resumes and cover letters
 */
export const ContentGeneratorTool: ToolDefinition<ContentGenerateInput, ContentGenerateOutput> = {
	id: 'content-generator',
	name: 'Content Generator',
	description:
		'Generate content for resumes and cover letters including sections, ' +
		'paragraphs, summaries, and bullet points.',
	inputSchema: {
		type: 'object',
		properties: {
			templateType: {
				type: 'string',
				enum: ['resume_section', 'cover_paragraph', 'summary', 'bullet_point', 'custom'],
				description: 'Type of content to generate'
			},
			context: {
				type: 'object',
				description: 'Context for content generation',
				properties: {
					job: { type: 'object', description: 'Target job information' },
					profile: { type: 'object', description: 'Candidate profile' },
					section: { type: 'string', description: 'Section being generated' },
					tone: { type: 'string', enum: ['formal', 'conversational', 'enthusiastic'] },
					maxLength: { type: 'number', description: 'Maximum word count' }
				}
			},
			customPrompt: { type: 'string', description: 'Custom prompt for custom template type' },
			streaming: { type: 'boolean', description: 'Whether to stream the response' }
		},
		required: ['templateType', 'context']
	},

	async execute(
		input: ContentGenerateInput,
		context: ToolContext
	): Promise<ToolResult<ContentGenerateOutput>> {
		const startTime = Date.now();

		try {
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Generation cancelled',
					durationMs: Date.now() - startTime
				};
			}

			const { prompt, model, maxTokens } = buildGenerationConfig(input);

			const result = await complete({
				model,
				messages: [{ role: 'user', content: prompt }],
				maxTokens,
				temperature: getToneTemperature(input.context.tone),
				userId: context.userId,
				metadata: { purpose: `content-${input.templateType}` }
			});

			const content = cleanGeneratedContent(result.content);
			const alternatives = await generateAlternatives(input, context, content);

			return {
				success: true,
				data: {
					content,
					alternatives,
					metadata: {
						wordCount: content.split(/\s+/).length,
						model: result.model,
						costCents: result.cost
					}
				},
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Generation failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

interface GenerationConfig {
	prompt: string;
	model: Model;
	maxTokens: number;
}

function buildGenerationConfig(input: ContentGenerateInput): GenerationConfig {
	const { templateType, context, customPrompt } = input;

	let prompt: string;
	let model: Model = 'gpt-4o-mini';
	let maxTokens = 500;

	switch (templateType) {
		case 'resume_section':
			prompt = buildResumeSectionPrompt(context);
			model = 'claude-3-5-sonnet-20241022';
			maxTokens = 1000;
			break;

		case 'cover_paragraph':
			prompt = buildCoverParagraphPrompt(context);
			model = 'gpt-4o';
			maxTokens = 400;
			break;

		case 'summary':
			prompt = buildSummaryPrompt(context);
			model = 'claude-3-haiku-20240307';
			maxTokens = 200;
			break;

		case 'bullet_point':
			prompt = buildBulletPointPrompt(context);
			model = 'gemini-1.5-flash';
			maxTokens = 100;
			break;

		case 'custom':
			if (!customPrompt) {
				throw new Error('Custom prompt required for custom template type');
			}
			prompt = customPrompt;
			model = 'gpt-4o-mini';
			maxTokens = context.maxLength ? Math.ceil(context.maxLength * 1.5) : 500;
			break;

		default:
			throw new Error(`Unknown template type: ${templateType}`);
	}

	return { prompt, model, maxTokens };
}

function buildResumeSectionPrompt(context: ContentGenerateInput['context']): string {
	const { job, profile, section } = context;

	return `Generate a professional ${section || 'experience'} section for a resume.

${job ? `TARGET POSITION: ${job.title} at ${job.company}` : ''}
${profile ? `CANDIDATE: ${profile.name}${profile.headline ? ` - ${profile.headline}` : ''}` : ''}
${profile?.skills ? `KEY SKILLS: ${profile.skills.slice(0, 10).join(', ')}` : ''}

Guidelines:
- Use strong action verbs (Led, Developed, Implemented, Achieved)
- Include quantifiable achievements where possible
- Keep bullet points concise (1-2 lines each)
- Focus on impact and results
- Tailor to the target position if provided

Generate the ${section || 'experience'} section in clean markdown format.`;
}

function buildCoverParagraphPrompt(context: ContentGenerateInput['context']): string {
	const { job, profile, section, tone } = context;

	const toneInstructions = {
		formal: 'Use a professional, formal tone',
		conversational: 'Use a warm, conversational yet professional tone',
		enthusiastic: 'Use an enthusiastic, energetic tone while remaining professional'
	};

	return `Write a ${section || 'opening'} paragraph for a cover letter.

${job ? `POSITION: ${job.title} at ${job.company}` : ''}
${profile ? `CANDIDATE: ${profile.name}` : ''}
${tone ? toneInstructions[tone] : toneInstructions.formal}

Guidelines:
- Keep to 3-4 sentences
- ${section === 'opening' ? 'Hook the reader immediately with a compelling opening' : ''}
- ${section === 'closing' ? 'Include a clear call to action' : ''}
- Be specific, avoid generic statements
- Show genuine interest in the company/role

Write only the paragraph, no labels or headers.`;
}

function buildSummaryPrompt(context: ContentGenerateInput['context']): string {
	const { profile, job } = context;

	return `Write a professional summary (2-3 sentences) for:

${profile ? `NAME: ${profile.name}` : ''}
${profile?.headline ? `CURRENT ROLE: ${profile.headline}` : ''}
${profile?.skills ? `KEY SKILLS: ${profile.skills.slice(0, 8).join(', ')}` : ''}
${job ? `TARGET ROLE: ${job.title}` : ''}

Guidelines:
- Lead with years of experience or key expertise
- Highlight 2-3 most relevant skills or achievements
- Include a value proposition
- Keep it impactful and concise

Write only the summary, no labels.`;
}

function buildBulletPointPrompt(context: ContentGenerateInput['context']): string {
	const { job, section } = context;

	return `Write a single impactful bullet point for a resume ${section || 'experience'} section.

${job ? `TARGET ROLE: ${job.title}` : ''}
${section ? `CONTEXT: ${section}` : ''}

Guidelines:
- Start with a strong action verb
- Include a quantifiable result if possible
- Keep to one line (max 15 words)
- Focus on impact, not just responsibilities

Write only the bullet point (starting with -), no explanations.`;
}

function getToneTemperature(tone?: 'formal' | 'conversational' | 'enthusiastic'): number {
	switch (tone) {
		case 'formal':
			return 0.5;
		case 'conversational':
			return 0.7;
		case 'enthusiastic':
			return 0.8;
		default:
			return 0.6;
	}
}

function cleanGeneratedContent(content: string): string {
	// Remove any leading/trailing whitespace
	let cleaned = content.trim();

	// Remove markdown code blocks if present
	cleaned = cleaned.replace(/^```(?:markdown)?\n?/, '').replace(/\n?```$/, '');

	// Remove any "Here is..." or "Here's..." prefixes
	cleaned = cleaned.replace(/^(?:Here(?:'s| is)[^:]*:|Sure[^:]*:)\s*/i, '');

	return cleaned.trim();
}

async function generateAlternatives(
	input: ContentGenerateInput,
	context: ToolContext,
	_original: string
): Promise<string[] | undefined> {
	// Only generate alternatives for short content types
	if (!['bullet_point', 'summary'].includes(input.templateType)) {
		return undefined;
	}

	try {
		const { prompt, model, maxTokens } = buildGenerationConfig(input);
		const altPrompt = `${prompt}\n\nProvide 2 alternative versions, each on a new line.`;

		const result = await complete({
			model,
			messages: [{ role: 'user', content: altPrompt }],
			maxTokens: maxTokens * 2,
			temperature: 0.9,
			userId: context.userId,
			metadata: { purpose: `content-${input.templateType}-alternatives` }
		});

		const alternatives = result.content
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 10)
			.slice(0, 2);

		return alternatives.length > 0 ? alternatives : undefined;
	} catch {
		return undefined;
	}
}
