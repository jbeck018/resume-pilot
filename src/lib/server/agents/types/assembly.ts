/**
 * Assembly phase types for the resume generation V2 system.
 * These types support the assembly and gap analysis process.
 */

import type { MatchedContent, ReframingStrategy } from './confidence.js';

/**
 * Type of gap identified in candidate's qualifications
 */
export type GapType =
	| 'missing_skill' // Required skill not present
	| 'insufficient_experience' // Experience exists but insufficient depth
	| 'missing_certification' // Required certification not held
	| 'industry_mismatch' // Experience in different industry
	| 'seniority_gap' // Experience level doesn't match requirement
	| 'technical_gap'; // Technical requirement not met

/**
 * Severity level of a qualification gap
 */
export type GapSeverity = 'critical' | 'significant' | 'minor';

/**
 * Mitigation strategy types for addressing gaps
 */
export type MitigationStrategyType =
	| 'reframe_adjacent' // Reframe adjacent experience to appear more relevant
	| 'highlight_transferable' // Emphasize transferable skills
	| 'cover_letter' // Address in cover letter
	| 'acknowledge_learning'; // Acknowledge gap and show learning path

/**
 * Strategy for mitigating a qualification gap
 */
export interface MitigationStrategy {
	/**
	 * Type of mitigation strategy
	 */
	type: MitigationStrategyType;

	/**
	 * Description of how to apply this strategy
	 */
	description: string;

	/**
	 * Optional specific content to use (for reframing/highlighting)
	 */
	content?: string;

	/**
	 * Confidence that this mitigation will be effective (0-100)
	 */
	confidence: number;
}

/**
 * Analysis of a qualification gap
 */
export interface GapAnalysis {
	/**
	 * ID of the requirement that has a gap
	 */
	requirementId: string;

	/**
	 * Text of the requirement
	 */
	requirement: string;

	/**
	 * Type of gap identified
	 */
	gapType: GapType;

	/**
	 * Severity of this gap
	 */
	severity: GapSeverity;

	/**
	 * Strategies for mitigating this gap
	 */
	mitigationStrategies: MitigationStrategy[];
}

/**
 * Priority level for content reframing
 */
export type ReframingPriority = 'high' | 'medium' | 'low';

/**
 * Plan for reframing content to match requirements
 */
export interface ReframingPlan {
	/**
	 * ID of the source content to reframe
	 */
	sourceContentId: string;

	/**
	 * ID of the target requirement
	 */
	targetRequirementId: string;

	/**
	 * Reframing strategy to apply
	 */
	strategy: ReframingStrategy;

	/**
	 * Priority level for this reframing
	 */
	priority: ReframingPriority;
}

/**
 * Placement location in cover letter
 */
export type CoverLetterPlacement = 'opening' | 'body' | 'closing';

/**
 * Recommendation for cover letter content
 */
export interface CoverLetterRecommendation {
	/**
	 * ID of the gap this recommendation addresses (if applicable)
	 */
	gapId?: string;

	/**
	 * The recommendation text
	 */
	recommendation: string;

	/**
	 * Suggested phrasing to use
	 */
	suggestedPhrasing: string;

	/**
	 * Where in the cover letter to place this
	 */
	placement: CoverLetterPlacement;
}

/**
 * Complete assembly plan for resume generation
 */
export interface AssemblyPlan {
	/**
	 * Job ID this plan is for
	 */
	jobId: string;

	/**
	 * Requirements that have been successfully matched
	 */
	matchedRequirements: MatchedContent[];

	/**
	 * Identified gaps in qualifications
	 */
	gaps: GapAnalysis[];

	/**
	 * Plan for reframing content
	 */
	reframingPlan: ReframingPlan[];

	/**
	 * Recommendations for cover letter
	 */
	coverLetterRecommendations: CoverLetterRecommendation[];
}
