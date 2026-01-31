/**
 * Smart Context Selection Utility
 *
 * Uses skill matching to intelligently select the most relevant
 * content for resume generation, reducing context length while
 * preserving the most important information.
 */

import type { ProfileInfo, ExperienceItem, EducationItem, ExtractedSkill } from '../types';

/**
 * Configuration for context selection
 */
export interface ContextSelectionConfig {
	/** Maximum characters for job description (default: 6000) */
	maxJobDescriptionLength?: number;
	/** Maximum number of experiences to include (default: 6) */
	maxExperiences?: number;
	/** Maximum characters per experience description (default: 800) */
	maxExperienceDescriptionLength?: number;
	/** Maximum skills to include (default: 40) */
	maxSkills?: number;
	/** Maximum education entries (default: 3) */
	maxEducation?: number;
	/** Minimum relevance score to include experience (0-1, default: 0.2) */
	minRelevanceScore?: number;
}

const DEFAULT_CONFIG: Required<ContextSelectionConfig> = {
	maxJobDescriptionLength: 6000,
	maxExperiences: 6,
	maxExperienceDescriptionLength: 800,
	maxSkills: 40,
	maxEducation: 3,
	minRelevanceScore: 0.2
};

/**
 * Experience with relevance score
 */
interface ScoredExperience extends ExperienceItem {
	relevanceScore: number;
	matchedSkills: string[];
}

/**
 * Result of smart context selection
 */
export interface SmartContextResult {
	/** Selected experiences sorted by relevance */
	experiences: ExperienceItem[];
	/** Skills prioritized by relevance to job */
	skills: string[];
	/** Optimized job description */
	jobDescription: string;
	/** Education limited to max */
	education: EducationItem[];
	/** Statistics about selection */
	stats: {
		originalExperienceCount: number;
		selectedExperienceCount: number;
		originalSkillCount: number;
		selectedSkillCount: number;
		jobDescriptionTruncated: boolean;
		averageRelevanceScore: number;
	};
}

/**
 * Intelligently select the most relevant content for resume generation
 *
 * @param profile - Candidate profile
 * @param extractedSkills - Skills extracted from job description
 * @param jobDescription - Full job description
 * @param config - Selection configuration
 * @returns Optimized content with selection stats
 */
export function selectRelevantContent(
	profile: ProfileInfo,
	extractedSkills: ExtractedSkill[],
	jobDescription: string,
	config: ContextSelectionConfig = {}
): SmartContextResult {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	// Build a set of required and preferred skills from job
	const requiredSkills = new Set(
		extractedSkills.filter((s) => s.importance === 'required').map((s) => s.name.toLowerCase())
	);
	const preferredSkills = new Set(
		extractedSkills.filter((s) => s.importance === 'preferred').map((s) => s.name.toLowerCase())
	);
	const allJobSkills = new Set([...requiredSkills, ...preferredSkills]);

	// Score and sort experiences by relevance
	const scoredExperiences = scoreExperiences(
		profile.experience || [],
		requiredSkills,
		preferredSkills
	);

	// Select top experiences above minimum relevance
	const selectedExperiences = scoredExperiences
		.filter((exp) => exp.relevanceScore >= cfg.minRelevanceScore)
		.slice(0, cfg.maxExperiences)
		.map(({ relevanceScore, matchedSkills, ...exp }) => ({
			...exp,
			// Truncate long descriptions intelligently
			description: smartTruncate(exp.description || '', cfg.maxExperienceDescriptionLength)
		}));

	// If we don't have enough experiences, include low-relevance ones too
	if (selectedExperiences.length < Math.min(3, cfg.maxExperiences)) {
		const additionalExps = scoredExperiences
			.filter((exp) => exp.relevanceScore < cfg.minRelevanceScore)
			.slice(0, cfg.maxExperiences - selectedExperiences.length);
		selectedExperiences.push(
			...additionalExps.map(({ relevanceScore, matchedSkills, ...exp }) => ({
				...exp,
				description: smartTruncate(exp.description || '', cfg.maxExperienceDescriptionLength / 2)
			}))
		);
	}

	// Prioritize skills that appear in job description
	const profileSkills = profile.skills || [];
	const prioritizedSkills = [
		// First: skills that match job requirements
		...profileSkills.filter((s) => allJobSkills.has(s.toLowerCase())),
		// Then: other skills
		...profileSkills.filter((s) => !allJobSkills.has(s.toLowerCase()))
	].slice(0, cfg.maxSkills);

	// Optimize job description - keep key sections
	const optimizedJobDescription = optimizeJobDescription(
		jobDescription,
		cfg.maxJobDescriptionLength
	);

	// Calculate average relevance score
	const avgRelevance =
		scoredExperiences.length > 0
			? scoredExperiences.reduce((sum, e) => sum + e.relevanceScore, 0) / scoredExperiences.length
			: 0;

	return {
		experiences: selectedExperiences,
		skills: prioritizedSkills,
		jobDescription: optimizedJobDescription,
		education: (profile.education || []).slice(0, cfg.maxEducation),
		stats: {
			originalExperienceCount: (profile.experience || []).length,
			selectedExperienceCount: selectedExperiences.length,
			originalSkillCount: profileSkills.length,
			selectedSkillCount: prioritizedSkills.length,
			jobDescriptionTruncated: optimizedJobDescription.length < jobDescription.length,
			averageRelevanceScore: avgRelevance
		}
	};
}

/**
 * Score experiences based on skill overlap with job requirements
 */
function scoreExperiences(
	experiences: ExperienceItem[],
	requiredSkills: Set<string>,
	preferredSkills: Set<string>
): ScoredExperience[] {
	return experiences.map((exp) => {
		const expText = `${exp.title || ''} ${exp.company || ''} ${exp.description || ''} ${(exp.skills || []).join(' ')}`.toLowerCase();

		// Check for skill matches
		const matchedRequired: string[] = [];
		const matchedPreferred: string[] = [];

		for (const skill of requiredSkills) {
			if (expText.includes(skill)) {
				matchedRequired.push(skill);
			}
		}
		for (const skill of preferredSkills) {
			if (expText.includes(skill)) {
				matchedPreferred.push(skill);
			}
		}

		// Calculate relevance score (required skills worth more)
		const requiredScore = matchedRequired.length * 0.15;
		const preferredScore = matchedPreferred.length * 0.08;

		// Boost for recent experience
		const recencyBoost = exp.current ? 0.1 : 0;

		// Cap at 1.0
		const relevanceScore = Math.min(1, requiredScore + preferredScore + recencyBoost);

		return {
			...exp,
			relevanceScore,
			matchedSkills: [...matchedRequired, ...matchedPreferred]
		};
	}).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Optimize job description by keeping important sections
 */
function optimizeJobDescription(description: string, maxLength: number): string {
	if (!description || description.length <= maxLength) {
		return description || '';
	}

	// Try to keep complete sections by splitting on common headers
	const sections = description.split(/\n(?=(?:#|##|\*\*|Requirements|Responsibilities|Qualifications|About|What you|Who you|Your role))/i);

	let result = '';
	const priorities = [
		'Requirements', 'Qualifications', 'Required', 'Must have',
		'Responsibilities', 'What you', 'Your role',
		'About', 'Who you', 'Preferred', 'Nice to have'
	];

	// First pass: add high-priority sections
	for (const priority of priorities) {
		const matchingSection = sections.find((s) =>
			s.toLowerCase().includes(priority.toLowerCase())
		);
		if (matchingSection && result.length + matchingSection.length < maxLength) {
			result += (result ? '\n\n' : '') + matchingSection.trim();
		}
	}

	// If we have space, add remaining content
	if (result.length < maxLength * 0.7) {
		const remaining = sections
			.filter((s) => !result.includes(s.trim()))
			.join('\n\n');
		const spaceLeft = maxLength - result.length - 100;
		if (spaceLeft > 200) {
			result += '\n\n' + remaining.slice(0, spaceLeft);
		}
	}

	return result || smartTruncate(description, maxLength);
}

/**
 * Truncate text intelligently at sentence boundaries
 */
function smartTruncate(text: string, maxLength: number): string {
	if (!text || text.length <= maxLength) {
		return text || '';
	}

	// Try to break at sentence boundary
	const truncated = text.slice(0, maxLength);
	const lastSentenceEnd = Math.max(
		truncated.lastIndexOf('. '),
		truncated.lastIndexOf('.\n'),
		truncated.lastIndexOf('! '),
		truncated.lastIndexOf('? ')
	);

	if (lastSentenceEnd > maxLength * 0.7) {
		return truncated.slice(0, lastSentenceEnd + 1);
	}

	// Fall back to word boundary
	const lastSpace = truncated.lastIndexOf(' ');
	if (lastSpace > maxLength * 0.8) {
		return truncated.slice(0, lastSpace) + '...';
	}

	return truncated + '...';
}

/**
 * Estimate token count (rough approximation)
 * Average English word is ~4 characters, ~1.3 tokens per word
 */
export function estimateTokenCount(text: string): number {
	if (!text) return 0;
	const words = text.split(/\s+/).length;
	return Math.ceil(words * 1.3);
}

/**
 * Check if content fits within token budget
 */
export function fitsTokenBudget(content: string, budget: number): boolean {
	return estimateTokenCount(content) <= budget;
}
