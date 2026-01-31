/**
 * Experience discovery types for the resume generation V2 system.
 * These types support the interactive discovery process to extract hidden experiences.
 */

/**
 * Categories of experiences to discover
 */
export type DiscoveryCategory =
	| 'leadership' // Leadership and management experiences
	| 'technical_depth' // Deep technical expertise
	| 'cross_functional' // Cross-team collaboration
	| 'impact_metrics' // Quantifiable results and metrics
	| 'problem_solving' // Problem-solving approaches
	| 'innovation' // Innovation and creative solutions
	| 'mentorship' // Mentoring and teaching
	| 'process_improvement'; // Process optimization and improvement

/**
 * Discovery question to elicit hidden experiences
 */
export interface DiscoveryQuestion {
	/**
	 * Unique question ID
	 */
	id: string;

	/**
	 * Category this question targets
	 */
	category: DiscoveryCategory;

	/**
	 * The question text
	 */
	question: string;

	/**
	 * Optional follow-up questions based on response
	 */
	followUpQuestions?: string[];

	/**
	 * Expected types of insights this question should reveal
	 */
	expectedInsights: string[];
}

/**
 * Discovered experience from interactive session
 */
export interface DiscoveredExperience {
	/**
	 * Category of the discovered experience
	 */
	category: DiscoveryCategory;

	/**
	 * Description of the experience
	 */
	description: string;

	/**
	 * Context in which this experience occurred
	 */
	context: string;

	/**
	 * Impact or results of this experience
	 */
	impact?: string;

	/**
	 * Skills demonstrated in this experience
	 */
	skills: string[];

	/**
	 * Confidence that this is a valuable experience (0-100)
	 */
	confidence: number;
}

/**
 * Status of a discovery session
 */
export type DiscoverySessionStatus =
	| 'in_progress' // Session is ongoing
	| 'completed' // Session is complete
	| 'abandoned'; // Session was abandoned

/**
 * Extracted insight from a discovery response
 */
export interface ExtractedInsight {
	/**
	 * The insight text
	 */
	insight: string;

	/**
	 * Category this insight relates to
	 */
	category: DiscoveryCategory;

	/**
	 * Confidence in this insight (0-100)
	 */
	confidence: number;
}

/**
 * User's response to a discovery question
 */
export interface DiscoveryResponse {
	/**
	 * ID of the question being answered
	 */
	questionId: string;

	/**
	 * User's response text
	 */
	response: string;

	/**
	 * Insights extracted from this response
	 */
	extractedInsights: ExtractedInsight[];
}

/**
 * Interactive discovery session
 */
export interface ExperienceDiscoverySession {
	/**
	 * User ID for this session
	 */
	userId: string;

	/**
	 * Job ID this discovery is for (if applicable)
	 */
	jobId?: string;

	/**
	 * Questions asked during this session
	 */
	questions: DiscoveryQuestion[];

	/**
	 * Responses provided by the user
	 */
	responses: DiscoveryResponse[];

	/**
	 * Experiences discovered during the session
	 */
	discoveredExperiences: DiscoveredExperience[];

	/**
	 * Current status of the session
	 */
	status: DiscoverySessionStatus;
}
