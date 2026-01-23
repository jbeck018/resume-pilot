/**
 * Resume Styles Registry
 * Central export point for all resume styles and style utilities
 */

import type {
	ResumeStyle,
	StyleSelectionContext,
	StyleRecommendation,
	Industry,
	ExperienceLevel
} from './types';

// Import all style definitions
import { classicStyle } from './styles/classic';
import { modernStyle } from './styles/modern';
import { creativeStyle } from './styles/creative';
import { executiveStyle } from './styles/executive';
import { technicalStyle } from './styles/technical';
import { academicStyle } from './styles/academic';
import { federalStyle } from './styles/federal';
import { entryLevelStyle } from './styles/entry-level';

// Re-export types
export type * from './types';

// ============================================================================
// Style Registry
// ============================================================================

/**
 * All available resume styles
 */
export const resumeStyles: ResumeStyle[] = [
	classicStyle,
	modernStyle,
	creativeStyle,
	executiveStyle,
	technicalStyle,
	academicStyle,
	federalStyle,
	entryLevelStyle
];

/**
 * Style lookup map for quick access by ID
 */
export const styleMap = new Map<string, ResumeStyle>(resumeStyles.map((style) => [style.id, style]));

/**
 * Get a style by its ID
 */
export function getStyle(styleId: string): ResumeStyle | undefined {
	return styleMap.get(styleId);
}

/**
 * Get the default style (classic is safe for most cases)
 */
export function getDefaultStyle(): ResumeStyle {
	return classicStyle;
}

/**
 * Get all non-premium styles
 */
export function getFreeStyles(): ResumeStyle[] {
	return resumeStyles.filter((style) => !style.premium);
}

/**
 * Get all premium styles
 */
export function getPremiumStyles(): ResumeStyle[] {
	return resumeStyles.filter((style) => style.premium);
}

/**
 * Get styles available for a subscription tier
 */
export function getStylesForTier(tier: 'free' | 'pro' | 'premium'): ResumeStyle[] {
	if (tier === 'premium') {
		return resumeStyles; // All styles
	}
	if (tier === 'pro') {
		return resumeStyles; // Pro gets all styles too
	}
	return getFreeStyles();
}

// ============================================================================
// Industry & Job Title Mapping
// ============================================================================

/**
 * Map job titles/keywords to industries
 */
const titleToIndustryMap: Record<string, Industry[]> = {
	// Tech & Engineering
	engineer: ['tech', 'software', 'engineering'],
	developer: ['tech', 'software', 'startup'],
	'software': ['tech', 'software', 'startup'],
	'data scientist': ['data', 'tech'],
	'data analyst': ['data', 'tech', 'corporate'],
	'machine learning': ['data', 'tech', 'research'],
	devops: ['tech', 'engineering', 'it'],
	sre: ['tech', 'engineering'],
	architect: ['tech', 'software', 'engineering'],
	frontend: ['tech', 'software'],
	backend: ['tech', 'software'],
	fullstack: ['tech', 'software'],
	cybersecurity: ['cybersecurity', 'it'],
	security: ['cybersecurity', 'it'],

	// Design & Creative
	designer: ['design', 'creative'],
	'ux': ['design', 'tech'],
	'ui': ['design', 'tech'],
	'graphic': ['design', 'creative', 'marketing'],
	creative: ['creative', 'design', 'marketing'],
	'art director': ['creative', 'marketing', 'media'],
	copywriter: ['creative', 'marketing', 'media'],

	// Marketing & Media
	marketing: ['marketing', 'media', 'creative'],
	'product manager': ['tech', 'startup', 'corporate'],
	'brand': ['marketing', 'creative'],
	'social media': ['marketing', 'media'],
	'content': ['marketing', 'media', 'creative'],
	'communications': ['marketing', 'corporate'],

	// Finance & Consulting
	analyst: ['finance', 'consulting', 'corporate'],
	consultant: ['consulting', 'corporate'],
	banker: ['finance', 'corporate'],
	accountant: ['finance', 'corporate'],
	'financial': ['finance', 'corporate'],
	auditor: ['finance', 'corporate'],

	// Legal
	attorney: ['legal'],
	lawyer: ['legal'],
	paralegal: ['legal'],
	'legal': ['legal', 'corporate'],

	// Executive & Leadership
	ceo: ['executive', 'leadership'],
	cfo: ['executive', 'leadership', 'finance'],
	cto: ['executive', 'leadership', 'tech'],
	coo: ['executive', 'leadership'],
	vp: ['executive', 'leadership'],
	'vice president': ['executive', 'leadership'],
	director: ['leadership', 'corporate'],
	president: ['executive', 'leadership'],
	'c-suite': ['executive', 'leadership'],

	// Academic & Research
	professor: ['academic', 'education', 'research'],
	researcher: ['academic', 'research'],
	scientist: ['research', 'academic'],
	'phd': ['academic', 'research'],
	postdoc: ['academic', 'research'],
	teacher: ['education'],
	instructor: ['education', 'academic'],
	lecturer: ['academic', 'education'],

	// Government
	federal: ['federal', 'government'],
	government: ['government', 'federal'],
	'public sector': ['government'],
	'gs-': ['federal', 'government'],
	military: ['federal', 'military'],
	veteran: ['federal', 'military'],

	// Entry Level
	intern: ['entry', 'student'],
	'entry level': ['entry', 'student'],
	junior: ['entry'],
	associate: ['entry', 'corporate'],
	graduate: ['entry', 'student', 'recent-grad']
};

/**
 * Detect industries from job title
 */
export function detectIndustries(jobTitle: string): Industry[] {
	const title = jobTitle.toLowerCase();
	const industries = new Set<Industry>();

	for (const [keyword, mappedIndustries] of Object.entries(titleToIndustryMap)) {
		if (title.includes(keyword)) {
			mappedIndustries.forEach((ind) => industries.add(ind));
		}
	}

	return Array.from(industries);
}

/**
 * Detect experience level from job title and years
 */
export function detectExperienceLevel(
	jobTitle: string,
	yearsExperience?: number
): ExperienceLevel {
	const title = jobTitle.toLowerCase();

	// Check title keywords first
	if (
		title.includes('ceo') ||
		title.includes('cfo') ||
		title.includes('cto') ||
		title.includes('president') ||
		title.includes('c-suite')
	) {
		return 'executive';
	}

	if (
		title.includes('vp') ||
		title.includes('vice president') ||
		title.includes('director') ||
		title.includes('head of')
	) {
		return 'senior';
	}

	if (
		title.includes('senior') ||
		title.includes('lead') ||
		title.includes('principal') ||
		title.includes('staff')
	) {
		return 'senior';
	}

	if (
		title.includes('junior') ||
		title.includes('intern') ||
		title.includes('entry') ||
		title.includes('associate') ||
		title.includes('graduate')
	) {
		return 'entry';
	}

	// Fall back to years of experience
	if (yearsExperience !== undefined) {
		if (yearsExperience >= 15) return 'executive';
		if (yearsExperience >= 8) return 'senior';
		if (yearsExperience >= 2) return 'mid';
		return 'entry';
	}

	// Default to mid-level
	return 'mid';
}

// ============================================================================
// Style Recommendation Engine
// ============================================================================

/**
 * Calculate match score between a style and selection context
 */
function calculateStyleScore(style: ResumeStyle, context: StyleSelectionContext): number {
	let score = 0;
	const reasons: string[] = [];

	// Industry match (most important)
	if (context.industry) {
		if (style.industries.includes(context.industry)) {
			score += 40;
			reasons.push(`Matches ${context.industry} industry`);
		}
	}

	// Job title keyword analysis
	if (context.jobTitle) {
		const detectedIndustries = detectIndustries(context.jobTitle);
		const industryOverlap = detectedIndustries.filter((ind) =>
			style.industries.includes(ind)
		).length;

		if (industryOverlap > 0) {
			score += industryOverlap * 15;
			reasons.push(`Job title matches ${industryOverlap} style industries`);
		}
	}

	// Experience level match
	if (context.experienceLevel) {
		if (style.experienceLevels.includes(context.experienceLevel)) {
			score += 25;
			reasons.push(`Suitable for ${context.experienceLevel} level`);
		} else {
			score -= 20; // Penalty for mismatch
		}
	}

	// Keyword matching in job description
	if (context.keywords && context.keywords.length > 0) {
		const styleKeywords = [
			...style.tags,
			...style.industries,
			style.name.toLowerCase(),
			style.description.toLowerCase()
		].join(' ');

		const matches = context.keywords.filter((kw) =>
			styleKeywords.includes(kw.toLowerCase())
		).length;

		if (matches > 0) {
			score += matches * 5;
			reasons.push(`${matches} keyword matches`);
		}
	}

	// Check premium availability
	if (style.premium && context.subscriptionTier === 'free') {
		score -= 100; // Don't recommend premium to free users
	}

	return score;
}

/**
 * Recommend styles based on context
 * Returns sorted list of recommendations with scores
 */
export function recommendStyles(
	context: StyleSelectionContext,
	limit: number = 3
): StyleRecommendation[] {
	const availableStyles = getStylesForTier(context.subscriptionTier || 'free');

	const recommendations: StyleRecommendation[] = availableStyles.map((style) => {
		const score = calculateStyleScore(style, context);
		const reasons: string[] = [];

		// Build reason strings
		if (context.industry && style.industries.includes(context.industry)) {
			reasons.push(`Designed for ${context.industry}`);
		}
		if (context.experienceLevel && style.experienceLevels.includes(context.experienceLevel)) {
			reasons.push(`Optimized for ${context.experienceLevel}-level professionals`);
		}
		if (style.atsOptimized) {
			reasons.push('ATS-optimized format');
		}

		return {
			styleId: style.id,
			score,
			reasons
		};
	});

	// Sort by score descending
	recommendations.sort((a, b) => b.score - a.score);

	return recommendations.slice(0, limit);
}

/**
 * Get the single best style recommendation
 */
export function recommendStyle(context: StyleSelectionContext): string {
	const recommendations = recommendStyles(context, 1);
	return recommendations[0]?.styleId || 'classic';
}

/**
 * Simple style recommendation based on job info and profile
 * This is the function called from the resume generator
 */
export function recommendStyleForJob(params: {
	jobTitle: string;
	company: string;
	experienceYears?: number;
	userIndustry?: string;
}): string {
	const { jobTitle, company, experienceYears, userIndustry } = params;

	// Build context
	const context: StyleSelectionContext = {
		jobTitle,
		companyName: company,
		experienceLevel: detectExperienceLevel(jobTitle, experienceYears)
	};

	// Detect industry from job title
	const detectedIndustries = detectIndustries(jobTitle);
	if (detectedIndustries.length > 0) {
		context.industry = detectedIndustries[0];
	} else if (userIndustry) {
		context.industry = userIndustry as Industry;
	}

	// Special cases based on company name patterns
	const companyLower = company.toLowerCase();
	if (
		companyLower.includes('federal') ||
		companyLower.includes('government') ||
		companyLower.includes('agency') ||
		companyLower.includes('department of')
	) {
		return 'federal';
	}

	if (
		companyLower.includes('university') ||
		companyLower.includes('college') ||
		companyLower.includes('institute') ||
		companyLower.includes('research')
	) {
		return 'academic';
	}

	return recommendStyle(context);
}

// ============================================================================
// Style Utilities
// ============================================================================

/**
 * Get styles filtered by industry
 */
export function getStylesByIndustry(industry: Industry): ResumeStyle[] {
	return resumeStyles.filter((style) => style.industries.includes(industry));
}

/**
 * Get styles filtered by experience level
 */
export function getStylesByExperienceLevel(level: ExperienceLevel): ResumeStyle[] {
	return resumeStyles.filter((style) => style.experienceLevels.includes(level));
}

/**
 * Get styles by tag
 */
export function getStylesByTag(tag: string): ResumeStyle[] {
	return resumeStyles.filter((style) =>
		style.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
	);
}

/**
 * Search styles by query string
 */
export function searchStyles(query: string): ResumeStyle[] {
	const q = query.toLowerCase();
	return resumeStyles.filter(
		(style) =>
			style.name.toLowerCase().includes(q) ||
			style.description.toLowerCase().includes(q) ||
			style.tags.some((t) => t.includes(q)) ||
			style.industries.some((i) => i.includes(q))
	);
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Build the system prompt section for a given style
 */
export function buildStylePrompt(style: ResumeStyle): string {
	const sectionOrder = style.sections
		.sort((a, b) => a.order - b.order)
		.map((s) => s.name)
		.join(', ');

	return `
RESUME STYLE: ${style.name}
${style.description}

SECTION ORDER: ${sectionOrder}

FORMATTING GUIDELINES:
${style.formatInstructions}

TYPOGRAPHY:
- Use ${style.typography.bodyFont} font family
- Headers: ${style.typography.uppercaseHeadings ? 'UPPERCASE' : 'Title Case'}

LAYOUT:
- Maximum pages: ${style.layout.maxPages}
- Date format: ${style.layout.dateFormat}
- Bullet style: ${style.layout.bulletStyle}

SECTION-SPECIFIC INSTRUCTIONS:
${style.sections
	.filter((s) => s.formatInstructions)
	.map((s) => `${s.name}: ${s.formatInstructions}`)
	.join('\n\n')}
`;
}

/**
 * Get section configuration for a style
 */
export function getStyleSections(styleId: string) {
	const style = getStyle(styleId);
	if (!style) return [];

	return style.sections.sort((a, b) => a.order - b.order);
}
