// =============================================================================
// Gap Analyzer Tool
// =============================================================================

import type { ToolDefinition, ToolContext, ToolResult, ProfileInfo, ExtractedSkill } from '../types';
import type { MatchedContent } from '../types/confidence';
import type {
	GapAnalysis,
	GapType,
	GapSeverity,
	MitigationStrategy,
	MitigationStrategyType,
	CoverLetterRecommendation,
	CoverLetterPlacement
} from '../types/assembly';
import { complete } from '../../llm/client';

// -----------------------------------------------------------------------------
// Input/Output Types
// -----------------------------------------------------------------------------

export interface GapAnalyzerInput {
	/**
	 * Extracted requirements from the job description
	 */
	requirements: ExtractedSkill[];

	/**
	 * Matched content from the content matching phase
	 */
	matchedContent: MatchedContent[];

	/**
	 * Candidate profile for finding mitigation opportunities
	 */
	profile: ProfileInfo;

	/**
	 * Analysis options
	 */
	options?: {
		/**
		 * Confidence threshold below which a requirement is considered a gap (default: 60)
		 */
		gapThreshold?: number;

		/**
		 * Whether to generate cover letter recommendations (default: true)
		 */
		includeCoverLetterRecs?: boolean;

		/**
		 * Maximum number of mitigation strategies per gap (default: 3)
		 */
		maxMitigationsPerGap?: number;
	};
}

export interface GapAnalyzerOutput {
	/**
	 * Analyzed gaps with mitigation strategies
	 */
	gaps: GapAnalysis[];

	/**
	 * Count of critical gaps (must-have requirements)
	 */
	criticalGapsCount: number;

	/**
	 * Percentage of gaps with viable mitigation strategies (0-100)
	 */
	mitigationCoverage: number;

	/**
	 * Recommendations for addressing gaps in cover letter
	 */
	coverLetterRecommendations: CoverLetterRecommendation[];
}

// -----------------------------------------------------------------------------
// Gap Analyzer Tool Definition
// -----------------------------------------------------------------------------

/**
 * Gap Analyzer Tool
 * Analyzes gaps between job requirements and matched content,
 * providing mitigation strategies and cover letter recommendations.
 */
export const GapAnalyzerTool: ToolDefinition<GapAnalyzerInput, GapAnalyzerOutput> = {
	id: 'gap-analyzer',
	name: 'Gap Analyzer',
	description:
		'Analyze gaps between job requirements and candidate profile content. ' +
		'Provides mitigation strategies and cover letter recommendations for addressing gaps.',
	inputSchema: {
		type: 'object',
		properties: {
			requirements: {
				type: 'array',
				description: 'Extracted skills/requirements from job description'
			},
			matchedContent: {
				type: 'array',
				description: 'Content matched from candidate profile'
			},
			profile: {
				type: 'object',
				description: 'Candidate profile information'
			},
			options: {
				type: 'object',
				description: 'Analysis options',
				properties: {
					gapThreshold: {
						type: 'number',
						description: 'Confidence threshold for gap identification (default: 60)'
					},
					includeCoverLetterRecs: {
						type: 'boolean',
						description: 'Generate cover letter recommendations (default: true)'
					},
					maxMitigationsPerGap: {
						type: 'number',
						description: 'Max mitigation strategies per gap (default: 3)'
					}
				}
			}
		},
		required: ['requirements', 'matchedContent', 'profile']
	},

	async execute(input: GapAnalyzerInput, context: ToolContext): Promise<ToolResult<GapAnalyzerOutput>> {
		const startTime = Date.now();

		try {
			if (context.abortSignal?.aborted) {
				return {
					success: false,
					error: 'Analysis cancelled',
					durationMs: Date.now() - startTime
				};
			}

			const { requirements, matchedContent, profile, options = {} } = input;

			const {
				gapThreshold = 60,
				includeCoverLetterRecs = true,
				maxMitigationsPerGap = 3
			} = options;

			// Step 1: Identify gaps (requirements with confidence < threshold)
			const identifiedGaps = identifyGaps(requirements, matchedContent, gapThreshold);

			// Step 2: Classify and analyze each gap
			const analyzedGaps = await analyzeGaps(identifiedGaps, profile, maxMitigationsPerGap, context);

			// Step 3: Generate cover letter recommendations for significant/critical gaps
			const coverLetterRecommendations = includeCoverLetterRecs
				? await generateCoverLetterRecommendations(analyzedGaps, profile, context)
				: [];

			// Step 4: Calculate metrics
			const criticalGapsCount = analyzedGaps.filter((g) => g.severity === 'critical').length;

			// A gap has viable mitigation if it has at least one strategy with confidence >= 50
			const gapsWithViableMitigation = analyzedGaps.filter((g) =>
				g.mitigationStrategies.some((s) => s.confidence >= 50)
			).length;

			const mitigationCoverage =
				analyzedGaps.length > 0
					? Math.round((gapsWithViableMitigation / analyzedGaps.length) * 100)
					: 100;

			return {
				success: true,
				data: {
					gaps: analyzedGaps,
					criticalGapsCount,
					mitigationCoverage,
					coverLetterRecommendations
				},
				durationMs: Date.now() - startTime
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Gap analysis failed',
				durationMs: Date.now() - startTime
			};
		}
	}
};

// -----------------------------------------------------------------------------
// Gap Identification
// -----------------------------------------------------------------------------

interface IdentifiedGap {
	requirementId: string;
	requirement: string;
	importance: 'required' | 'preferred' | 'nice_to_have';
	category: string;
	confidenceScore: number;
	matchedContent?: MatchedContent;
}

function identifyGaps(
	requirements: ExtractedSkill[],
	matchedContent: MatchedContent[],
	threshold: number
): IdentifiedGap[] {
	const gaps: IdentifiedGap[] = [];

	// Create a map for quick lookup of matched content by requirement
	const matchMap = new Map<string, MatchedContent>();
	for (const match of matchedContent) {
		matchMap.set(match.requirementId, match);
	}

	for (const req of requirements) {
		const reqId = `req-${req.name.toLowerCase().replace(/\s+/g, '-')}`;
		const match = matchMap.get(reqId);
		const confidence = match?.confidence.overall ?? 0;

		if (confidence < threshold) {
			gaps.push({
				requirementId: reqId,
				requirement: req.name,
				importance: req.importance,
				category: req.category,
				confidenceScore: confidence,
				matchedContent: match
			});
		}
	}

	return gaps;
}

// -----------------------------------------------------------------------------
// Gap Classification and Analysis
// -----------------------------------------------------------------------------

function classifyGapType(category: string, requirement: string, confidence: number): GapType {
	const reqLower = requirement.toLowerCase();

	// Check for certification keywords
	if (
		category === 'certification' ||
		reqLower.includes('certif') ||
		reqLower.includes('license') ||
		reqLower.includes('cpa') ||
		reqLower.includes('pmp')
	) {
		return 'missing_certification';
	}

	// Check for experience keywords that indicate insufficient experience
	if (
		reqLower.includes('years') ||
		reqLower.includes('senior') ||
		reqLower.includes('lead') ||
		reqLower.includes('principal')
	) {
		// If there's some match but below threshold, it's insufficient; otherwise seniority gap
		return confidence > 0 ? 'insufficient_experience' : 'seniority_gap';
	}

	// Check for industry-specific terms
	if (
		reqLower.includes('industry') ||
		reqLower.includes('domain') ||
		reqLower.includes('sector') ||
		category === 'domain'
	) {
		return 'industry_mismatch';
	}

	// Check for technical skills
	if (
		category === 'programming_language' ||
		category === 'framework' ||
		category === 'database' ||
		category === 'cloud' ||
		category === 'devops' ||
		category === 'tool'
	) {
		return 'technical_gap';
	}

	// Default to missing_skill for soft skills and other categories
	return 'missing_skill';
}

function classifyGapSeverity(importance: 'required' | 'preferred' | 'nice_to_have'): GapSeverity {
	switch (importance) {
		case 'required':
			return 'critical';
		case 'preferred':
			return 'significant';
		case 'nice_to_have':
			return 'minor';
	}
}

async function analyzeGaps(
	identifiedGaps: IdentifiedGap[],
	profile: ProfileInfo,
	maxMitigations: number,
	context: ToolContext
): Promise<GapAnalysis[]> {
	const analyzedGaps: GapAnalysis[] = [];

	for (const gap of identifiedGaps) {
		const gapType = classifyGapType(gap.category, gap.requirement, gap.confidenceScore);
		const severity = classifyGapSeverity(gap.importance);

		// Generate mitigation strategies
		const mitigationStrategies = await generateMitigationStrategies(
			gap,
			gapType,
			profile,
			maxMitigations,
			context
		);

		analyzedGaps.push({
			requirementId: gap.requirementId,
			requirement: gap.requirement,
			gapType,
			severity,
			mitigationStrategies
		});
	}

	return analyzedGaps;
}

// -----------------------------------------------------------------------------
// Mitigation Strategy Generation
// -----------------------------------------------------------------------------

async function generateMitigationStrategies(
	gap: IdentifiedGap,
	gapType: GapType,
	profile: ProfileInfo,
	maxStrategies: number,
	context: ToolContext
): Promise<MitigationStrategy[]> {
	const strategies: MitigationStrategy[] = [];

	// Strategy 1: Reframe adjacent experience
	const adjacentStrategy = findAdjacentExperience(gap, profile);
	if (adjacentStrategy) {
		strategies.push(adjacentStrategy);
	}

	// Strategy 2: Highlight transferable skills
	const transferableStrategy = findTransferableSkills(gap, profile);
	if (transferableStrategy) {
		strategies.push(transferableStrategy);
	}

	// Strategy 3: Cover letter approach (for significant/critical gaps)
	if (gap.importance !== 'nice_to_have') {
		const coverLetterStrategy = generateCoverLetterStrategy(gap, gapType);
		strategies.push(coverLetterStrategy);
	}

	// Strategy 4: Acknowledge learning (for nice-to-have or when other strategies weak)
	if (strategies.length < maxStrategies || strategies.every((s) => s.confidence < 50)) {
		const learningStrategy = generateLearningStrategy(gap, gapType);
		strategies.push(learningStrategy);
	}

	// If we have minimal strategies, use LLM to generate more nuanced approaches
	if (strategies.length < 2 && gap.importance === 'required') {
		const llmStrategies = await generateLLMStrategies(gap, gapType, profile, context);
		strategies.push(...llmStrategies);
	}

	// Sort by confidence and limit to max
	return strategies.sort((a, b) => b.confidence - a.confidence).slice(0, maxStrategies);
}

function findAdjacentExperience(gap: IdentifiedGap, profile: ProfileInfo): MitigationStrategy | null {
	const reqLower = gap.requirement.toLowerCase();
	const keywords = extractKeywords(reqLower);

	// Search through experiences for adjacent matches
	for (const exp of profile.experience) {
		const descLower = (exp.description || '').toLowerCase();
		const titleLower = exp.title.toLowerCase();
		const expSkills = (exp.skills || []).map((s) => s.toLowerCase());

		// Check for related but not exact matches
		for (const keyword of keywords) {
			const relatedTerms = getRelatedTerms(keyword);
			for (const related of relatedTerms) {
				if (
					descLower.includes(related) ||
					titleLower.includes(related) ||
					expSkills.includes(related)
				) {
					const snippet = extractRelevantSnippet(exp.description || exp.title, related);
					return {
						type: 'reframe_adjacent',
						description: `Reframe ${exp.title} experience to emphasize ${gap.requirement} aspects`,
						content: `Experience with ${related} in ${exp.title} role demonstrates foundational ${gap.requirement} capabilities. Source: "${snippet}"`,
						confidence: calculateAdjacentConfidence(related, keyword)
					};
				}
			}
		}
	}

	return null;
}

function findTransferableSkills(gap: IdentifiedGap, profile: ProfileInfo): MitigationStrategy | null {
	const reqLower = gap.requirement.toLowerCase();
	const keywords = extractKeywords(reqLower);

	// Check profile skills for transferable matches
	const transferableMatches: Array<{ skill: string; relevance: number }> = [];

	for (const skill of profile.skills) {
		const skillLower = skill.toLowerCase();
		const transferScore = calculateTransferability(skillLower, keywords);

		if (transferScore > 30) {
			transferableMatches.push({ skill, relevance: transferScore });
		}
	}

	if (transferableMatches.length > 0) {
		// Sort by relevance and take top matches
		transferableMatches.sort((a, b) => b.relevance - a.relevance);
		const topMatches = transferableMatches.slice(0, 3);
		const avgScore = topMatches.reduce((sum, m) => sum + m.relevance, 0) / topMatches.length;

		return {
			type: 'highlight_transferable',
			description: `Highlight transferable skills: ${topMatches.map((m) => m.skill).join(', ')}`,
			content: `Strong foundation in ${topMatches[0].skill} provides transferable basis for ${gap.requirement}`,
			confidence: Math.min(Math.round(avgScore), 85)
		};
	}

	return null;
}

function generateCoverLetterStrategy(gap: IdentifiedGap, gapType: GapType): MitigationStrategy {
	const templates: Record<GapType, string> = {
		missing_skill: `While I am currently developing my ${gap.requirement} expertise, my strong foundation in related technologies enables rapid skill acquisition.`,
		insufficient_experience: `Although my direct experience with ${gap.requirement} is developing, I bring transferable experience from related areas.`,
		missing_certification: `I am actively pursuing ${gap.requirement} and expect to complete it within the near term.`,
		industry_mismatch: `My experience in adjacent industries provides fresh perspectives applicable to ${gap.requirement}.`,
		seniority_gap: `My accelerated growth trajectory and demonstrated leadership abilities position me well for ${gap.requirement} responsibilities.`,
		technical_gap: `My proven ability to rapidly master new technologies ensures I can quickly develop ${gap.requirement} proficiency.`
	};

	return {
		type: 'cover_letter',
		description: `Address ${gap.requirement} gap directly in cover letter`,
		content: templates[gapType],
		confidence: gap.importance === 'required' ? 60 : 70
	};
}

function generateLearningStrategy(gap: IdentifiedGap, gapType: GapType): MitigationStrategy {
	const isQuickLearn = gapType === 'technical_gap' || gapType === 'missing_certification';

	return {
		type: 'acknowledge_learning',
		description: `Express commitment to learning ${gap.requirement}`,
		content: isQuickLearn
			? `I am actively developing my ${gap.requirement} skills through courses and projects and am committed to rapid proficiency.`
			: `My demonstrated ability to quickly master new concepts will enable me to excel in ${gap.requirement}.`,
		confidence: gap.importance === 'nice_to_have' ? 75 : 45
	};
}

async function generateLLMStrategies(
	gap: IdentifiedGap,
	gapType: GapType,
	profile: ProfileInfo,
	context: ToolContext
): Promise<MitigationStrategy[]> {
	try {
		const prompt = buildMitigationPrompt(gap, gapType, profile);

		const result = await complete({
			model: 'gemini-1.5-flash',
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 800,
			temperature: 0.4,
			userId: context.userId,
			metadata: { purpose: 'gap-mitigation' }
		});

		return parseMitigationResult(result.content);
	} catch {
		return [];
	}
}

function buildMitigationPrompt(gap: IdentifiedGap, gapType: GapType, profile: ProfileInfo): string {
	const experienceSummary = profile.experience
		.slice(0, 3)
		.map(
			(e) => `${e.title} at ${e.company}: ${e.description?.slice(0, 100) || 'No description'}`
		)
		.join('\n');

	return `Analyze this resume gap and suggest mitigation strategies.

GAP REQUIREMENT: ${gap.requirement}
GAP TYPE: ${gapType}
IMPORTANCE: ${gap.importance}
CURRENT CONFIDENCE: ${gap.confidenceScore}%

CANDIDATE PROFILE:
Skills: ${profile.skills.slice(0, 15).join(', ')}
Recent Experience:
${experienceSummary}

Generate 1-2 mitigation strategies. For each strategy, provide:
1. Strategy type: "reframe_adjacent" or "highlight_transferable"
2. Description of approach
3. Content/phrasing to use
4. Confidence score (0-100)

Return JSON array:
[
  {
    "type": "reframe_adjacent",
    "description": "...",
    "content": "...",
    "confidence": 70
  }
]

Return ONLY the JSON array.`;
}

function parseMitigationResult(content: string): MitigationStrategy[] {
	try {
		const jsonMatch = content.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]) as Array<{
				type: string;
				description: string;
				content?: string;
				confidence: number;
			}>;

			return parsed.map((item) => ({
				type: validateMitigationType(item.type),
				description: item.description,
				content: item.content,
				confidence: Math.min(Math.max(item.confidence, 0), 100)
			}));
		}
	} catch {
		// Return empty array on parse failure
	}

	return [];
}

function validateMitigationType(type: string): MitigationStrategyType {
	const validTypes: MitigationStrategyType[] = [
		'reframe_adjacent',
		'highlight_transferable',
		'cover_letter',
		'acknowledge_learning'
	];

	const normalized = type.toLowerCase().replace(/\s+/g, '_') as MitigationStrategyType;
	return validTypes.includes(normalized) ? normalized : 'highlight_transferable';
}

// -----------------------------------------------------------------------------
// Cover Letter Recommendation Generation
// -----------------------------------------------------------------------------

async function generateCoverLetterRecommendations(
	gaps: GapAnalysis[],
	profile: ProfileInfo,
	context: ToolContext
): Promise<CoverLetterRecommendation[]> {
	const recommendations: CoverLetterRecommendation[] = [];

	// Filter to significant and critical gaps
	const significantGaps = gaps.filter((g) => g.severity !== 'minor');

	// Sort by severity (critical first) then by number of strategies (fewer first = harder gaps)
	significantGaps.sort((a, b) => {
		if (a.severity === 'critical' && b.severity !== 'critical') return -1;
		if (b.severity === 'critical' && a.severity !== 'critical') return 1;
		return a.mitigationStrategies.length - b.mitigationStrategies.length;
	});

	// Generate recommendations for top gaps (limit to 4 to avoid overwhelming cover letter)
	const topGaps = significantGaps.slice(0, 4);

	for (let i = 0; i < topGaps.length; i++) {
		const gap = topGaps[i];
		const recommendation = await generateSingleCoverLetterRec(gap, profile, i, context);
		if (recommendation) {
			recommendations.push(recommendation);
		}
	}

	return recommendations;
}

async function generateSingleCoverLetterRec(
	gap: GapAnalysis,
	profile: ProfileInfo,
	index: number,
	context: ToolContext
): Promise<CoverLetterRecommendation | null> {
	// Determine placement based on severity and index
	const placement = determinePlacement(gap.severity, index);

	// Find the best cover_letter strategy if one exists
	const coverLetterStrategy = gap.mitigationStrategies.find((s) => s.type === 'cover_letter');

	// Generate phrasing using LLM for critical gaps, use template for others
	let suggestedPhrasing: string;

	if (gap.severity === 'critical') {
		suggestedPhrasing = await generateLLMPhrasing(gap, profile, context);
	} else if (coverLetterStrategy?.content) {
		suggestedPhrasing = coverLetterStrategy.content;
	} else {
		suggestedPhrasing = generateTemplatePhrasing(gap);
	}

	return {
		gapId: gap.requirementId,
		recommendation: `Address ${gap.requirement} gap with a ${gap.severity === 'critical' ? 'proactive' : 'positive'} framing`,
		suggestedPhrasing,
		placement
	};
}

function determinePlacement(severity: GapSeverity, index: number): CoverLetterPlacement {
	// Critical gaps addressed in body, others distributed
	if (severity === 'critical') {
		return 'body';
	}

	// Significant gaps alternate between body and closing
	const placements: CoverLetterPlacement[] = ['body', 'closing', 'body'];
	return placements[index % placements.length];
}

async function generateLLMPhrasing(
	gap: GapAnalysis,
	profile: ProfileInfo,
	context: ToolContext
): Promise<string> {
	try {
		const prompt = `Write a single sentence for a cover letter that positively addresses a gap in the candidate's qualifications.

REQUIREMENT: ${gap.requirement}
GAP TYPE: ${gap.gapType}
CANDIDATE'S RELEVANT SKILLS: ${profile.skills.slice(0, 8).join(', ')}

Guidelines:
- Be honest but positive
- Focus on transferable skills or willingness to learn
- Keep to 1-2 sentences maximum
- Avoid cliches like "quick learner" - be specific
- Do not start with "While" or "Although"

Write ONLY the sentence(s), no explanation.`;

		const result = await complete({
			model: 'gemini-1.5-flash',
			messages: [{ role: 'user', content: prompt }],
			maxTokens: 150,
			temperature: 0.6,
			userId: context.userId,
			metadata: { purpose: 'cover-letter-phrasing' }
		});

		return result.content.trim();
	} catch {
		return generateTemplatePhrasing(gap);
	}
}

function generateTemplatePhrasing(gap: GapAnalysis): string {
	const templates: Record<GapType, string> = {
		missing_skill: `My experience with related technologies has prepared me to quickly develop proficiency in ${gap.requirement}.`,
		insufficient_experience: `My background provides a solid foundation that directly applies to ${gap.requirement} requirements.`,
		missing_certification: `I am committed to obtaining ${gap.requirement} and am actively working toward this goal.`,
		industry_mismatch: `My cross-industry experience brings valuable perspectives to ${gap.requirement}.`,
		seniority_gap: `My track record of rapid professional growth positions me well for ${gap.requirement}.`,
		technical_gap: `My demonstrated ability to master new technologies ensures I can excel in ${gap.requirement}.`
	};

	return templates[gap.gapType];
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function extractKeywords(text: string): string[] {
	// Remove common words and extract meaningful keywords
	const stopWords = new Set([
		'a',
		'an',
		'the',
		'and',
		'or',
		'but',
		'in',
		'on',
		'at',
		'to',
		'for',
		'of',
		'with',
		'is',
		'are',
		'was',
		'were',
		'be',
		'been',
		'being',
		'have',
		'has',
		'had',
		'do',
		'does',
		'experience',
		'skills',
		'ability',
		'knowledge',
		'understanding',
		'familiarity'
	]);

	return text
		.split(/\s+/)
		.map((w) => w.replace(/[^a-z0-9]/g, ''))
		.filter((w) => w.length > 2 && !stopWords.has(w));
}

function getRelatedTerms(keyword: string): string[] {
	// Map of related terms for common technology/skill keywords
	const relatedTermsMap: Record<string, string[]> = {
		react: ['javascript', 'frontend', 'ui', 'component', 'redux', 'hooks'],
		node: ['javascript', 'backend', 'express', 'api', 'server'],
		python: ['django', 'flask', 'pandas', 'numpy', 'scripting'],
		java: ['spring', 'maven', 'gradle', 'jvm', 'backend'],
		aws: ['cloud', 'ec2', 's3', 'lambda', 'infrastructure'],
		docker: ['container', 'kubernetes', 'devops', 'deployment'],
		sql: ['database', 'postgres', 'mysql', 'query', 'data'],
		leadership: ['management', 'team', 'lead', 'mentor', 'coordinate'],
		agile: ['scrum', 'sprint', 'kanban', 'methodology', 'iterative'],
		typescript: ['javascript', 'typing', 'frontend', 'node']
	};

	return relatedTermsMap[keyword] || [];
}

function extractRelevantSnippet(text: string, keyword: string): string {
	const index = text.toLowerCase().indexOf(keyword.toLowerCase());
	if (index === -1) return text.slice(0, 100);

	const start = Math.max(0, index - 30);
	const end = Math.min(text.length, index + keyword.length + 50);

	let snippet = text.slice(start, end);
	if (start > 0) snippet = '...' + snippet;
	if (end < text.length) snippet = snippet + '...';

	return snippet;
}

function calculateAdjacentConfidence(relatedTerm: string, targetKeyword: string): number {
	// Base confidence for adjacent matches
	let score = 55;

	// Boost for closely related terms
	const closeRelations: Record<string, string[]> = {
		javascript: ['typescript', 'react', 'node', 'vue'],
		python: ['django', 'flask', 'fastapi'],
		java: ['kotlin', 'spring', 'scala'],
		leadership: ['management', 'lead', 'mentor']
	};

	for (const [base, related] of Object.entries(closeRelations)) {
		if (targetKeyword.includes(base) && related.includes(relatedTerm)) {
			score += 15;
			break;
		}
		if (relatedTerm.includes(base) && related.includes(targetKeyword)) {
			score += 15;
			break;
		}
	}

	return Math.min(score, 80);
}

function calculateTransferability(skill: string, targetKeywords: string[]): number {
	let score = 0;

	// Check for direct partial matches
	for (const keyword of targetKeywords) {
		if (skill.includes(keyword) || keyword.includes(skill)) {
			score += 40;
		}
	}

	// Check for related technology families
	const techFamilies: Record<string, string[]> = {
		frontend: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css'],
		backend: ['node', 'python', 'java', 'go', 'ruby', 'php', 'api', 'rest'],
		data: ['sql', 'python', 'pandas', 'spark', 'analytics', 'visualization'],
		cloud: ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform'],
		mobile: ['react native', 'flutter', 'swift', 'kotlin', 'android', 'ios']
	};

	for (const [, members] of Object.entries(techFamilies)) {
		const skillInFamily = members.some((m) => skill.includes(m));
		const targetInFamily = targetKeywords.some((k) => members.some((m) => k.includes(m)));

		if (skillInFamily && targetInFamily) {
			score += 25;
			break;
		}
	}

	return Math.min(score, 85);
}
