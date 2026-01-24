/**
 * Learning System - Main Module
 *
 * This module provides the core learning functionality that analyzes user feedback
 * to improve job matching recommendations over time.
 */

import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/server/database/types';
import {
	type FeedbackItem,
	type LearnedPreferences,
	type PreferenceScoreAdjustment,
	type LearningConfig,
	DEFAULT_LEARNING_CONFIG,
	computePreferences,
	applyPreferencesToScore,
	createEmptyPreferences,
	extractTitleKeywords,
	normalizeCompanyName
} from './preferences';

// Re-export types for convenience
export type {
	FeedbackItem,
	LearnedPreferences,
	PreferenceScoreAdjustment,
	LearningConfig,
	AttributeWeight,
	CompanyPreferences,
	SkillPreferences,
	JobTypePreferences,
	LocationPreferences,
	SalaryPreferences
} from './preferences';

export {
	DEFAULT_LEARNING_CONFIG,
	computePreferences,
	applyPreferencesToScore,
	createEmptyPreferences
} from './preferences';

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create a Supabase client with service role for server-side operations
 */
function createSupabaseClient(): SupabaseClient<Database> {
	return createServerClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
		cookies: {
			getAll: () => [],
			setAll: () => {}
		}
	});
}

/**
 * Job feedback row type for database queries
 */
interface JobFeedbackRow {
	id: string;
	title: string;
	company: string;
	location: string | null;
	is_remote: boolean;
	employment_type: string | null;
	experience_level: string | null;
	salary_min: number | null;
	salary_max: number | null;
	requirements: string[] | null;
	matched_skills: string[] | null;
	user_feedback: string | null;
	feedback_reason: string | null;
	updated_at: string;
}

/**
 * Fetch all feedback items for a user from the database
 */
export async function fetchUserFeedback(
	userId: string,
	supabase?: SupabaseClient<Database>
): Promise<FeedbackItem[]> {
	const client = supabase || createSupabaseClient();

	const { data, error } = await client
		.from('jobs')
		.select(`
			id,
			title,
			company,
			location,
			is_remote,
			employment_type,
			experience_level,
			salary_min,
			salary_max,
			requirements,
			matched_skills,
			user_feedback,
			feedback_reason,
			updated_at
		`)
		.eq('user_id', userId)
		.not('user_feedback', 'is', null);

	if (error) {
		console.error('Failed to fetch user feedback:', error);
		throw new Error(`Failed to fetch user feedback: ${error.message}`);
	}

	const jobs = (data || []) as unknown as JobFeedbackRow[];

	return jobs.map(job => ({
		jobId: job.id,
		title: job.title,
		company: job.company,
		location: job.location,
		isRemote: job.is_remote,
		employmentType: job.employment_type,
		experienceLevel: job.experience_level,
		salaryMin: job.salary_min,
		salaryMax: job.salary_max,
		skills: job.matched_skills || [],
		requirements: job.requirements || [],
		feedback: job.user_feedback as 'good_match' | 'bad_match',
		feedbackReason: job.feedback_reason,
		feedbackDate: new Date(job.updated_at)
	}));
}

/**
 * Profile row with learned preferences for type casting
 */
interface ProfileWithPreferences {
	learned_preferences: LearnedPreferences | null;
}

/**
 * Load learned preferences for a user from the database
 */
export async function loadLearnedPreferences(
	userId: string,
	supabase?: SupabaseClient<Database>
): Promise<LearnedPreferences | null> {
	const client = supabase || createSupabaseClient();

	const { data, error } = await client
		.from('profiles')
		.select('learned_preferences')
		.eq('user_id', userId)
		.single();

	if (error) {
		console.error('Failed to load learned preferences:', error);
		return null;
	}

	const profile = data as unknown as ProfileWithPreferences | null;
	return profile?.learned_preferences ?? null;
}

/**
 * Save learned preferences for a user to the database
 */
export async function saveLearnedPreferences(
	userId: string,
	preferences: LearnedPreferences,
	supabase?: SupabaseClient<Database>
): Promise<void> {
	const client = supabase || createSupabaseClient();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error } = await (client as any)
		.from('profiles')
		.update({
			learned_preferences: preferences,
			updated_at: new Date().toISOString()
		})
		.eq('user_id', userId);

	if (error) {
		console.error('Failed to save learned preferences:', error);
		throw new Error(`Failed to save learned preferences: ${error.message}`);
	}
}

// ============================================================================
// Learning Analysis Functions
// ============================================================================

/**
 * Analyze patterns in user feedback to identify what makes good/bad matches
 */
export interface FeedbackPatternAnalysis {
	totalFeedback: number;
	positiveRatio: number;
	patterns: {
		goodMatchPatterns: {
			topCompanies: string[];
			topSkills: string[];
			topTitleKeywords: string[];
			preferredLocations: string[];
			salaryRange: { min: number | null; max: number | null };
			prefersRemote: boolean | null;
		};
		badMatchPatterns: {
			avoidedCompanies: string[];
			avoidedSkills: string[];
			avoidedTitleKeywords: string[];
			avoidedLocations: string[];
		};
	};
	confidence: {
		overall: number;
		companies: number;
		skills: number;
		locations: number;
	};
}

/**
 * Analyze user feedback patterns to understand preferences
 */
export function analyzeFeedbackPatterns(
	feedbackItems: FeedbackItem[],
	config: LearningConfig = DEFAULT_LEARNING_CONFIG
): FeedbackPatternAnalysis {
	const positiveItems = feedbackItems.filter(f => f.feedback === 'good_match');
	const negativeItems = feedbackItems.filter(f => f.feedback === 'bad_match');

	// Count occurrences in positive feedback
	const positiveCompanyCounts = new Map<string, number>();
	const positiveSkillCounts = new Map<string, number>();
	const positiveTitleKeywordCounts = new Map<string, number>();
	const positiveLocationCounts = new Map<string, number>();
	let positiveRemoteCount = 0;
	let positiveOnsiteCount = 0;
	const positiveSalaries: Array<{ min: number | null; max: number | null }> = [];

	for (const item of positiveItems) {
		// Companies
		const company = normalizeCompanyName(item.company);
		positiveCompanyCounts.set(company, (positiveCompanyCounts.get(company) || 0) + 1);

		// Skills
		for (const skill of [...item.skills, ...item.requirements]) {
			const normalizedSkill = skill.toLowerCase().trim();
			positiveSkillCounts.set(normalizedSkill, (positiveSkillCounts.get(normalizedSkill) || 0) + 1);
		}

		// Title keywords
		for (const keyword of extractTitleKeywords(item.title)) {
			positiveTitleKeywordCounts.set(keyword, (positiveTitleKeywordCounts.get(keyword) || 0) + 1);
		}

		// Location
		if (item.location) {
			const loc = item.location.toLowerCase().trim();
			positiveLocationCounts.set(loc, (positiveLocationCounts.get(loc) || 0) + 1);
		}

		// Remote
		if (item.isRemote) {
			positiveRemoteCount++;
		} else {
			positiveOnsiteCount++;
		}

		// Salary
		if (item.salaryMin || item.salaryMax) {
			positiveSalaries.push({ min: item.salaryMin, max: item.salaryMax });
		}
	}

	// Count occurrences in negative feedback
	const negativeCompanyCounts = new Map<string, number>();
	const negativeSkillCounts = new Map<string, number>();
	const negativeTitleKeywordCounts = new Map<string, number>();
	const negativeLocationCounts = new Map<string, number>();

	for (const item of negativeItems) {
		// Companies
		const company = normalizeCompanyName(item.company);
		negativeCompanyCounts.set(company, (negativeCompanyCounts.get(company) || 0) + 1);

		// Skills
		for (const skill of [...item.skills, ...item.requirements]) {
			const normalizedSkill = skill.toLowerCase().trim();
			negativeSkillCounts.set(normalizedSkill, (negativeSkillCounts.get(normalizedSkill) || 0) + 1);
		}

		// Title keywords
		for (const keyword of extractTitleKeywords(item.title)) {
			negativeTitleKeywordCounts.set(keyword, (negativeTitleKeywordCounts.get(keyword) || 0) + 1);
		}

		// Location
		if (item.location) {
			const loc = item.location.toLowerCase().trim();
			negativeLocationCounts.set(loc, (negativeLocationCounts.get(loc) || 0) + 1);
		}
	}

	// Helper to get top N by count, excluding items that appear more in negative feedback
	const getTopPositive = (
		positiveCounts: Map<string, number>,
		negativeCounts: Map<string, number>,
		n: number
	): string[] => {
		return Array.from(positiveCounts.entries())
			.filter(([key, count]) => {
				const negCount = negativeCounts.get(key) || 0;
				return count > negCount; // Only include if more positive than negative
			})
			.sort((a, b) => b[1] - a[1])
			.slice(0, n)
			.map(([key]) => key);
	};

	// Helper to get top N avoided items
	const getTopNegative = (
		negativeCounts: Map<string, number>,
		positiveCounts: Map<string, number>,
		n: number
	): string[] => {
		return Array.from(negativeCounts.entries())
			.filter(([key, count]) => {
				const posCount = positiveCounts.get(key) || 0;
				return count > posCount; // Only include if more negative than positive
			})
			.sort((a, b) => b[1] - a[1])
			.slice(0, n)
			.map(([key]) => key);
	};

	// Calculate salary range from positive feedback
	let salaryMin: number | null = null;
	let salaryMax: number | null = null;
	if (positiveSalaries.length >= 2) {
		const mins = positiveSalaries.filter(s => s.min).map(s => s.min!);
		const maxs = positiveSalaries.filter(s => s.max).map(s => s.max!);
		if (mins.length > 0) {
			salaryMin = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
		}
		if (maxs.length > 0) {
			salaryMax = Math.round(maxs.reduce((a, b) => a + b, 0) / maxs.length);
		}
	}

	// Determine remote preference
	let prefersRemote: boolean | null = null;
	if (positiveRemoteCount + positiveOnsiteCount >= 3) {
		if (positiveRemoteCount > positiveOnsiteCount * 1.5) {
			prefersRemote = true;
		} else if (positiveOnsiteCount > positiveRemoteCount * 1.5) {
			prefersRemote = false;
		}
	}

	// Calculate confidence scores
	const calculateConfidence = (sampleSize: number): number => {
		if (sampleSize < config.minimumFeedbackThreshold) {
			return sampleSize / config.minimumFeedbackThreshold * 0.5;
		}
		return Math.min(1.0, 0.5 + 0.5 * Math.log10(sampleSize / config.minimumFeedbackThreshold + 1));
	};

	return {
		totalFeedback: feedbackItems.length,
		positiveRatio: feedbackItems.length > 0 ? positiveItems.length / feedbackItems.length : 0,
		patterns: {
			goodMatchPatterns: {
				topCompanies: getTopPositive(positiveCompanyCounts, negativeCompanyCounts, 10),
				topSkills: getTopPositive(positiveSkillCounts, negativeSkillCounts, 15),
				topTitleKeywords: getTopPositive(positiveTitleKeywordCounts, negativeTitleKeywordCounts, 10),
				preferredLocations: getTopPositive(positiveLocationCounts, negativeLocationCounts, 5),
				salaryRange: { min: salaryMin, max: salaryMax },
				prefersRemote
			},
			badMatchPatterns: {
				avoidedCompanies: getTopNegative(negativeCompanyCounts, positiveCompanyCounts, 10),
				avoidedSkills: getTopNegative(negativeSkillCounts, positiveSkillCounts, 15),
				avoidedTitleKeywords: getTopNegative(negativeTitleKeywordCounts, positiveTitleKeywordCounts, 10),
				avoidedLocations: getTopNegative(negativeLocationCounts, positiveLocationCounts, 5)
			}
		},
		confidence: {
			overall: calculateConfidence(feedbackItems.length),
			companies: calculateConfidence(positiveCompanyCounts.size + negativeCompanyCounts.size),
			skills: calculateConfidence(positiveSkillCounts.size),
			locations: calculateConfidence(positiveLocationCounts.size)
		}
	};
}

// ============================================================================
// Preference Extraction Functions
// ============================================================================

/**
 * Extract preferred companies from good matches
 */
export function extractPreferredCompanies(
	feedbackItems: FeedbackItem[]
): Array<{ company: string; count: number; confidence: number }> {
	const companyCounts = new Map<string, { positive: number; negative: number }>();

	for (const item of feedbackItems) {
		const company = normalizeCompanyName(item.company);
		const counts = companyCounts.get(company) || { positive: 0, negative: 0 };

		if (item.feedback === 'good_match') {
			counts.positive++;
		} else {
			counts.negative++;
		}

		companyCounts.set(company, counts);
	}

	return Array.from(companyCounts.entries())
		.filter(([, counts]) => counts.positive > counts.negative)
		.map(([company, counts]) => {
			const total = counts.positive + counts.negative;
			const confidence = total >= 2 ? (counts.positive / total) : 0.3;
			return { company, count: counts.positive, confidence };
		})
		.sort((a, b) => b.count - a.count);
}

/**
 * Extract preferred industries/job types from good matches
 */
export function extractPreferredJobTypes(
	feedbackItems: FeedbackItem[]
): {
	employmentTypes: Array<{ type: string; preference: number }>;
	experienceLevels: Array<{ level: string; preference: number }>;
} {
	const empTypeCounts = new Map<string, { positive: number; negative: number }>();
	const expLevelCounts = new Map<string, { positive: number; negative: number }>();

	for (const item of feedbackItems) {
		if (item.employmentType) {
			const type = item.employmentType.toLowerCase();
			const counts = empTypeCounts.get(type) || { positive: 0, negative: 0 };
			if (item.feedback === 'good_match') {
				counts.positive++;
			} else {
				counts.negative++;
			}
			empTypeCounts.set(type, counts);
		}

		if (item.experienceLevel) {
			const level = item.experienceLevel.toLowerCase();
			const counts = expLevelCounts.get(level) || { positive: 0, negative: 0 };
			if (item.feedback === 'good_match') {
				counts.positive++;
			} else {
				counts.negative++;
			}
			expLevelCounts.set(level, counts);
		}
	}

	const calculatePreference = (counts: { positive: number; negative: number }): number => {
		const total = counts.positive + counts.negative;
		if (total === 0) return 0;
		return (counts.positive - counts.negative) / total;
	};

	return {
		employmentTypes: Array.from(empTypeCounts.entries())
			.map(([type, counts]) => ({ type, preference: calculatePreference(counts) }))
			.sort((a, b) => b.preference - a.preference),
		experienceLevels: Array.from(expLevelCounts.entries())
			.map(([level, counts]) => ({ level, preference: calculatePreference(counts) }))
			.sort((a, b) => b.preference - a.preference)
	};
}

/**
 * Extract disliked patterns from bad matches
 */
export function extractDislikedPatterns(
	feedbackItems: FeedbackItem[]
): {
	companies: string[];
	keywords: string[];
	reasons: string[];
} {
	const badMatches = feedbackItems.filter(f => f.feedback === 'bad_match');
	const goodMatches = feedbackItems.filter(f => f.feedback === 'good_match');

	// Companies that appear in bad matches but not good matches
	const badCompanies = new Set(badMatches.map(f => normalizeCompanyName(f.company)));
	const goodCompanies = new Set(goodMatches.map(f => normalizeCompanyName(f.company)));
	const avoidedCompanies = Array.from(badCompanies).filter(c => !goodCompanies.has(c));

	// Keywords that appear more in bad matches
	const badKeywordCounts = new Map<string, number>();
	const goodKeywordCounts = new Map<string, number>();

	for (const item of badMatches) {
		for (const keyword of extractTitleKeywords(item.title)) {
			badKeywordCounts.set(keyword, (badKeywordCounts.get(keyword) || 0) + 1);
		}
	}

	for (const item of goodMatches) {
		for (const keyword of extractTitleKeywords(item.title)) {
			goodKeywordCounts.set(keyword, (goodKeywordCounts.get(keyword) || 0) + 1);
		}
	}

	const avoidedKeywords = Array.from(badKeywordCounts.entries())
		.filter(([keyword, count]) => {
			const goodCount = goodKeywordCounts.get(keyword) || 0;
			return count > goodCount && count >= 2;
		})
		.sort((a, b) => b[1] - a[1])
		.slice(0, 15)
		.map(([keyword]) => keyword);

	// Extract reasons from feedback
	const reasons = badMatches
		.filter(f => f.feedbackReason)
		.map(f => f.feedbackReason!)
		.filter((reason, index, self) => self.indexOf(reason) === index)
		.slice(0, 10);

	return {
		companies: avoidedCompanies.slice(0, 20),
		keywords: avoidedKeywords,
		reasons
	};
}

// ============================================================================
// Learning System Manager
// ============================================================================

/**
 * Main learning system class that orchestrates preference learning
 */
export class LearningSystem {
	private config: LearningConfig;
	private supabase: SupabaseClient<Database>;

	constructor(config: Partial<LearningConfig> = {}) {
		this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
		this.supabase = createSupabaseClient();
	}

	/**
	 * Update learned preferences for a user based on their feedback history
	 */
	async updatePreferences(userId: string): Promise<LearnedPreferences> {
		// Fetch all feedback
		const feedbackItems = await fetchUserFeedback(userId, this.supabase);

		// Compute new preferences
		const preferences = computePreferences(feedbackItems, this.config);

		// Save to database
		await saveLearnedPreferences(userId, preferences, this.supabase);

		return preferences;
	}

	/**
	 * Get current preferences for a user, computing if necessary
	 */
	async getPreferences(userId: string, forceRefresh = false): Promise<LearnedPreferences> {
		if (!forceRefresh) {
			const existing = await loadLearnedPreferences(userId, this.supabase);
			if (existing) {
				// Check if preferences are recent (within 24 hours)
				const lastUpdated = new Date(existing.lastUpdated);
				const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
				if (lastUpdated > dayAgo) {
					return existing;
				}
			}
		}

		// Compute fresh preferences
		return this.updatePreferences(userId);
	}

	/**
	 * Score a list of jobs using learned preferences
	 */
	async scoreJobsWithPreferences(
		userId: string,
		jobs: Array<{
			id: string;
			title: string;
			company: string;
			location: string | null;
			isRemote: boolean;
			employmentType: string | null;
			experienceLevel: string | null;
			salaryMin: number | null;
			salaryMax: number | null;
			requirements: string[];
			matchScore: number;
		}>
	): Promise<Array<{
		id: string;
		originalScore: number;
		adjustedScore: number;
		adjustment: PreferenceScoreAdjustment;
	}>> {
		const preferences = await this.getPreferences(userId);

		return jobs.map(job => {
			const adjustment = applyPreferencesToScore(job, preferences, this.config);
			return {
				id: job.id,
				originalScore: job.matchScore,
				adjustedScore: adjustment.adjustedScore,
				adjustment
			};
		});
	}

	/**
	 * Get feedback analysis for a user
	 */
	async analyzeFeedback(userId: string): Promise<FeedbackPatternAnalysis> {
		const feedbackItems = await fetchUserFeedback(userId, this.supabase);
		return analyzeFeedbackPatterns(feedbackItems, this.config);
	}

	/**
	 * Record new feedback and update preferences
	 */
	async recordFeedback(
		userId: string,
		jobId: string,
		feedback: 'good_match' | 'bad_match',
		reason?: string
	): Promise<void> {
		// Update the job with feedback
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (this.supabase as any)
			.from('jobs')
			.update({
				user_feedback: feedback,
				feedback_reason: reason,
				updated_at: new Date().toISOString()
			})
			.eq('id', jobId)
			.eq('user_id', userId);

		if (error) {
			throw new Error(`Failed to record feedback: ${error.message}`);
		}

		// Update preferences in background (fire and forget)
		this.updatePreferences(userId).catch(err => {
			console.error('Failed to update preferences after feedback:', err);
		});
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

let learningSystemInstance: LearningSystem | null = null;

/**
 * Get the singleton learning system instance
 */
export function getLearningSystem(config?: Partial<LearningConfig>): LearningSystem {
	if (!learningSystemInstance || config) {
		learningSystemInstance = new LearningSystem(config);
	}
	return learningSystemInstance;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick function to apply learning to job scoring
 */
export async function applyLearningToJobScore(
	userId: string,
	job: {
		title: string;
		company: string;
		location: string | null;
		isRemote: boolean;
		employmentType: string | null;
		experienceLevel: string | null;
		salaryMin: number | null;
		salaryMax: number | null;
		requirements: string[];
		matchScore: number;
	}
): Promise<PreferenceScoreAdjustment> {
	const preferences = await loadLearnedPreferences(userId);

	if (!preferences || !preferences.isActive) {
		return {
			baseScore: job.matchScore,
			adjustedScore: job.matchScore,
			adjustments: {
				company: 0,
				skills: 0,
				jobType: 0,
				location: 0,
				salary: 0,
				titleKeywords: 0
			},
			reasons: ['Learning not yet active']
		};
	}

	return applyPreferencesToScore(job, preferences);
}

/**
 * Check if learning is active for a user (has enough feedback)
 */
export async function isLearningActive(userId: string): Promise<boolean> {
	const preferences = await loadLearnedPreferences(userId);
	return preferences?.isActive ?? false;
}

/**
 * Get learning statistics for a user
 */
export async function getLearningStats(userId: string): Promise<{
	isActive: boolean;
	feedbackCount: number;
	minimumRequired: number;
	lastUpdated: string | null;
}> {
	const preferences = await loadLearnedPreferences(userId);

	return {
		isActive: preferences?.isActive ?? false,
		feedbackCount: preferences?.feedbackCount.total ?? 0,
		minimumRequired: DEFAULT_LEARNING_CONFIG.minimumFeedbackThreshold,
		lastUpdated: preferences?.lastUpdated ?? null
	};
}
