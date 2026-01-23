/**
 * User Preferences Learning System - Type Definitions and Preference Computation
 *
 * This module handles the statistical analysis of user feedback to compute
 * learned preference weights that improve job matching over time.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single feedback item from the user
 */
export interface FeedbackItem {
	jobId: string;
	title: string;
	company: string;
	location: string | null;
	isRemote: boolean;
	employmentType: string | null;
	experienceLevel: string | null;
	salaryMin: number | null;
	salaryMax: number | null;
	skills: string[];
	requirements: string[];
	feedback: 'good_match' | 'bad_match';
	feedbackReason: string | null;
	feedbackDate: Date;
}

/**
 * Statistical weight for a single attribute
 */
export interface AttributeWeight {
	value: string;
	positiveCount: number;
	negativeCount: number;
	weight: number; // Range: -1.0 to 1.0, where positive = preferred, negative = disliked
	confidence: number; // 0.0 to 1.0 based on sample size
}

/**
 * Weights for company preferences
 */
export interface CompanyPreferences {
	preferred: AttributeWeight[];
	avoided: AttributeWeight[];
}

/**
 * Weights for skill/keyword preferences
 */
export interface SkillPreferences {
	preferred: AttributeWeight[];
	avoided: AttributeWeight[];
}

/**
 * Weights for job type preferences (employment type, experience level)
 */
export interface JobTypePreferences {
	employmentTypes: AttributeWeight[];
	experienceLevels: AttributeWeight[];
}

/**
 * Location and remote work preferences
 */
export interface LocationPreferences {
	preferredLocations: AttributeWeight[];
	avoidedLocations: AttributeWeight[];
	remotePreference: {
		weight: number; // Positive = prefers remote, negative = prefers on-site
		confidence: number;
	};
}

/**
 * Salary range preferences learned from feedback
 */
export interface SalaryPreferences {
	preferredMinimum: number | null;
	idealRange: {
		min: number | null;
		max: number | null;
	};
	confidence: number;
}

/**
 * Complete learned preferences for a user
 */
export interface LearnedPreferences {
	version: number;
	lastUpdated: string;
	feedbackCount: {
		total: number;
		positive: number;
		negative: number;
	};
	isActive: boolean; // Only active if minimum feedback threshold is met
	companies: CompanyPreferences;
	skills: SkillPreferences;
	jobTypes: JobTypePreferences;
	locations: LocationPreferences;
	salary: SalaryPreferences;
	titleKeywords: {
		preferred: AttributeWeight[];
		avoided: AttributeWeight[];
	};
}

/**
 * Configuration for the learning system
 */
export interface LearningConfig {
	minimumFeedbackThreshold: number; // Minimum feedback items before applying learning
	recencyWeightHalfLife: number; // Days after which feedback weight is halved
	confidenceThreshold: number; // Minimum confidence to apply a preference
	maxAttributesToTrack: number; // Maximum unique values to track per attribute
}

// Default configuration
export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
	minimumFeedbackThreshold: 5,
	recencyWeightHalfLife: 30, // 30 days
	confidenceThreshold: 0.3,
	maxAttributesToTrack: 50
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate time decay weight based on recency
 * Uses exponential decay with configurable half-life
 */
export function calculateRecencyWeight(
	feedbackDate: Date,
	now: Date = new Date(),
	halfLifeDays: number = 30
): number {
	const daysDiff = (now.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60 * 24);
	return Math.pow(0.5, daysDiff / halfLifeDays);
}

/**
 * Calculate confidence score based on sample size
 * Uses a logarithmic curve that approaches 1.0 as sample size increases
 */
export function calculateConfidence(sampleSize: number, minimumSamples: number = 5): number {
	if (sampleSize < minimumSamples) {
		return sampleSize / minimumSamples * 0.5; // Low confidence below threshold
	}
	// Logarithmic growth: approaches 1.0 as sample size increases
	return Math.min(1.0, 0.5 + 0.5 * Math.log10(sampleSize / minimumSamples + 1));
}

/**
 * Calculate preference weight from positive and negative counts
 * Returns a value from -1.0 (strongly disliked) to 1.0 (strongly preferred)
 */
export function calculatePreferenceWeight(
	positiveCount: number,
	negativeCount: number,
	positiveWeightSum: number,
	negativeWeightSum: number
): number {
	const totalWeightedPositive = positiveWeightSum;
	const totalWeightedNegative = negativeWeightSum;
	const totalWeight = totalWeightedPositive + totalWeightedNegative;

	if (totalWeight === 0) return 0;

	// Calculate weighted preference score
	return (totalWeightedPositive - totalWeightedNegative) / totalWeight;
}

/**
 * Extract keywords from a job title
 */
export function extractTitleKeywords(title: string): string[] {
	const stopWords = new Set([
		'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
		'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
		'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
		'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
		'i', 'ii', 'iii', 'iv', 'v', 'we', 'you', 'he', 'she', 'it', 'they',
		'this', 'that', 'these', 'those', 'who', 'what', 'which', 'when',
		'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
		'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
		'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'level'
	]);

	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Normalize a location string for comparison
 */
export function normalizeLocation(location: string | null): string {
	if (!location) return '';
	return location
		.toLowerCase()
		.replace(/[^a-z0-9\s,]/g, '')
		.trim();
}

/**
 * Extract company name variants for matching
 */
export function normalizeCompanyName(company: string): string {
	return company
		.toLowerCase()
		.replace(/\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|company|co\.?)\s*$/i, '')
		.trim();
}

// ============================================================================
// Preference Computation
// ============================================================================

/**
 * Aggregate feedback items into attribute weights
 */
function aggregateAttributeWeights(
	items: Array<{ value: string; isPositive: boolean; recencyWeight: number }>,
	maxAttributes: number
): AttributeWeight[] {
	const aggregated = new Map<string, {
		positiveCount: number;
		negativeCount: number;
		positiveWeightSum: number;
		negativeWeightSum: number;
	}>();

	for (const item of items) {
		const existing = aggregated.get(item.value) || {
			positiveCount: 0,
			negativeCount: 0,
			positiveWeightSum: 0,
			negativeWeightSum: 0
		};

		if (item.isPositive) {
			existing.positiveCount++;
			existing.positiveWeightSum += item.recencyWeight;
		} else {
			existing.negativeCount++;
			existing.negativeWeightSum += item.recencyWeight;
		}

		aggregated.set(item.value, existing);
	}

	const weights: AttributeWeight[] = [];
	for (const [value, stats] of aggregated) {
		const totalCount = stats.positiveCount + stats.negativeCount;
		weights.push({
			value,
			positiveCount: stats.positiveCount,
			negativeCount: stats.negativeCount,
			weight: calculatePreferenceWeight(
				stats.positiveCount,
				stats.negativeCount,
				stats.positiveWeightSum,
				stats.negativeWeightSum
			),
			confidence: calculateConfidence(totalCount)
		});
	}

	// Sort by absolute weight and take top N
	return weights
		.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
		.slice(0, maxAttributes);
}

/**
 * Compute comprehensive preferences from feedback history
 */
export function computePreferences(
	feedbackItems: FeedbackItem[],
	config: LearningConfig = DEFAULT_LEARNING_CONFIG
): LearnedPreferences {
	const now = new Date();
	const positiveCount = feedbackItems.filter(f => f.feedback === 'good_match').length;
	const negativeCount = feedbackItems.filter(f => f.feedback === 'bad_match').length;
	const isActive = feedbackItems.length >= config.minimumFeedbackThreshold;

	// Pre-compute recency weights for all items
	const itemsWithWeights = feedbackItems.map(item => ({
		...item,
		recencyWeight: calculateRecencyWeight(item.feedbackDate, now, config.recencyWeightHalfLife)
	}));

	// Aggregate companies
	const companyItems = itemsWithWeights.map(item => ({
		value: normalizeCompanyName(item.company),
		isPositive: item.feedback === 'good_match',
		recencyWeight: item.recencyWeight
	}));
	const companyWeights = aggregateAttributeWeights(companyItems, config.maxAttributesToTrack);

	// Aggregate skills from requirements
	const skillItems: Array<{ value: string; isPositive: boolean; recencyWeight: number }> = [];
	for (const item of itemsWithWeights) {
		const allSkills = [...(item.skills || []), ...(item.requirements || [])];
		for (const skill of allSkills) {
			skillItems.push({
				value: skill.toLowerCase().trim(),
				isPositive: item.feedback === 'good_match',
				recencyWeight: item.recencyWeight
			});
		}
	}
	const skillWeights = aggregateAttributeWeights(skillItems, config.maxAttributesToTrack);

	// Aggregate employment types
	const employmentTypeItems = itemsWithWeights
		.filter(item => item.employmentType)
		.map(item => ({
			value: item.employmentType!.toLowerCase(),
			isPositive: item.feedback === 'good_match',
			recencyWeight: item.recencyWeight
		}));
	const employmentTypeWeights = aggregateAttributeWeights(employmentTypeItems, 10);

	// Aggregate experience levels
	const experienceLevelItems = itemsWithWeights
		.filter(item => item.experienceLevel)
		.map(item => ({
			value: item.experienceLevel!.toLowerCase(),
			isPositive: item.feedback === 'good_match',
			recencyWeight: item.recencyWeight
		}));
	const experienceLevelWeights = aggregateAttributeWeights(experienceLevelItems, 10);

	// Aggregate locations
	const locationItems = itemsWithWeights
		.filter(item => item.location)
		.map(item => ({
			value: normalizeLocation(item.location),
			isPositive: item.feedback === 'good_match',
			recencyWeight: item.recencyWeight
		}));
	const locationWeights = aggregateAttributeWeights(locationItems, config.maxAttributesToTrack);

	// Calculate remote preference
	const remoteItems = itemsWithWeights.filter(item => item.isRemote !== undefined);
	let remotePositiveWeight = 0;
	let remoteNegativeWeight = 0;
	for (const item of remoteItems) {
		if (item.isRemote) {
			if (item.feedback === 'good_match') {
				remotePositiveWeight += item.recencyWeight;
			} else {
				remoteNegativeWeight += item.recencyWeight;
			}
		}
	}
	const remoteTotalWeight = remotePositiveWeight + remoteNegativeWeight;

	// Aggregate title keywords
	const titleKeywordItems: Array<{ value: string; isPositive: boolean; recencyWeight: number }> = [];
	for (const item of itemsWithWeights) {
		const keywords = extractTitleKeywords(item.title);
		for (const keyword of keywords) {
			titleKeywordItems.push({
				value: keyword,
				isPositive: item.feedback === 'good_match',
				recencyWeight: item.recencyWeight
			});
		}
	}
	const titleKeywordWeights = aggregateAttributeWeights(titleKeywordItems, config.maxAttributesToTrack);

	// Calculate salary preferences from positive feedback
	const positiveSalaries = itemsWithWeights
		.filter(item => item.feedback === 'good_match' && (item.salaryMin || item.salaryMax))
		.map(item => ({
			min: item.salaryMin,
			max: item.salaryMax,
			weight: item.recencyWeight
		}));

	let salaryPreferredMin: number | null = null;
	let salaryIdealMin: number | null = null;
	let salaryIdealMax: number | null = null;
	let salaryConfidence = 0;

	if (positiveSalaries.length >= 2) {
		const weightedMins = positiveSalaries.filter(s => s.min).map(s => s.min! * s.weight);
		const weightedMaxs = positiveSalaries.filter(s => s.max).map(s => s.max! * s.weight);
		const totalMinWeight = positiveSalaries.filter(s => s.min).reduce((sum, s) => sum + s.weight, 0);
		const totalMaxWeight = positiveSalaries.filter(s => s.max).reduce((sum, s) => sum + s.weight, 0);

		if (totalMinWeight > 0) {
			salaryPreferredMin = Math.round(weightedMins.reduce((a, b) => a + b, 0) / totalMinWeight);
			salaryIdealMin = salaryPreferredMin;
		}
		if (totalMaxWeight > 0) {
			salaryIdealMax = Math.round(weightedMaxs.reduce((a, b) => a + b, 0) / totalMaxWeight);
		}
		salaryConfidence = calculateConfidence(positiveSalaries.length, 3);
	}

	return {
		version: 1,
		lastUpdated: now.toISOString(),
		feedbackCount: {
			total: feedbackItems.length,
			positive: positiveCount,
			negative: negativeCount
		},
		isActive,
		companies: {
			preferred: companyWeights.filter(w => w.weight > 0),
			avoided: companyWeights.filter(w => w.weight < 0)
		},
		skills: {
			preferred: skillWeights.filter(w => w.weight > 0),
			avoided: skillWeights.filter(w => w.weight < 0)
		},
		jobTypes: {
			employmentTypes: employmentTypeWeights,
			experienceLevels: experienceLevelWeights
		},
		locations: {
			preferredLocations: locationWeights.filter(w => w.weight > 0),
			avoidedLocations: locationWeights.filter(w => w.weight < 0),
			remotePreference: {
				weight: remoteTotalWeight > 0
					? (remotePositiveWeight - remoteNegativeWeight) / remoteTotalWeight
					: 0,
				confidence: calculateConfidence(remoteItems.length, 3)
			}
		},
		salary: {
			preferredMinimum: salaryPreferredMin,
			idealRange: {
				min: salaryIdealMin,
				max: salaryIdealMax
			},
			confidence: salaryConfidence
		},
		titleKeywords: {
			preferred: titleKeywordWeights.filter(w => w.weight > 0),
			avoided: titleKeywordWeights.filter(w => w.weight < 0)
		}
	};
}

// ============================================================================
// Job Scoring with Preferences
// ============================================================================

/**
 * Score adjustment based on learned preferences
 */
export interface PreferenceScoreAdjustment {
	baseScore: number;
	adjustedScore: number;
	adjustments: {
		company: number;
		skills: number;
		jobType: number;
		location: number;
		salary: number;
		titleKeywords: number;
	};
	reasons: string[];
}

/**
 * Apply learned preferences to adjust a job's match score
 */
export function applyPreferencesToScore(
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
	},
	preferences: LearnedPreferences,
	config: LearningConfig = DEFAULT_LEARNING_CONFIG
): PreferenceScoreAdjustment {
	const reasons: string[] = [];
	const adjustments = {
		company: 0,
		skills: 0,
		jobType: 0,
		location: 0,
		salary: 0,
		titleKeywords: 0
	};

	if (!preferences.isActive) {
		return {
			baseScore: job.matchScore,
			adjustedScore: job.matchScore,
			adjustments,
			reasons: ['Learning not yet active (need more feedback)']
		};
	}

	// Company adjustment
	const normalizedCompany = normalizeCompanyName(job.company);
	const companyPref = preferences.companies.preferred.find(c => c.value === normalizedCompany);
	const companyAvoid = preferences.companies.avoided.find(c => c.value === normalizedCompany);

	if (companyPref && companyPref.confidence >= config.confidenceThreshold) {
		adjustments.company = Math.round(companyPref.weight * companyPref.confidence * 15);
		reasons.push(`Preferred company: ${job.company} (+${adjustments.company})`);
	} else if (companyAvoid && companyAvoid.confidence >= config.confidenceThreshold) {
		adjustments.company = Math.round(companyAvoid.weight * companyAvoid.confidence * 15);
		reasons.push(`Previously disliked company: ${job.company} (${adjustments.company})`);
	}

	// Skills adjustment
	const jobSkills = (job.requirements || []).map(s => s.toLowerCase().trim());
	let skillBoost = 0;
	let skillPenalty = 0;

	for (const skill of jobSkills) {
		const preferred = preferences.skills.preferred.find(s => s.value === skill);
		const avoided = preferences.skills.avoided.find(s => s.value === skill);

		if (preferred && preferred.confidence >= config.confidenceThreshold) {
			skillBoost += preferred.weight * preferred.confidence * 5;
		}
		if (avoided && avoided.confidence >= config.confidenceThreshold) {
			skillPenalty += avoided.weight * avoided.confidence * 5;
		}
	}

	adjustments.skills = Math.round(skillBoost + skillPenalty);
	if (adjustments.skills > 0) {
		reasons.push(`Matches preferred skills (+${adjustments.skills})`);
	} else if (adjustments.skills < 0) {
		reasons.push(`Contains disliked skills (${adjustments.skills})`);
	}

	// Job type adjustment
	if (job.employmentType) {
		const empTypePref = preferences.jobTypes.employmentTypes.find(
			t => t.value === job.employmentType!.toLowerCase()
		);
		if (empTypePref && empTypePref.confidence >= config.confidenceThreshold) {
			adjustments.jobType += Math.round(empTypePref.weight * empTypePref.confidence * 10);
		}
	}

	if (job.experienceLevel) {
		const expLevelPref = preferences.jobTypes.experienceLevels.find(
			l => l.value === job.experienceLevel!.toLowerCase()
		);
		if (expLevelPref && expLevelPref.confidence >= config.confidenceThreshold) {
			adjustments.jobType += Math.round(expLevelPref.weight * expLevelPref.confidence * 10);
		}
	}

	if (adjustments.jobType !== 0) {
		reasons.push(`Job type preference (${adjustments.jobType > 0 ? '+' : ''}${adjustments.jobType})`);
	}

	// Location and remote adjustment
	if (job.isRemote && preferences.locations.remotePreference.confidence >= config.confidenceThreshold) {
		const remoteAdj = Math.round(
			preferences.locations.remotePreference.weight *
			preferences.locations.remotePreference.confidence * 10
		);
		adjustments.location += remoteAdj;
		if (remoteAdj !== 0) {
			reasons.push(`Remote work preference (${remoteAdj > 0 ? '+' : ''}${remoteAdj})`);
		}
	}

	if (job.location) {
		const normalizedLoc = normalizeLocation(job.location);
		const locPref = preferences.locations.preferredLocations.find(l =>
			normalizedLoc.includes(l.value) || l.value.includes(normalizedLoc)
		);
		const locAvoid = preferences.locations.avoidedLocations.find(l =>
			normalizedLoc.includes(l.value) || l.value.includes(normalizedLoc)
		);

		if (locPref && locPref.confidence >= config.confidenceThreshold) {
			const locAdj = Math.round(locPref.weight * locPref.confidence * 8);
			adjustments.location += locAdj;
			reasons.push(`Preferred location: ${job.location} (+${locAdj})`);
		} else if (locAvoid && locAvoid.confidence >= config.confidenceThreshold) {
			const locAdj = Math.round(locAvoid.weight * locAvoid.confidence * 8);
			adjustments.location += locAdj;
			reasons.push(`Avoided location: ${job.location} (${locAdj})`);
		}
	}

	// Salary adjustment
	if (preferences.salary.confidence >= config.confidenceThreshold) {
		const jobMidSalary = job.salaryMin && job.salaryMax
			? (job.salaryMin + job.salaryMax) / 2
			: job.salaryMin || job.salaryMax;

		if (jobMidSalary && preferences.salary.idealRange.min && preferences.salary.idealRange.max) {
			const idealMid = (preferences.salary.idealRange.min + preferences.salary.idealRange.max) / 2;
			const deviation = Math.abs(jobMidSalary - idealMid) / idealMid;

			if (deviation < 0.1) {
				adjustments.salary = Math.round(preferences.salary.confidence * 8);
				reasons.push(`Salary in ideal range (+${adjustments.salary})`);
			} else if (deviation > 0.3) {
				adjustments.salary = Math.round(-preferences.salary.confidence * 5);
				reasons.push(`Salary outside preferred range (${adjustments.salary})`);
			}
		}
	}

	// Title keywords adjustment
	const titleKeywords = extractTitleKeywords(job.title);
	let titleBoost = 0;
	let titlePenalty = 0;

	for (const keyword of titleKeywords) {
		const preferred = preferences.titleKeywords.preferred.find(k => k.value === keyword);
		const avoided = preferences.titleKeywords.avoided.find(k => k.value === keyword);

		if (preferred && preferred.confidence >= config.confidenceThreshold) {
			titleBoost += preferred.weight * preferred.confidence * 4;
		}
		if (avoided && avoided.confidence >= config.confidenceThreshold) {
			titlePenalty += avoided.weight * avoided.confidence * 4;
		}
	}

	adjustments.titleKeywords = Math.round(titleBoost + titlePenalty);
	if (adjustments.titleKeywords > 0) {
		reasons.push(`Matches preferred title keywords (+${adjustments.titleKeywords})`);
	} else if (adjustments.titleKeywords < 0) {
		reasons.push(`Contains disliked title keywords (${adjustments.titleKeywords})`);
	}

	// Calculate final adjusted score
	const totalAdjustment = Object.values(adjustments).reduce((sum, adj) => sum + adj, 0);
	const adjustedScore = Math.max(0, Math.min(100, job.matchScore + totalAdjustment));

	return {
		baseScore: job.matchScore,
		adjustedScore,
		adjustments,
		reasons
	};
}

/**
 * Create empty/default preferences for a new user
 */
export function createEmptyPreferences(): LearnedPreferences {
	return {
		version: 1,
		lastUpdated: new Date().toISOString(),
		feedbackCount: {
			total: 0,
			positive: 0,
			negative: 0
		},
		isActive: false,
		companies: {
			preferred: [],
			avoided: []
		},
		skills: {
			preferred: [],
			avoided: []
		},
		jobTypes: {
			employmentTypes: [],
			experienceLevels: []
		},
		locations: {
			preferredLocations: [],
			avoidedLocations: [],
			remotePreference: {
				weight: 0,
				confidence: 0
			}
		},
		salary: {
			preferredMinimum: null,
			idealRange: {
				min: null,
				max: null
			},
			confidence: 0
		},
		titleKeywords: {
			preferred: [],
			avoided: []
		}
	};
}
