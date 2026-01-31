// =============================================================================
// Library Search Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult } from '../types';
import type {
	ResumeLibraryEntry,
	LibrarySearchResult,
	ApplicablePattern,
	PatternType,
	MatchedContent,
	GapAnalysis
} from '../types/index';
import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { generateEmbedding } from '../../embeddings';
import type { Database } from '$lib/server/database/types';

/**
 * Input for the library search tool
 */
export interface LibrarySearchInput {
	/**
	 * User ID for data isolation
	 */
	userId: string;

	/**
	 * The job description to find similar resumes for
	 */
	jobDescription: string;

	/**
	 * Target role/title
	 */
	targetRole: string;

	/**
	 * Required skills for the role
	 */
	requiredSkills: string[];

	/**
	 * Maximum number of results to return
	 */
	limit?: number;
}

/**
 * Output from the library search tool
 */
export interface LibrarySearchOutput {
	/**
	 * Matching entries from the library
	 */
	results: LibrarySearchResult[];

	/**
	 * Total number of entries in the user's library
	 */
	totalEntriesInLibrary: number;

	/**
	 * Whether embedding search was used
	 */
	usedEmbeddingSearch: boolean;

	/**
	 * Top recommended strategies from successful past resumes
	 */
	recommendedStrategies: ApplicablePattern[];

	/**
	 * Summary of patterns found
	 */
	patternSummary?: string;
}

/**
 * Library Search Tool
 * Searches the user's resume library for similar past resumes and returns applicable patterns.
 * Uses vector similarity search when embeddings are available, falls back to text matching.
 */
export const LibrarySearchTool: ToolDefinition<LibrarySearchInput, LibrarySearchOutput> = {
	id: 'library-search',
	name: 'Resume Library Search',
	description:
		'Search the resume library for similar past resumes. ' +
		'Extracts patterns from successful resumes that can be applied to new applications.',
	inputSchema: {
		type: 'object',
		properties: {
			userId: { type: 'string', description: 'User ID for data isolation' },
			jobDescription: { type: 'string', description: 'Job description to match against' },
			targetRole: { type: 'string', description: 'Target job role/title' },
			requiredSkills: {
				type: 'array',
				items: { type: 'string' },
				description: 'Required skills for the role'
			},
			limit: {
				type: 'number',
				description: 'Maximum results to return',
				default: 5
			}
		},
		required: ['userId', 'jobDescription', 'targetRole', 'requiredSkills']
	},

	async execute(
		input: LibrarySearchInput,
		context: ToolContext
	): Promise<ToolResult<LibrarySearchOutput>> {
		const startTime = Date.now();

		try {
			// Check for abort signal
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Search cancelled',
					durationMs: Date.now() - startTime
				};
			}

			const limit = input.limit ?? 5;
			const supabase = getServiceClient();

			// Get total count of user's library entries
			const { count: totalCount } = await supabase
				.from('resume_library')
				.select('*', { count: 'exact', head: true })
				.eq('user_id', input.userId);

			const totalEntriesInLibrary = totalCount ?? 0;

			// If no entries in library, return early
			if (totalEntriesInLibrary === 0) {
				return {
					success: true,
					data: {
						results: [],
						totalEntriesInLibrary: 0,
						usedEmbeddingSearch: false,
						recommendedStrategies: []
					},
					durationMs: Date.now() - startTime
				};
			}

			// Try embedding-based search first
			let searchResults: LibrarySearchResult[] = [];
			let usedEmbeddingSearch = false;

			try {
				searchResults = await searchWithEmbeddings(input, supabase, limit);
				usedEmbeddingSearch = searchResults.length > 0;
			} catch (embeddingError) {
				console.warn('Embedding search failed, falling back to text search:', embeddingError);
			}

			// Fall back to text-based search if embedding search returned no results
			if (searchResults.length === 0) {
				searchResults = await searchWithText(input, supabase, limit);
				usedEmbeddingSearch = false;
			}

			// Extract patterns from successful resumes
			const successfulResults = searchResults.filter((r) => {
				const outcome = r.entry.outcome;
				return outcome?.applied && (outcome.response === 'interview' || outcome.response === 'offer');
			});

			// Aggregate top patterns from all successful resumes
			const recommendedStrategies = aggregatePatterns(successfulResults);

			// Generate pattern summary
			const patternSummary = generatePatternSummary(searchResults, recommendedStrategies);

			return {
				success: true,
				data: {
					results: searchResults,
					totalEntriesInLibrary,
					usedEmbeddingSearch,
					recommendedStrategies,
					patternSummary
				},
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Library search failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

/**
 * Create a Supabase client with service role for server-side operations
 */
function getServiceClient() {
	return createServerClient<Database>(
		publicEnv.PUBLIC_SUPABASE_URL!,
		env.SUPABASE_SERVICE_ROLE_KEY!,
		{
			cookies: {
				getAll: () => [],
				setAll: () => {}
			}
		}
	);
}

/**
 * Search using vector embeddings (pgvector similarity)
 */
async function searchWithEmbeddings(
	input: LibrarySearchInput,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any,
	limit: number
): Promise<LibrarySearchResult[]> {
	// Build search text from job description and skills
	const searchText = buildSearchText(input);

	// Generate embedding for the search query
	const { embedding: queryEmbedding } = await generateEmbedding(searchText);

	// Query resume_library with embedding similarity
	// Using Supabase's vector similarity function
	const { data: entries, error } = await supabase.rpc('match_resume_library', {
		query_embedding: queryEmbedding,
		match_threshold: 0.3, // Lower threshold to get more results
		match_count: limit,
		target_user_id: input.userId
	});

	if (error) {
		throw new Error(`Embedding search failed: ${error.message}`);
	}

	if (!entries || entries.length === 0) {
		return [];
	}

	// Convert database rows to LibrarySearchResult
	return entries.map((entry: DatabaseResumeLibraryRow & { similarity: number }) => {
		const libraryEntry = mapDatabaseRowToEntry(entry);
		const patterns = extractPatterns(libraryEntry, input);

		return {
			entry: libraryEntry,
			// Convert similarity from 0-1 to 0-100 scale
			similarity: Math.round(entry.similarity * 100),
			applicablePatterns: patterns
		};
	});
}

/**
 * Search using text matching (fallback when embeddings unavailable)
 */
async function searchWithText(
	input: LibrarySearchInput,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any,
	limit: number
): Promise<LibrarySearchResult[]> {
	// Build filter query
	let query = supabase
		.from('resume_library')
		.select('*')
		.eq('user_id', input.userId)
		.limit(limit * 3); // Get more results to score and filter

	// Filter by similar job titles if possible
	const roleLower = input.targetRole.toLowerCase();
	query = query.or(`job_title.ilike.%${roleLower}%,industry.ilike.%${roleLower}%`);

	const { data: entries, error } = await query;

	if (error) {
		throw new Error(`Text search failed: ${error.message}`);
	}

	if (!entries || entries.length === 0) {
		// Try broader search without role filter
		const { data: allEntries, error: allError } = await supabase
			.from('resume_library')
			.select('*')
			.eq('user_id', input.userId)
			.order('created_at', { ascending: false })
			.limit(limit);

		if (allError || !allEntries) {
			return [];
		}

		return scoreAndRankResults(allEntries, input, limit);
	}

	return scoreAndRankResults(entries, input, limit);
}

/**
 * Score and rank text-based search results
 */
function scoreAndRankResults(
	entries: DatabaseResumeLibraryRow[],
	input: LibrarySearchInput,
	limit: number
): LibrarySearchResult[] {
	const scoredResults: LibrarySearchResult[] = entries.map((entry) => {
		const libraryEntry = mapDatabaseRowToEntry(entry);
		const score = calculateTextSimilarity(libraryEntry, input);
		const patterns = extractPatterns(libraryEntry, input);

		return {
			entry: libraryEntry,
			// Score is already 0-100
			similarity: score,
			applicablePatterns: patterns
		};
	});

	// Sort by similarity score and return top results
	return scoredResults.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

/**
 * Calculate text-based similarity score (0-100)
 */
function calculateTextSimilarity(entry: ResumeLibraryEntry, input: LibrarySearchInput): number {
	let score = 0;

	// Job title similarity (up to 30 points)
	const roleLower = input.targetRole.toLowerCase();
	const entryTitle = getJobTitleFromContent(entry.resumeContent).toLowerCase();

	if (entryTitle === roleLower) {
		score += 30;
	} else if (entryTitle.includes(roleLower) || roleLower.includes(entryTitle)) {
		score += 20;
	} else {
		// Check for common words
		const roleWords = new Set(roleLower.split(/\s+/));
		const titleWords = entryTitle.split(/\s+/);
		const commonWords = titleWords.filter((w) => roleWords.has(w)).length;
		score += Math.min(commonWords * 5, 15);
	}

	// Skill overlap (up to 50 points)
	const entrySkills = extractSkillsFromContent(entry.resumeContent);
	const matchedSkills = input.requiredSkills.filter((skill) =>
		entrySkills.some(
			(es) => es.toLowerCase() === skill.toLowerCase() || es.toLowerCase().includes(skill.toLowerCase())
		)
	);
	const skillOverlap =
		input.requiredSkills.length > 0 ? matchedSkills.length / input.requiredSkills.length : 0;
	score += Math.round(skillOverlap * 50);

	// Successful outcome bonus (up to 20 points)
	const outcome = entry.outcome;
	if (outcome?.applied) {
		if (outcome.response === 'offer') {
			score += 20;
		} else if (outcome.response === 'interview') {
			score += 15;
		} else if (outcome.response !== 'rejection') {
			score += 5;
		}
	}

	return Math.min(score, 100);
}

/**
 * Extract job title from resume content
 */
function getJobTitleFromContent(content: string): string {
	// Look for a title at the beginning or in a heading
	const titleMatch = content.match(/^#\s*(.+)$/m) || content.match(/^(.+)\n/);
	return titleMatch ? titleMatch[1].trim() : '';
}

/**
 * Extract skills from resume content (simple extraction)
 */
function extractSkillsFromContent(content: string): string[] {
	// Look for skills section
	const skillsMatch = content.match(/(?:skills|technologies|tech stack)[:\s]*([^\n]+(?:\n[-*].*)*)/i);
	if (skillsMatch) {
		// Extract bullet points or comma-separated skills
		const skillsText = skillsMatch[1];
		const skills = skillsText
			.split(/[,\n]/)
			.map((s) => s.replace(/^[-*•]\s*/, '').trim())
			.filter((s) => s.length > 0 && s.length < 50);
		return skills;
	}

	// Fallback: look for common tech keywords
	const techKeywords = [
		'javascript',
		'typescript',
		'python',
		'java',
		'react',
		'node',
		'aws',
		'docker',
		'kubernetes',
		'sql',
		'postgresql',
		'mongodb',
		'git',
		'agile',
		'scrum'
	];
	const contentLower = content.toLowerCase();
	return techKeywords.filter((kw) => contentLower.includes(kw));
}

/**
 * Build search text for embedding generation
 */
function buildSearchText(input: LibrarySearchInput): string {
	const parts = [
		`Target role: ${input.targetRole}`,
		`Required skills: ${input.requiredSkills.join(', ')}`,
		`Job description: ${input.jobDescription.slice(0, 1500)}`
	];
	return parts.join('\n\n');
}

/**
 * Extract applicable patterns from a resume entry
 */
function extractPatterns(entry: ResumeLibraryEntry, input: LibrarySearchInput): ApplicablePattern[] {
	const patterns: ApplicablePattern[] = [];

	// Pattern 1: Skill match patterns from matched requirements
	if (entry.matchedRequirements && entry.matchedRequirements.length > 0) {
		const relevantMatches = entry.matchedRequirements.filter((mr) => {
			const hasHighConfidence = mr.confidence.overall >= 70;
			const matchesInputSkills = input.requiredSkills.some((skill) =>
				mr.requirement.toLowerCase().includes(skill.toLowerCase())
			);
			return hasHighConfidence && matchesInputSkills;
		});

		for (const match of relevantMatches.slice(0, 2)) {
			patterns.push({
				patternType: 'skill_match',
				description: `High-confidence match for requirement: "${match.requirement.slice(0, 60)}..."`,
				confidence: match.confidence.overall
			});
		}
	}

	// Pattern 2: Reframing patterns from matched content with reframing strategies
	const reframedContent = entry.matchedRequirements?.filter((mr) => mr.reframingStrategy);
	if (reframedContent && reframedContent.length > 0) {
		for (const content of reframedContent.slice(0, 2)) {
			patterns.push({
				patternType: 'reframing',
				description: `${content.reframingStrategy!.type} strategy: Reframed content to align with "${content.requirement.slice(0, 40)}..."`,
				confidence: content.confidence.overall
			});
		}
	}

	// Pattern 3: Gap mitigation strategies
	if (entry.gaps && entry.gaps.length > 0) {
		const mitigatedGaps = entry.gaps.filter(
			(g) => g.mitigationStrategies && g.mitigationStrategies.length > 0
		);
		for (const gap of mitigatedGaps.slice(0, 2)) {
			const bestStrategy = gap.mitigationStrategies[0];
			patterns.push({
				patternType: 'gap_mitigation',
				description: `${bestStrategy.type}: ${bestStrategy.description.slice(0, 60)}...`,
				confidence: bestStrategy.confidence
			});
		}
	}

	// Pattern 4: Structure patterns from high-scoring resumes
	if (entry.atsScore >= 80 || entry.matchScore >= 80) {
		const sections = extractSectionStructure(entry.resumeContent);
		if (sections.length >= 3) {
			patterns.push({
				patternType: 'structure',
				description: `High-performing structure (ATS: ${entry.atsScore}, Match: ${entry.matchScore}): ${sections.slice(0, 4).join(' > ')}`,
				confidence: Math.max(entry.atsScore, entry.matchScore)
			});
		}
	}

	return patterns;
}

/**
 * Extract section structure from resume content
 */
function extractSectionStructure(content: string): string[] {
	const headerMatches = content.match(/^#{1,3}\s*(.+)$/gm);
	if (!headerMatches) return [];

	return headerMatches.map((h) => h.replace(/^#{1,3}\s*/, '').trim()).slice(0, 6);
}

/**
 * Aggregate patterns from multiple successful resumes
 */
function aggregatePatterns(results: LibrarySearchResult[]): ApplicablePattern[] {
	if (results.length === 0) return [];

	// Collect all patterns
	const allPatterns = results.flatMap((r) => r.applicablePatterns);

	// Group by type
	const byType = new Map<PatternType, ApplicablePattern[]>();
	for (const pattern of allPatterns) {
		const existing = byType.get(pattern.patternType) || [];
		existing.push(pattern);
		byType.set(pattern.patternType, existing);
	}

	// Select best pattern of each type
	const recommended: ApplicablePattern[] = [];
	const types: PatternType[] = ['skill_match', 'reframing', 'gap_mitigation', 'structure'];

	for (const type of types) {
		const patterns = byType.get(type);
		if (!patterns || patterns.length === 0) continue;

		// Sort by confidence and take the best
		patterns.sort((a, b) => b.confidence - a.confidence);
		const best = patterns[0];

		// Boost confidence if pattern appears in multiple successful resumes
		const frequency = patterns.length;
		const adjustedConfidence = Math.min(best.confidence + frequency * 5, 100);

		recommended.push({
			...best,
			confidence: adjustedConfidence,
			description:
				frequency > 1
					? `${best.description} (found in ${frequency} successful resumes)`
					: best.description
		});
	}

	// Sort by confidence
	return recommended.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

/**
 * Generate a summary of found patterns
 */
function generatePatternSummary(
	results: LibrarySearchResult[],
	recommendedStrategies: ApplicablePattern[]
): string {
	if (results.length === 0) {
		return 'No similar resumes found in your library. This will be your first resume for a role like this.';
	}

	const successfulCount = results.filter((r) => {
		const outcome = r.entry.outcome;
		return outcome?.applied && (outcome.response === 'interview' || outcome.response === 'offer');
	}).length;

	const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

	const parts = [`Found ${results.length} similar resume(s) in your library.`];

	if (successfulCount > 0) {
		parts.push(`${successfulCount} of these led to positive outcomes.`);
	}

	if (avgSimilarity > 70) {
		parts.push('High similarity to past applications suggests strong transferable patterns.');
	} else if (avgSimilarity > 40) {
		parts.push('Moderate similarity provides some applicable strategies.');
	}

	if (recommendedStrategies.length > 0) {
		const topStrategies = recommendedStrategies.slice(0, 3).map((s) => s.patternType);
		parts.push(`Key patterns to apply: ${topStrategies.join(', ')}.`);
	}

	return parts.join(' ');
}

// =============================================================================
// Database Row Types
// =============================================================================

/**
 * Database row type for resume_library table
 */
interface DatabaseResumeLibraryRow {
	id: string;
	user_id: string;
	job_id: string;
	resume_content: string;
	resume_hash: string;
	match_score: number;
	ats_score: number;
	confidence_score: unknown; // JSONB - number
	matched_requirements: unknown; // JSONB - MatchedContent[]
	gaps: unknown; // JSONB - GapAnalysis[]
	reframing_strategies: unknown; // JSONB (legacy, content now in matched_requirements)
	outcome: unknown; // JSONB - LibraryOutcome
	job_title: string;
	company: string;
	industry: string | null;
	embedding: number[] | null;
	created_at: string;
	updated_at: string;
}

/**
 * Map database row to ResumeLibraryEntry
 */
function mapDatabaseRowToEntry(row: DatabaseResumeLibraryRow): ResumeLibraryEntry {
	// Parse confidence score - can be number or object from database
	let confidence: number;
	if (typeof row.confidence_score === 'number') {
		confidence = row.confidence_score;
	} else if (
		row.confidence_score &&
		typeof row.confidence_score === 'object' &&
		'overall' in row.confidence_score
	) {
		confidence = (row.confidence_score as { overall: number }).overall;
	} else {
		confidence = 0;
	}

	// Parse matched requirements
	const matchedRequirements = parseJsonbArray<MatchedContent>(row.matched_requirements);

	// Parse gaps
	const gaps = parseJsonbArray<GapAnalysis>(row.gaps);

	// Parse outcome
	const outcomeData = row.outcome as {
		applied?: boolean;
		response?: 'interview' | 'rejection' | 'offer' | 'no_response';
		feedback?: string;
		updatedAt?: string;
	} | null;

	const outcome = outcomeData
		? {
				applied: outcomeData.applied ?? false,
				response: outcomeData.response,
				feedback: outcomeData.feedback,
				updatedAt: outcomeData.updatedAt ? new Date(outcomeData.updatedAt) : new Date()
			}
		: undefined;

	return {
		id: row.id,
		userId: row.user_id,
		jobId: row.job_id,
		resumeContent: row.resume_content,
		matchScore: row.match_score,
		atsScore: row.ats_score,
		confidence,
		matchedRequirements,
		gaps,
		outcome,
		createdAt: new Date(row.created_at)
	};
}

/**
 * Parse JSONB array from database
 */
function parseJsonbArray<T>(value: unknown): T[] {
	if (Array.isArray(value)) {
		return value as T[];
	}
	return [];
}
