// Embedding service for semantic job matching using OpenAI text-embedding-3-small
// Provides functions to generate, store, and search embeddings using pgvector

import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import type { Database } from '$lib/server/database/types';

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// Cost per 1M tokens for text-embedding-3-small (in cents)
const EMBEDDING_COST_PER_1M_TOKENS = 2; // $0.02 per 1M tokens

export interface EmbeddingResult {
	embedding: number[];
	tokensUsed: number;
	cost: number; // in cents
}

export interface JobMatch {
	id: string;
	title: string;
	company: string;
	similarity: number;
}

export interface ProfileEmbeddingInput {
	fullName?: string | null;
	headline?: string | null;
	summary?: string | null;
	skills?: string[];
	preferredRoles?: string[];
	experience?: Array<{
		title: string;
		company: string;
		description?: string;
		skills?: string[];
	}>;
	idealJobDescription?: string | null;
}

export interface JobEmbeddingInput {
	title: string;
	company: string;
	description?: string | null;
	requirements?: string[] | null;
	location?: string | null;
	employmentType?: string | null;
	experienceLevel?: string | null;
}

/**
 * Generate an embedding vector for the given text using OpenAI's text-embedding-3-small model
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
	if (!OPENAI_API_KEY) {
		throw new Error('OPENAI_API_KEY is not configured');
	}

	if (!text || text.trim().length === 0) {
		throw new Error('Text cannot be empty for embedding generation');
	}

	// Truncate text if too long (model has 8191 token limit, ~4 chars per token)
	const maxChars = 30000;
	const truncatedText = text.length > maxChars ? text.slice(0, maxChars) : text;

	const response = await fetch('https://api.openai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${OPENAI_API_KEY}`
		},
		body: JSON.stringify({
			model: OPENAI_EMBEDDING_MODEL,
			input: truncatedText,
			dimensions: EMBEDDING_DIMENSIONS
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
		throw new Error(`OpenAI embedding API error: ${error.error?.message || response.statusText}`);
	}

	const data = await response.json();
	const embedding = data.data[0].embedding as number[];
	const tokensUsed = data.usage?.total_tokens || 0;
	const cost = Math.ceil((tokensUsed * EMBEDDING_COST_PER_1M_TOKENS) / 1_000_000);

	return {
		embedding,
		tokensUsed,
		cost
	};
}

/**
 * Build a text representation of a user profile for embedding
 */
export function buildProfileText(profile: ProfileEmbeddingInput): string {
	const parts: string[] = [];

	if (profile.headline) {
		parts.push(`Professional headline: ${profile.headline}`);
	}

	if (profile.summary) {
		parts.push(`Professional summary: ${profile.summary}`);
	}

	if (profile.skills && profile.skills.length > 0) {
		parts.push(`Skills: ${profile.skills.join(', ')}`);
	}

	if (profile.preferredRoles && profile.preferredRoles.length > 0) {
		parts.push(`Preferred job roles: ${profile.preferredRoles.join(', ')}`);
	}

	if (profile.idealJobDescription) {
		parts.push(`Ideal job description: ${profile.idealJobDescription}`);
	}

	if (profile.experience && profile.experience.length > 0) {
		const experienceText = profile.experience
			.slice(0, 5) // Limit to most recent 5 positions
			.map((exp) => {
				let text = `${exp.title} at ${exp.company}`;
				if (exp.description) {
					text += `: ${exp.description}`;
				}
				if (exp.skills && exp.skills.length > 0) {
					text += ` (Skills: ${exp.skills.join(', ')})`;
				}
				return text;
			})
			.join('. ');
		parts.push(`Work experience: ${experienceText}`);
	}

	return parts.join('\n\n');
}

/**
 * Build a text representation of a job for embedding
 */
export function buildJobText(job: JobEmbeddingInput): string {
	const parts: string[] = [];

	parts.push(`Job title: ${job.title}`);
	parts.push(`Company: ${job.company}`);

	if (job.location) {
		parts.push(`Location: ${job.location}`);
	}

	if (job.employmentType) {
		parts.push(`Employment type: ${job.employmentType}`);
	}

	if (job.experienceLevel) {
		parts.push(`Experience level: ${job.experienceLevel}`);
	}

	if (job.description) {
		parts.push(`Job description: ${job.description}`);
	}

	if (job.requirements && job.requirements.length > 0) {
		parts.push(`Requirements: ${job.requirements.join('. ')}`);
	}

	return parts.join('\n\n');
}

/**
 * Create a Supabase client with service role for server-side operations
 */
function getServiceClient() {
	return createServerClient<Database>(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
		cookies: {
			getAll: () => [],
			setAll: () => {}
		}
	});
}

/**
 * Generate and store embedding for a user profile
 */
export async function generateAndStoreProfileEmbedding(
	userId: string,
	profile: ProfileEmbeddingInput
): Promise<{ success: boolean; tokensUsed: number; cost: number }> {
	const supabase = getServiceClient();

	const profileText = buildProfileText(profile);

	if (!profileText || profileText.trim().length < 10) {
		// Not enough profile data to generate meaningful embedding
		return { success: false, tokensUsed: 0, cost: 0 };
	}

	const { embedding, tokensUsed, cost } = await generateEmbedding(profileText);

	// Store embedding in profile
	// Note: pgvector embeddings require casting through the Supabase client
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error } = await (supabase as any)
		.from('profiles')
		.update({
			embedding: embedding,
			updated_at: new Date().toISOString()
		})
		.eq('user_id', userId);

	if (error) {
		throw new Error(`Failed to store profile embedding: ${error.message}`);
	}

	return { success: true, tokensUsed, cost };
}

/**
 * Generate and store embedding for a job
 */
export async function generateAndStoreJobEmbedding(
	jobId: string,
	job: JobEmbeddingInput
): Promise<{ success: boolean; tokensUsed: number; cost: number }> {
	const supabase = getServiceClient();

	const jobText = buildJobText(job);

	if (!jobText || jobText.trim().length < 10) {
		return { success: false, tokensUsed: 0, cost: 0 };
	}

	const { embedding, tokensUsed, cost } = await generateEmbedding(jobText);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error } = await (supabase as any)
		.from('jobs')
		.update({
			embedding: embedding,
			updated_at: new Date().toISOString()
		})
		.eq('id', jobId);

	if (error) {
		throw new Error(`Failed to store job embedding: ${error.message}`);
	}

	return { success: true, tokensUsed, cost };
}

/**
 * Generate embeddings for multiple jobs in batch
 */
export async function generateAndStoreJobEmbeddingsBatch(
	jobs: Array<{ id: string } & JobEmbeddingInput>
): Promise<{ successful: number; failed: number; totalTokens: number; totalCost: number }> {
	const results = {
		successful: 0,
		failed: 0,
		totalTokens: 0,
		totalCost: 0
	};

	// Process in batches of 10 to avoid rate limiting
	const batchSize = 10;
	for (let i = 0; i < jobs.length; i += batchSize) {
		const batch = jobs.slice(i, i + batchSize);

		await Promise.all(
			batch.map(async (job) => {
				try {
					const result = await generateAndStoreJobEmbedding(job.id, job);
					if (result.success) {
						results.successful++;
						results.totalTokens += result.tokensUsed;
						results.totalCost += result.cost;
					} else {
						results.failed++;
					}
				} catch (error) {
					console.error(`Failed to generate embedding for job ${job.id}:`, error);
					results.failed++;
				}
			})
		);

		// Small delay between batches to respect rate limits
		if (i + batchSize < jobs.length) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	return results;
}

/**
 * Find matching jobs using vector similarity search via the match_jobs SQL function
 */
export async function findMatchingJobs(
	profileEmbedding: number[],
	userId: string,
	options: {
		matchThreshold?: number;
		matchCount?: number;
	} = {}
): Promise<JobMatch[]> {
	const supabase = getServiceClient();

	const { matchThreshold = 0.5, matchCount = 20 } = options;

	// Call the match_jobs RPC function defined in the migration
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data, error } = await (supabase as any).rpc('match_jobs', {
		query_embedding: profileEmbedding,
		match_threshold: matchThreshold,
		match_count: matchCount,
		target_user_id: userId
	});

	if (error) {
		throw new Error(`Job matching failed: ${error.message}`);
	}

	interface MatchJobsResult {
		id: string;
		title: string;
		company: string;
		similarity: number;
	}

	return ((data || []) as MatchJobsResult[]).map((row) => ({
		id: row.id,
		title: row.title,
		company: row.company,
		similarity: row.similarity
	}));
}

/**
 * Get profile embedding for a user
 */
export async function getProfileEmbedding(userId: string): Promise<number[] | null> {
	const supabase = getServiceClient();

	const { data, error } = await supabase
		.from('profiles')
		.select('embedding')
		.eq('user_id', userId)
		.single();

	if (error || !data) {
		return null;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (data as any).embedding as number[] | null;
}

/**
 * Check if embeddings are available for matching (profile has embedding)
 */
export async function hasProfileEmbedding(userId: string): Promise<boolean> {
	const embedding = await getProfileEmbedding(userId);
	return embedding !== null && Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS;
}

/**
 * Calculate similarity score between two embeddings using cosine similarity
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error('Embeddings must have the same dimensions');
	}

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
	if (magnitude === 0) return 0;

	return dotProduct / magnitude;
}

/**
 * Score jobs using embedding similarity when profile has embedding
 * Falls back to keyword matching if embeddings are unavailable
 */
export async function scoreJobsWithEmbeddings(
	jobs: Array<{
		id: string;
		title: string;
		company: string;
		description?: string | null;
		requirements?: string[] | null;
		location?: string | null;
		isRemote?: boolean;
		embedding?: number[] | null;
	}>,
	profile: {
		userId: string;
		skills?: string[];
		preferredRoles?: string[];
		remotePreference?: string;
		embedding?: number[] | null;
	}
): Promise<
	Array<{
		id: string;
		matchScore: number;
		matchReasons: string[];
		usedEmbedding: boolean;
	}>
> {
	const results: Array<{
		id: string;
		matchScore: number;
		matchReasons: string[];
		usedEmbedding: boolean;
	}> = [];

	// Check if profile has embedding
	const profileEmbedding = profile.embedding || (await getProfileEmbedding(profile.userId));
	const hasValidProfileEmbedding =
		profileEmbedding && Array.isArray(profileEmbedding) && profileEmbedding.length === EMBEDDING_DIMENSIONS;

	for (const job of jobs) {
		let matchScore = 0;
		const matchReasons: string[] = [];
		let usedEmbedding = false;

		// Try embedding-based matching first
		if (hasValidProfileEmbedding && job.embedding && job.embedding.length === EMBEDDING_DIMENSIONS) {
			const similarity = calculateCosineSimilarity(profileEmbedding!, job.embedding);
			// Convert similarity (0-1) to score (0-100), with higher weight for embedding match
			matchScore = Math.round(similarity * 70); // Up to 70 points from embedding
			usedEmbedding = true;

			if (similarity >= 0.8) {
				matchReasons.push('Highly relevant to your profile');
			} else if (similarity >= 0.6) {
				matchReasons.push('Good match for your background');
			} else if (similarity >= 0.4) {
				matchReasons.push('Moderately relevant to your experience');
			}
		}

		// Add keyword-based scoring (supplements embedding or serves as fallback)
		const jobText = `${job.title} ${job.description || ''} ${(job.requirements || []).join(' ')}`.toLowerCase();

		// Skill matching (up to 15 points)
		let skillMatches = 0;
		for (const skill of profile.skills || []) {
			if (jobText.includes(skill.toLowerCase())) {
				skillMatches++;
			}
		}
		if (skillMatches > 0) {
			const skillScore = Math.min(skillMatches * 3, 15);
			matchScore += skillScore;
			matchReasons.push(`Matches ${skillMatches} of your skills`);
		}

		// Role matching (up to 10 points)
		for (const role of profile.preferredRoles || []) {
			if (job.title.toLowerCase().includes(role.toLowerCase())) {
				matchScore += 10;
				matchReasons.push(`Matches preferred role: ${role}`);
				break; // Only count once
			}
		}

		// Remote preference (up to 5 points)
		if (job.isRemote && profile.remotePreference === 'remote') {
			matchScore += 5;
			matchReasons.push('Remote position matches your preference');
		} else if (!job.isRemote && profile.remotePreference === 'onsite') {
			matchScore += 5;
			matchReasons.push('On-site position matches your preference');
		}

		// Cap at 100
		matchScore = Math.min(matchScore, 100);

		results.push({
			id: job.id,
			matchScore,
			matchReasons,
			usedEmbedding
		});
	}

	// Sort by match score descending
	return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Update profile embedding when profile is saved
 * This should be called after profile updates
 */
export async function updateProfileEmbeddingOnSave(
	userId: string,
	profileData: ProfileEmbeddingInput
): Promise<void> {
	try {
		// Only generate embedding if there's sufficient profile data
		const profileText = buildProfileText(profileData);
		if (profileText.trim().length < 50) {
			// Not enough data for meaningful embedding
			return;
		}

		await generateAndStoreProfileEmbedding(userId, profileData);
	} catch (error) {
		// Log but don't fail the profile save
		console.error('Failed to update profile embedding:', error);
	}
}
