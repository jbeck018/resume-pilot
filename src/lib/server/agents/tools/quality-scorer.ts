// =============================================================================
// Quality Scorer Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult, QualityScore, QualityIssue, JobInfo } from '../types';
import { complete } from '../../llm/client';

export interface QualityScoreInput {
	content: string;
	contentType: 'resume' | 'cover_letter';
	targetJob?: JobInfo;
	originalProfile?: {
		skills: string[];
		experience: Array<{ title: string; company: string }>;
	};
}

export interface QualityScoreOutput extends QualityScore {
	passed: boolean;
	criticalIssues: QualityIssue[];
}

/**
 * Quality Scorer Tool
 * Evaluates quality of generated resumes and cover letters
 */
export const QualityScorerTool: ToolDefinition<QualityScoreInput, QualityScoreOutput> = {
	id: 'quality-scorer',
	name: 'Quality Scorer',
	description:
		'Score the quality of generated content including ATS compatibility, ' +
		'keyword coverage, format quality, and content relevance.',
	inputSchema: {
		type: 'object',
		properties: {
			content: { type: 'string', description: 'Content to score' },
			contentType: {
				type: 'string',
				enum: ['resume', 'cover_letter'],
				description: 'Type of content'
			},
			targetJob: { type: 'object', description: 'Target job for relevance scoring' },
			originalProfile: { type: 'object', description: 'Original profile for accuracy checking' }
		},
		required: ['content', 'contentType']
	},

	async execute(input: QualityScoreInput, context: ToolContext): Promise<ToolResult<QualityScoreOutput>> {
		const startTime = Date.now();

		try {
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Scoring cancelled',
					durationMs: Date.now() - startTime
				};
			}

			// Run multiple quality checks in parallel
			const [atsScore, keywordScore, formatScore, contentScore] = await Promise.all([
				checkATSCompatibility(input.content, input.contentType),
				checkKeywordCoverage(input.content, input.targetJob),
				checkFormatQuality(input.content, input.contentType),
				checkContentRelevance(input.content, input.targetJob, input.originalProfile, context)
			]);

			// Collect all issues
			const allIssues: QualityIssue[] = [
				...atsScore.issues,
				...keywordScore.issues,
				...formatScore.issues,
				...contentScore.issues
			];

			// Calculate overall score (weighted average)
			const weights = { ats: 0.3, keyword: 0.25, format: 0.2, content: 0.25 };
			const overall = Math.round(
				atsScore.score * weights.ats +
					keywordScore.score * weights.keyword +
					formatScore.score * weights.format +
					contentScore.score * weights.content
			);

			// Identify critical issues
			const criticalIssues = allIssues.filter((i) => i.type === 'error');

			// Determine if content passes quality threshold
			const passed = overall >= 70 && criticalIssues.length === 0;

			const result: QualityScoreOutput = {
				overall,
				atsCompatibility: atsScore.score,
				keywordCoverage: keywordScore.score,
				formatQuality: formatScore.score,
				contentRelevance: contentScore.score,
				issues: allIssues,
				suggestions: generateSuggestions(allIssues, input.contentType),
				passed,
				criticalIssues
			};

			return {
				success: true,
				data: result,
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Scoring failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

interface ScoreResult {
	score: number;
	issues: QualityIssue[];
}

/**
 * Check ATS (Applicant Tracking System) compatibility
 */
function checkATSCompatibility(content: string, contentType: string): ScoreResult {
	const issues: QualityIssue[] = [];
	let score = 100;

	// Check for tables (ATS unfriendly)
	if (content.includes('|---') || content.includes('<table>')) {
		issues.push({
			type: 'warning',
			category: 'ats',
			message: 'Tables may not parse correctly in ATS systems',
			location: 'document'
		});
		score -= 15;
	}

	// Check for images/graphics references
	if (content.match(/!\[.*\]\(.*\)/) || content.includes('<img')) {
		issues.push({
			type: 'warning',
			category: 'ats',
			message: 'Images and graphics are ignored by ATS systems',
			location: 'document'
		});
		score -= 10;
	}

	// Check for special characters that might cause issues
	const problematicChars = content.match(/[^\x00-\x7F]/g);
	if (problematicChars && problematicChars.length > 10) {
		issues.push({
			type: 'info',
			category: 'ats',
			message: 'Contains special characters that may not render correctly',
			location: 'document'
		});
		score -= 5;
	}

	// Check for clear section headers
	const headerPatterns = [
		/#{1,3}\s*(experience|work|employment)/i,
		/#{1,3}\s*(education|academic)/i,
		/#{1,3}\s*(skills|competencies|expertise)/i
	];

	if (contentType === 'resume') {
		const missingHeaders = headerPatterns.filter((p) => !p.test(content));
		if (missingHeaders.length > 0) {
			issues.push({
				type: 'warning',
				category: 'ats',
				message: 'Missing standard section headers that ATS systems look for',
				location: 'document'
			});
			score -= 10 * missingHeaders.length;
		}
	}

	// Check for contact information
	if (contentType === 'resume') {
		const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(content);
		const hasPhone = /[\d\s\-\(\)]{10,}/.test(content);

		if (!hasEmail) {
			issues.push({
				type: 'error',
				category: 'ats',
				message: 'Missing email address',
				location: 'header'
			});
			score -= 20;
		}

		if (!hasPhone) {
			issues.push({
				type: 'warning',
				category: 'ats',
				message: 'Missing phone number',
				location: 'header'
			});
			score -= 10;
		}
	}

	return { score: Math.max(0, score), issues };
}

/**
 * Check keyword coverage against job requirements
 */
function checkKeywordCoverage(content: string, targetJob?: JobInfo): ScoreResult {
	const issues: QualityIssue[] = [];

	if (!targetJob) {
		return { score: 100, issues: [] };
	}

	const contentLower = content.toLowerCase();

	// Extract keywords from job description
	const jobKeywords = extractKeywords(targetJob.description);
	const requirementKeywords = (targetJob.requirements || []).flatMap((r) => extractKeywords(r));

	const allKeywords = [...new Set([...jobKeywords, ...requirementKeywords])];

	// Count matches
	const matchedKeywords = allKeywords.filter((kw) => contentLower.includes(kw.toLowerCase()));
	const coverage = allKeywords.length > 0 ? matchedKeywords.length / allKeywords.length : 1;

	const score = Math.round(coverage * 100);

	// Report missing important keywords
	const missingKeywords = allKeywords
		.filter((kw) => !contentLower.includes(kw.toLowerCase()))
		.slice(0, 5);

	if (missingKeywords.length > 0) {
		issues.push({
			type: coverage < 0.5 ? 'error' : 'warning',
			category: 'keyword',
			message: `Missing keywords: ${missingKeywords.join(', ')}`,
			location: 'document'
		});
	}

	return { score, issues };
}

/**
 * Check format quality
 */
function checkFormatQuality(content: string, contentType: string): ScoreResult {
	const issues: QualityIssue[] = [];
	let score = 100;

	// Check length
	const wordCount = content.split(/\s+/).length;

	if (contentType === 'resume') {
		if (wordCount < 200) {
			issues.push({
				type: 'warning',
				category: 'format',
				message: 'Resume seems too short',
				location: 'document'
			});
			score -= 20;
		} else if (wordCount > 1000) {
			issues.push({
				type: 'info',
				category: 'format',
				message: 'Resume may be too long (consider condensing)',
				location: 'document'
			});
			score -= 10;
		}
	} else if (contentType === 'cover_letter') {
		if (wordCount < 150) {
			issues.push({
				type: 'warning',
				category: 'format',
				message: 'Cover letter seems too short',
				location: 'document'
			});
			score -= 15;
		} else if (wordCount > 500) {
			issues.push({
				type: 'info',
				category: 'format',
				message: 'Cover letter may be too long (aim for 300-400 words)',
				location: 'document'
			});
			score -= 10;
		}
	}

	// Check for bullet points in resume
	if (contentType === 'resume') {
		const bulletCount = (content.match(/^[-*]\s/gm) || []).length;
		if (bulletCount < 5) {
			issues.push({
				type: 'info',
				category: 'format',
				message: 'Consider using more bullet points for better readability',
				location: 'experience'
			});
			score -= 5;
		}
	}

	// Check for consistent formatting
	const headers = content.match(/^#{1,3}\s/gm) || [];
	if (headers.length === 0 && contentType === 'resume') {
		issues.push({
			type: 'warning',
			category: 'format',
			message: 'No section headers found',
			location: 'document'
		});
		score -= 15;
	}

	return { score: Math.max(0, score), issues };
}

/**
 * Check content relevance using LLM
 */
async function checkContentRelevance(
	content: string,
	targetJob: JobInfo | undefined,
	originalProfile: { skills: string[]; experience: Array<{ title: string; company: string }> } | undefined,
	context: ToolContext
): Promise<ScoreResult> {
	if (!targetJob && !originalProfile) {
		return { score: 100, issues: [] };
	}

	const prompt = `Evaluate the relevance and accuracy of this resume/cover letter content.

CONTENT:
${content.slice(0, 2000)}

${targetJob ? `TARGET JOB: ${targetJob.title} at ${targetJob.company}` : ''}
${originalProfile ? `ORIGINAL SKILLS: ${originalProfile.skills.slice(0, 10).join(', ')}` : ''}

Score from 0-100 based on:
1. Relevance to target job (if provided)
2. Accuracy - no fabricated information
3. Professional tone and language
4. Clear value proposition

Return JSON:
{
  "score": number,
  "issues": [
    {"type": "error|warning|info", "message": "string"}
  ]
}`;

	try {
		const result = await complete({
			model: 'gemini-1.5-flash',
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 500,
			temperature: 0.2,
			userId: context.userId,
			metadata: { purpose: 'content-relevance' }
		});

		const jsonMatch = result.content.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			return {
				score: parsed.score || 80,
				issues: (parsed.issues || []).map((i: { type: string; message: string }) => ({
					...i,
					category: 'content' as const
				}))
			};
		}
	} catch (error) {
		console.error('Content relevance check failed:', error);
	}

	return { score: 80, issues: [] };
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
	// Simple keyword extraction - in production, use NLP
	const stopWords = new Set([
		'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
		'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
		'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
		'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
		'we', 'you', 'they', 'them', 'their', 'our', 'your', 'its', 'this',
		'that', 'these', 'those', 'which', 'who', 'whom', 'what', 'when',
		'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
		'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
		'same', 'so', 'than', 'too', 'very', 'just', 'also', 'any'
	]);

	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 2 && !stopWords.has(word))
		.slice(0, 50);
}

/**
 * Generate improvement suggestions based on issues
 */
function generateSuggestions(issues: QualityIssue[], contentType: string): string[] {
	const suggestions: string[] = [];

	const hasATSIssues = issues.some((i) => i.category === 'ats' && i.type !== 'info');
	const hasKeywordIssues = issues.some((i) => i.category === 'keyword');
	const hasFormatIssues = issues.some((i) => i.category === 'format');
	const hasContentIssues = issues.some((i) => i.category === 'content');

	if (hasATSIssues) {
		suggestions.push('Simplify formatting to improve ATS compatibility');
		if (contentType === 'resume') {
			suggestions.push('Use standard section headers (Experience, Education, Skills)');
		}
	}

	if (hasKeywordIssues) {
		suggestions.push('Incorporate more keywords from the job description naturally');
	}

	if (hasFormatIssues) {
		if (contentType === 'resume') {
			suggestions.push('Use bullet points to highlight achievements');
			suggestions.push('Keep resume to 1-2 pages');
		} else {
			suggestions.push('Keep cover letter to 3-4 paragraphs');
		}
	}

	if (hasContentIssues) {
		suggestions.push('Focus on quantifiable achievements');
		suggestions.push('Tailor content more specifically to the role');
	}

	return suggestions;
}
