/**
 * Resume library types for the resume generation V2 system.
 * These types support tracking and learning from past resume generations.
 */

import type { MatchedContent } from './confidence.js';
import type { GapAnalysis } from './assembly.js';

/**
 * Application outcome response types
 */
export type OutcomeResponse = 'interview' | 'rejection' | 'offer' | 'no_response';

/**
 * Pattern types that can be identified in library entries
 */
export type PatternType =
	| 'skill_match' // Pattern in how skills were matched
	| 'reframing' // Pattern in content reframing
	| 'gap_mitigation' // Pattern in gap mitigation
	| 'structure'; // Pattern in resume structure

/**
 * Outcome of a resume application
 */
export interface LibraryOutcome {
	/**
	 * Whether the resume was applied
	 */
	applied: boolean;

	/**
	 * Response received from the application
	 */
	response?: OutcomeResponse;

	/**
	 * Optional feedback received
	 */
	feedback?: string;

	/**
	 * When the outcome was last updated
	 */
	updatedAt: Date;
}

/**
 * Entry in the resume library
 */
export interface ResumeLibraryEntry {
	/**
	 * Unique entry ID
	 */
	id: string;

	/**
	 * User ID who created this resume
	 */
	userId: string;

	/**
	 * Job ID this resume was created for
	 */
	jobId: string;

	/**
	 * The actual resume content (markdown, JSON, or other format)
	 */
	resumeContent: string;

	/**
	 * Overall match score for this resume (0-100)
	 */
	matchScore: number;

	/**
	 * ATS compatibility score (0-100)
	 */
	atsScore: number;

	/**
	 * Overall confidence in this resume (0-100)
	 */
	confidence: number;

	/**
	 * Requirements that were matched in this resume
	 */
	matchedRequirements: MatchedContent[];

	/**
	 * Gaps that were identified
	 */
	gaps: GapAnalysis[];

	/**
	 * Outcome of this resume if known
	 */
	outcome?: LibraryOutcome;

	/**
	 * When this entry was created
	 */
	createdAt: Date;
}

/**
 * Applicable pattern found in library search
 */
export interface ApplicablePattern {
	/**
	 * Type of pattern
	 */
	patternType: PatternType;

	/**
	 * Description of the pattern
	 */
	description: string;

	/**
	 * Confidence that this pattern applies (0-100)
	 */
	confidence: number;
}

/**
 * Result from searching the resume library
 */
export interface LibrarySearchResult {
	/**
	 * The library entry that matched
	 */
	entry: ResumeLibraryEntry;

	/**
	 * Similarity score to the search query (0-100)
	 */
	similarity: number;

	/**
	 * Patterns from this entry that may apply to current situation
	 */
	applicablePatterns: ApplicablePattern[];
}
