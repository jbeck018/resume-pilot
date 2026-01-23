// =============================================================================
// Skill Extractor Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult, ExtractedSkill, SkillCategory } from '../types';
import { complete } from '../../llm/client';

export interface SkillExtractInput {
	text: string;
	context: 'job_description' | 'resume' | 'profile';
}

export interface SkillExtractOutput {
	skills: ExtractedSkill[];
	categories: Record<SkillCategory, ExtractedSkill[]>;
	requiredCount: number;
	preferredCount: number;
}

/**
 * Skill Extractor Tool
 * Extracts and categorizes skills from job descriptions, resumes, or profiles
 */
export const SkillExtractorTool: ToolDefinition<SkillExtractInput, SkillExtractOutput> = {
	id: 'skill-extractor',
	name: 'Skill Extractor',
	description:
		'Extract skills from job descriptions, resumes, or profiles. ' +
		'Categorizes skills and identifies importance levels.',
	inputSchema: {
		type: 'object',
		properties: {
			text: { type: 'string', description: 'Text to extract skills from' },
			context: {
				type: 'string',
				enum: ['job_description', 'resume', 'profile'],
				description: 'Context of the text'
			}
		},
		required: ['text', 'context']
	},

	async execute(input: SkillExtractInput, context: ToolContext): Promise<ToolResult<SkillExtractOutput>> {
		const startTime = Date.now();

		try {
			// Check for abort
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Extraction cancelled',
					durationMs: Date.now() - startTime
				};
			}

			const prompt = buildExtractionPrompt(input);

			const result = await complete({
				model: 'gemini-1.5-flash',
				messages: [{ role: 'user', content: prompt }],
				maxTokens: 2000,
				temperature: 0.2,
				userId: context.userId,
				metadata: { purpose: 'skill-extraction' }
			});

			const extracted = parseExtractionResult(result.content);

			return {
				success: true,
				data: extracted,
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Extraction failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

function buildExtractionPrompt(input: SkillExtractInput): string {
	const contextPrompt =
		input.context === 'job_description'
			? 'This is a job description. Identify required vs preferred skills.'
			: input.context === 'resume'
				? 'This is a resume. Extract all skills the candidate possesses.'
				: 'This is a profile. Extract skills from experience descriptions.';

	return `Extract all skills from the following ${input.context.replace('_', ' ')}. ${contextPrompt}

TEXT:
${input.text}

Return a JSON array of skills with the following structure:
[
  {
    "name": "skill name (normalized, e.g., 'Python' not 'python programming')",
    "category": "one of: programming_language, framework, database, cloud, devops, soft_skill, methodology, tool, domain, certification, other",
    "importance": "one of: required, preferred, nice_to_have",
    "yearsRequired": number or null,
    "sourceText": "brief quote from source showing the skill"
  }
]

Guidelines:
- Normalize skill names (e.g., "JS" -> "JavaScript", "React.js" -> "React")
- For job descriptions: use "required" for explicit requirements, "preferred" for nice-to-haves
- For resumes/profiles: use "required" for primary skills, "preferred" for secondary
- Include years of experience if mentioned
- Keep sourceText brief (max 50 chars)

Return ONLY the JSON array, no other text.`;
}

function parseExtractionResult(content: string): SkillExtractOutput {
	const skills: ExtractedSkill[] = [];
	const categories: Record<SkillCategory, ExtractedSkill[]> = {
		programming_language: [],
		framework: [],
		database: [],
		cloud: [],
		devops: [],
		soft_skill: [],
		methodology: [],
		tool: [],
		domain: [],
		certification: [],
		other: []
	};

	try {
		// Try to find JSON array in response
		const jsonMatch = content.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]) as Array<{
				name: string;
				category: string;
				importance: string;
				yearsRequired?: number;
				sourceText?: string;
			}>;

			for (const item of parsed) {
				const skill: ExtractedSkill = {
					name: normalizeSkillName(item.name),
					category: validateCategory(item.category),
					importance: validateImportance(item.importance),
					yearsRequired: item.yearsRequired,
					sourceText: item.sourceText
				};

				skills.push(skill);
				categories[skill.category].push(skill);
			}
		}
	} catch (error) {
		console.error('Failed to parse skill extraction result:', error);
	}

	return {
		skills,
		categories,
		requiredCount: skills.filter((s) => s.importance === 'required').length,
		preferredCount: skills.filter((s) => s.importance === 'preferred').length
	};
}

function normalizeSkillName(name: string): string {
	const normalizations: Record<string, string> = {
		js: 'JavaScript',
		ts: 'TypeScript',
		'react.js': 'React',
		'reactjs': 'React',
		'vue.js': 'Vue',
		'vuejs': 'Vue',
		'node.js': 'Node.js',
		nodejs: 'Node.js',
		'express.js': 'Express',
		expressjs: 'Express',
		postgres: 'PostgreSQL',
		mongo: 'MongoDB',
		k8s: 'Kubernetes',
		aws: 'AWS',
		gcp: 'Google Cloud',
		'google cloud platform': 'Google Cloud'
	};

	const lower = name.toLowerCase().trim();
	return normalizations[lower] || name.trim();
}

function validateCategory(category: string): SkillCategory {
	const validCategories: SkillCategory[] = [
		'programming_language',
		'framework',
		'database',
		'cloud',
		'devops',
		'soft_skill',
		'methodology',
		'tool',
		'domain',
		'certification',
		'other'
	];

	const normalized = category.toLowerCase().replace(/\s/g, '_') as SkillCategory;
	return validCategories.includes(normalized) ? normalized : 'other';
}

function validateImportance(importance: string): 'required' | 'preferred' | 'nice_to_have' {
	const lower = importance.toLowerCase();
	if (lower === 'required' || lower === 'must_have' || lower === 'must have') return 'required';
	if (lower === 'preferred' || lower === 'nice_to_have' || lower === 'nice to have') return 'preferred';
	return 'nice_to_have';
}
