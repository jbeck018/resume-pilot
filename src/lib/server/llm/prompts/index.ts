// =============================================================================
// Langfuse Prompts Module
// =============================================================================

export { seedPrompts, PROMPTS } from './seed-prompts';

// Prompt name constants for type safety
export const PROMPT_NAMES = {
	// Resume Agent
	RESUME_GENERATION: 'resume-generation',
	RESUME_IMPROVEMENT: 'resume-improvement',

	// Cover Letter Agent
	COVER_LETTER_GENERATION: 'cover-letter-generation',

	// Job Match Agent
	JOB_MATCH_ANALYSIS: 'job-match-analysis',

	// Profile Agent
	PROFILE_ANALYSIS: 'profile-analysis',

	// Tools
	SKILL_EXTRACTION: 'skill-extraction',
	QUALITY_SCORING: 'quality-scoring',
	COMPANY_RESEARCH_SYNTHESIS: 'company-research-synthesis',
	CONTENT_GENERATION: 'content-generation'
} as const;

export type PromptName = (typeof PROMPT_NAMES)[keyof typeof PROMPT_NAMES];
