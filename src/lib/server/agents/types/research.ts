/**
 * Research phase types for the resume generation V2 system.
 * These types support deep company and role research to inform resume customization.
 */

/**
 * Frequency classification for hiring patterns
 */
export type HiringFrequency = 'common' | 'occasional' | 'rare';

/**
 * Pattern observed in company's hiring practices
 */
export interface HiringPattern {
	/**
	 * Description of the observed pattern
	 */
	pattern: string;

	/**
	 * How frequently this pattern appears
	 */
	frequency: HiringFrequency;

	/**
	 * Relevance score to current application (0-100)
	 */
	relevance: number;
}

/**
 * Enhanced company research data gathered during research phase
 */
export interface CompanyResearchEnhanced {
	/**
	 * Company name
	 */
	name: string;

	/**
	 * Company description/mission
	 */
	description?: string;

	/**
	 * Primary industry/sector
	 */
	industry?: string;

	/**
	 * Company size (employees)
	 */
	size?: string;

	/**
	 * Company culture insights
	 */
	culture?: string[];

	/**
	 * Recent news or developments
	 */
	recentNews?: string[];

	/**
	 * Technologies used by the company
	 */
	technologies?: string[];

	/**
	 * Company values and principles
	 */
	values?: string[];

	/**
	 * Observed hiring patterns
	 */
	hiringPatterns?: HiringPattern[];

	/**
	 * Competitor analysis insights
	 */
	competitorAnalysis?: string[];

	/**
	 * Timestamp when research was conducted
	 */
	researchedAt: Date;
}

/**
 * Skill importance classification
 */
export type SkillImportance = 'critical' | 'important' | 'nice_to_have';

/**
 * Market demand level for a skill
 */
export type MarketDemand = 'high' | 'medium' | 'low';

/**
 * Skill requirement within a benchmark
 */
export interface BenchmarkSkill {
	/**
	 * Skill name
	 */
	name: string;

	/**
	 * Importance level for the role
	 */
	importance: SkillImportance;

	/**
	 * Current market demand for this skill
	 */
	marketDemand: MarketDemand;

	/**
	 * Alternative skills that could substitute
	 */
	alternatives?: string[];
}

/**
 * Industry benchmark data for a role
 */
export interface RoleBenchmark {
	/**
	 * Role title being benchmarked
	 */
	roleTitle: string;

	/**
	 * Industry context for the benchmark
	 */
	industry: string;

	/**
	 * Required skills for this role
	 */
	requiredSkills: BenchmarkSkill[];

	/**
	 * Preferred/nice-to-have skills
	 */
	preferredSkills: BenchmarkSkill[];

	/**
	 * Typical years of experience required
	 */
	typicalExperience: string;

	/**
	 * Compensation range if available
	 */
	compensationRange?: {
		min: number;
		max: number;
		currency: string;
	};

	/**
	 * Typical career progression paths
	 */
	careerProgression: string[];
}

/**
 * Profile of an ideal candidate for the role
 */
export interface SuccessProfile {
	/**
	 * Target role title
	 */
	targetRole: string;

	/**
	 * Description of ideal candidate characteristics
	 */
	idealCandidate: string;

	/**
	 * Key differentiators that make candidates stand out
	 */
	differentiators: string[];

	/**
	 * Red flags or common pitfalls to avoid
	 */
	redFlags: string[];
}
