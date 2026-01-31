/**
 * Core confidence scoring types for the resume generation V2 system.
 * These types define how we measure and track the confidence of matching
 * resume content to job requirements.
 */

/**
 * Confidence tier classification based on match quality.
 * - direct: Exact or near-exact match with strong evidence
 * - transferable: Skills/experience that clearly transfer to requirement
 * - adjacent: Related but not direct match, requires reframing
 * - weak: Tangential connection, significant gap exists
 * - gap: No meaningful match found
 */
export type ConfidenceTier = 'direct' | 'transferable' | 'adjacent' | 'weak' | 'gap';

/**
 * Detailed confidence score breakdown for a match.
 * Overall score is weighted combination of component scores.
 */
export interface ConfidenceScore {
	/**
	 * Overall confidence score (0-100)
	 * Weighted average: keyword(40%) + transferable(30%) + adjacent(20%) + impact(10%)
	 */
	overall: number;

	/**
	 * Classified confidence tier based on overall score
	 */
	tier: ConfidenceTier;

	/**
	 * Component score breakdown
	 */
	breakdown: {
		/**
		 * Keyword match score (0-100)
		 * Weight: 40% of overall
		 */
		keyword: number;

		/**
		 * Transferable skills score (0-100)
		 * Weight: 30% of overall
		 */
		transferable: number;

		/**
		 * Adjacent experience score (0-100)
		 * Weight: 20% of overall
		 */
		adjacent: number;

		/**
		 * Impact/results alignment score (0-100)
		 * Weight: 10% of overall
		 */
		impact: number;
	};
}

/**
 * Reframing strategy types for adapting content to requirements
 */
export type ReframingStrategyType =
	| 'keyword_alignment' // Adjust terminology to match job posting
	| 'emphasis_shift' // Change focus of content while preserving truth
	| 'abstraction_adjust' // Change level of detail/abstraction
	| 'scale_emphasis'; // Highlight scope/scale of work

/**
 * Strategy for reframing content to better align with requirements
 */
export interface ReframingStrategy {
	/**
	 * Type of reframing being applied
	 */
	type: ReframingStrategyType;

	/**
	 * Original text before reframing
	 */
	originalText: string;

	/**
	 * Reframed text that better aligns with requirement
	 */
	reframedText: string;

	/**
	 * Core meaning that must be preserved during reframing
	 */
	preservedMeaning: string;

	/**
	 * Specific elements that were adapted
	 */
	adaptedElements: string[];
}

/**
 * Source content types from candidate's profile
 */
export type ContentSourceType =
	| 'experience'
	| 'skill'
	| 'project'
	| 'education'
	| 'certification';

/**
 * Source content from candidate's profile that matches a requirement
 */
export interface ContentSource {
	/**
	 * Type of content source
	 */
	type: ContentSourceType;

	/**
	 * Reference ID to the source content in the database
	 */
	id: string;

	/**
	 * Original text from the candidate's profile
	 */
	originalText: string;

	/**
	 * Relevance score for this specific source (0-100)
	 */
	relevanceScore: number;
}

/**
 * Matched content linking a job requirement to candidate's profile content
 */
export interface MatchedContent {
	/**
	 * ID of the job requirement being matched
	 */
	requirementId: string;

	/**
	 * Text of the requirement
	 */
	requirement: string;

	/**
	 * Confidence score for this match
	 */
	confidence: ConfidenceScore;

	/**
	 * Source content from candidate's profile that supports this match
	 */
	sourceContent: ContentSource[];

	/**
	 * Optional reframing strategy if content needs adaptation
	 */
	reframingStrategy?: ReframingStrategy;

	/**
	 * The final selected/reframed content to use in the resume
	 */
	selectedContent?: string;
}
