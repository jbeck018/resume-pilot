// =============================================================================
// Resume Generation Agent V2
// =============================================================================

import { BaseAgent } from '../core/base-agent';
import type {
	AgentConfig,
	AgentContext,
	JobInfo,
	ProfileInfo,
	ResumeInfo,
	ExtractedSkill
} from '../types';
import type {
	ConfidenceScore,
	MatchedContent,
	ContentSource,
	ReframingStrategy
} from '../types/confidence';
import type { GapAnalysis, AssemblyPlan } from '../types/assembly';
import type { LibrarySearchResult, ApplicablePattern } from '../types/library';
import type { CompanyResearchEnhanced, RoleBenchmark } from '../types/research';

// Import tools
import { SkillExtractorTool } from '../tools/skill-extractor';
import { WebSearchTool } from '../tools/web-search';
import { ConfidenceScorerTool } from '../tools/confidence-scorer';
import { GapAnalyzerTool } from '../tools/gap-analyzer';
import { ContentReframerTool } from '../tools/content-reframer';
import { QualityScorerTool } from '../tools/quality-scorer';
import { LibrarySearchTool } from '../tools/library-search';

// =============================================================================
// Input/Output Types
// =============================================================================

export interface ResumeAgentInputV2 {
	/** Job information */
	job: JobInfo;
	/** Candidate profile */
	profile: ProfileInfo;
	/** Existing resume (optional) */
	resume?: ResumeInfo;
	/** Generation options */
	options?: {
		/** Enable company research (Phase 1) */
		includeResearch?: boolean;
		/** Enable library pattern search (Phase 0) */
		useLibrary?: boolean;
		/** Enable experience discovery (Phase 2.5) - requires session */
		enableDiscovery?: boolean;
		/** Pre-provided discovery responses (for sync discovery) */
		discoveryResponses?: Array<{ questionId: string; answer: string }>;
		/** Target resume length */
		maxLength?: 'one_page' | 'two_page';
		/** Specific areas to focus on */
		focusAreas?: string[];
		/** Quality threshold for acceptance (0-100, default: 70) */
		qualityThreshold?: number;
		/** Maximum regeneration attempts */
		maxRegenerationAttempts?: number;
	};
}

export interface ResumeAgentOutputV2 {
	/** Generated resume markdown */
	resume: string;
	/** Overall match score (0-100) */
	matchScore: number;
	/** ATS compatibility score (0-100) */
	atsScore: number;
	/** Overall quality score (0-100) */
	qualityScore: number;
	/** Key highlights emphasized */
	highlights: string[];
	/** Requirements successfully matched */
	matchedRequirements: MatchedContent[];
	/** Identified gaps and mitigation strategies */
	gaps: GapAnalysis[];
	/** Final assembly plan used */
	assemblyPlan: AssemblyPlan;
	/** Company research if included */
	companyResearch?: CompanyResearchEnhanced;
	/** Library patterns applied */
	libraryPatternsApplied?: ApplicablePattern[];
	/** Experience discovery session ID if created */
	discoverySessionId?: string;
	/** Number of generation attempts made */
	generationAttempts: number;
	/** Tracing metadata */
	metadata: {
		phase0DurationMs?: number;
		phase1DurationMs: number;
		phase2DurationMs: number;
		phase25DurationMs?: number;
		phase3DurationMs: number;
		phase4DurationMs: number;
		phase5DurationMs?: number;
		totalDurationMs: number;
	};
}

// =============================================================================
// Resume Generation Agent V2
// =============================================================================

/**
 * Resume Generation Agent V2
 *
 * Implements a 6-phase pipeline for intelligent resume generation:
 * - Phase 0: Library Initialization (find similar past resumes)
 * - Phase 1: Research (skills, company, benchmarks)
 * - Phase 2: Template Generation (score requirements, identify gaps, allocate bullets)
 * - Phase 2.5: Experience Discovery (optional, async or sync)
 * - Phase 3: Assembly (reframe content, incorporate discoveries)
 * - Phase 4: Generation (create markdown, validate quality)
 * - Phase 5: Library Update (store for future learning)
 */
export class ResumeGenerationAgentV2 extends BaseAgent<
	ResumeAgentInputV2,
	ResumeAgentOutputV2
> {
	constructor() {
		const config: AgentConfig = {
			id: 'resume-generation-v2',
			name: 'Resume Generation Agent V2',
			description:
				'Advanced 6-phase resume generation with library learning, gap analysis, and intelligent reframing',
			defaultModel: 'claude-sonnet-4-5-20250929',
			maxRetries: 2,
			timeoutMs: 180000, // 3 minutes for full pipeline
			priority: 'high'
		};

		super(config);

		// Register all V2 tools
		this.registerTool(SkillExtractorTool);
		this.registerTool(WebSearchTool);
		this.registerTool(ConfidenceScorerTool);
		this.registerTool(GapAnalyzerTool);
		this.registerTool(ContentReframerTool);
		this.registerTool(QualityScorerTool);
		this.registerTool(LibrarySearchTool);
	}

	protected async executeInternal(
		input: ResumeAgentInputV2,
		context: AgentContext
	): Promise<ResumeAgentOutputV2> {
		const totalStartTime = Date.now();
		const metadata: ResumeAgentOutputV2['metadata'] = {
			phase1DurationMs: 0,
			phase2DurationMs: 0,
			phase3DurationMs: 0,
			phase4DurationMs: 0,
			totalDurationMs: 0
		};

		// Phase 0: Library Initialization (optional)
		let libraryResults: LibrarySearchResult[] = [];
		let libraryPatternsApplied: ApplicablePattern[] = [];

		if (input.options?.useLibrary) {
			const phase0Start = Date.now();
			const librarySearchResult = await this.phase0_libraryInit(input, context);
			libraryResults = librarySearchResult.results;
			libraryPatternsApplied = librarySearchResult.recommendedStrategies;
			metadata.phase0DurationMs = Date.now() - phase0Start;
		}

		// Phase 1: Research
		const phase1Start = Date.now();
		const researchData = await this.phase1_research(input, context);
		metadata.phase1DurationMs = Date.now() - phase1Start;

		// Phase 2: Template Generation
		const phase2Start = Date.now();
		const templateData = await this.phase2_templateGeneration(input, researchData, context);
		metadata.phase2DurationMs = Date.now() - phase2Start;

		// Phase 2.5: Experience Discovery (optional)
		let discoverySessionId: string | undefined;
		if (input.options?.enableDiscovery && templateData.gaps.length > 0) {
			const phase25Start = Date.now();
			// For now, we'll skip async discovery and only handle sync if responses provided
			// Full async discovery would require creating a session and returning early
			if (input.options.discoveryResponses && input.options.discoveryResponses.length > 0) {
				// Process provided discovery responses
				// This would integrate discovered experiences into the template
			}
			metadata.phase25DurationMs = Date.now() - phase25Start;
		}

		// Phase 3: Assembly
		const phase3Start = Date.now();
		const assemblyPlan = await this.phase3_assembly(
			input,
			templateData,
			libraryPatternsApplied,
			context
		);
		metadata.phase3DurationMs = Date.now() - phase3Start;

		// Phase 4: Generation
		const phase4Start = Date.now();
		const generationResult = await this.phase4_generation(
			input,
			researchData,
			assemblyPlan,
			context
		);
		metadata.phase4DurationMs = Date.now() - phase4Start;

		// Phase 5: Library Update (only if quality is good)
		if (
			input.options?.useLibrary &&
			generationResult.atsScore >= (input.options?.qualityThreshold ?? 70)
		) {
			const phase5Start = Date.now();
			await this.phase5_libraryUpdate(
				input,
				generationResult,
				templateData.matchedContent,
				templateData.gaps,
				context
			);
			metadata.phase5DurationMs = Date.now() - phase5Start;
		}

		metadata.totalDurationMs = Date.now() - totalStartTime;

		return {
			resume: generationResult.resume,
			matchScore: templateData.overallMatchScore,
			atsScore: generationResult.atsScore,
			qualityScore: generationResult.qualityScore,
			highlights: generationResult.highlights,
			matchedRequirements: templateData.matchedContent,
			gaps: templateData.gaps,
			assemblyPlan,
			companyResearch: researchData.companyResearch,
			libraryPatternsApplied:
				libraryPatternsApplied.length > 0 ? libraryPatternsApplied : undefined,
			discoverySessionId,
			generationAttempts: generationResult.attempts,
			metadata
		};
	}

	// ===========================================================================
	// Phase 0: Library Initialization
	// ===========================================================================

	private async phase0_libraryInit(
		input: ResumeAgentInputV2,
		context: AgentContext
	): Promise<{ results: LibrarySearchResult[]; recommendedStrategies: ApplicablePattern[] }> {
		const span = context.parentSpan!.span({ name: 'phase0-library-init' });

		try {
			// Extract skills for library search
			const skillsResult = await this.executeTool<
				{ text: string; context: 'job_description' },
				{ skills: ExtractedSkill[] }
			>(
				'skill-extractor',
				{ text: input.job.description, context: 'job_description' },
				context
			);

			const requiredSkills = skillsResult.skills
				.filter((s) => s.importance === 'required')
				.map((s) => s.name);

			// Search library
			const libraryResult = await this.executeTool<
				{
					userId: string;
					jobDescription: string;
					targetRole: string;
					requiredSkills: string[];
					limit?: number;
				},
				{
					results: LibrarySearchResult[];
					totalEntriesInLibrary: number;
					usedEmbeddingSearch: boolean;
					recommendedStrategies: ApplicablePattern[];
					patternSummary?: string;
				}
			>(
				'library-search',
				{
					userId: context.userId,
					jobDescription: input.job.description,
					targetRole: input.job.title,
					requiredSkills,
					limit: 5
				},
				context
			);

			span.end({
				output: {
					resultsFound: libraryResult.results.length,
					patternsFound: libraryResult.recommendedStrategies.length,
					usedEmbeddings: libraryResult.usedEmbeddingSearch
				}
			});

			return {
				results: libraryResult.results,
				recommendedStrategies: libraryResult.recommendedStrategies
			};
		} catch (error) {
			span.end({
				level: 'WARNING',
				statusMessage: error instanceof Error ? error.message : 'Library search failed'
			});
			// Non-critical failure - continue without library patterns
			return { results: [], recommendedStrategies: [] };
		}
	}

	// ===========================================================================
	// Phase 1: Research
	// ===========================================================================

	private async phase1_research(
		input: ResumeAgentInputV2,
		context: AgentContext
	): Promise<{
		extractedSkills: ExtractedSkill[];
		companyResearch?: CompanyResearchEnhanced;
		roleBenchmark?: RoleBenchmark;
	}> {
		const span = context.parentSpan!.span({ name: 'phase1-research' });

		// Extract skills from job description
		const skillsResult = await this.executeTool<
			{ text: string; context: 'job_description' },
			{ skills: ExtractedSkill[]; requiredCount: number }
		>(
			'skill-extractor',
			{ text: input.job.description, context: 'job_description' },
			context
		);

		// Optional company research
		let companyResearch: CompanyResearchEnhanced | undefined;
		if (input.options?.includeResearch) {
			try {
				const searchResult = await this.executeTool<
					{ query: string; type: 'company'; companyName: string },
					{ companyResearch?: CompanyResearchEnhanced }
				>(
					'web-search',
					{
						query: `${input.job.company} company culture values technology stack ${input.job.title}`,
						type: 'company',
						companyName: input.job.company
					},
					context
				);
				companyResearch = searchResult.companyResearch;
			} catch (error) {
				// Research is optional, log but continue
				span.event({
					name: 'company-research-failed',
					metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
				});
			}
		}

		// Build role benchmark (simplified - in production this would query market data)
		const roleBenchmark: RoleBenchmark = {
			roleTitle: input.job.title,
			industry: companyResearch?.industry || 'Technology',
			requiredSkills: skillsResult.skills
				.filter((s) => s.importance === 'required')
				.map((s) => ({
					name: s.name,
					importance: 'critical' as const,
					marketDemand: 'high' as const
				})),
			preferredSkills: skillsResult.skills
				.filter((s) => s.importance === 'preferred')
				.map((s) => ({
					name: s.name,
					importance: 'nice_to_have' as const,
					marketDemand: 'medium' as const
				})),
			typicalExperience: input.job.experienceLevel || '3+ years',
			careerProgression: []
		};

		span.end({
			output: {
				totalSkills: skillsResult.skills.length,
				requiredSkills: skillsResult.requiredCount,
				hasCompanyResearch: !!companyResearch
			}
		});

		return {
			extractedSkills: skillsResult.skills,
			companyResearch,
			roleBenchmark
		};
	}

	// ===========================================================================
	// Phase 2: Template Generation
	// ===========================================================================

	private async phase2_templateGeneration(
		input: ResumeAgentInputV2,
		researchData: {
			extractedSkills: ExtractedSkill[];
			companyResearch?: CompanyResearchEnhanced;
		},
		context: AgentContext
	): Promise<{
		matchedContent: MatchedContent[];
		gaps: GapAnalysis[];
		overallMatchScore: number;
	}> {
		const span = context.parentSpan!.span({ name: 'phase2-template-generation' });

		// Score all requirements against profile
		const matchedContent: MatchedContent[] = [];

		for (const skill of researchData.extractedSkills) {
			// Build candidate content sources for this requirement
			const candidateContent = this.buildContentSources(input.profile, skill);

			// Score the match
			const scoringResult = await this.executeTool<
				{
					requirement: string;
					candidateContent: ContentSource[];
					jobContext: {
						title: string;
						company: string;
						industry?: string;
						keywords?: string[];
					};
				},
				{
					score: ConfidenceScore;
					bestMatch: ContentSource | null;
					reframingStrategy?: ReframingStrategy;
					rationale: string;
				}
			>(
				'confidence-scorer',
				{
					requirement: skill.name,
					candidateContent,
					jobContext: {
						title: input.job.title,
						company: input.job.company,
						industry: researchData.companyResearch?.industry
					}
				},
				context
			);

			const requirementId = `req-${skill.name.toLowerCase().replace(/\s+/g, '-')}`;

			matchedContent.push({
				requirementId,
				requirement: skill.name,
				confidence: scoringResult.score,
				sourceContent: scoringResult.bestMatch ? [scoringResult.bestMatch] : [],
				reframingStrategy: scoringResult.reframingStrategy,
				selectedContent: scoringResult.bestMatch?.originalText
			});
		}

		// Analyze gaps
		const gapAnalysisResult = await this.executeTool<
			{
				requirements: ExtractedSkill[];
				matchedContent: MatchedContent[];
				profile: ProfileInfo;
				options?: {
					gapThreshold?: number;
					includeCoverLetterRecs?: boolean;
					maxMitigationsPerGap?: number;
				};
			},
			{
				gaps: GapAnalysis[];
				criticalGapsCount: number;
				mitigationCoverage: number;
			}
		>(
			'gap-analyzer',
			{
				requirements: researchData.extractedSkills,
				matchedContent,
				profile: input.profile,
				options: {
					gapThreshold: 60,
					includeCoverLetterRecs: true,
					maxMitigationsPerGap: 3
				}
			},
			context
		);

		// Calculate overall match score
		const overallMatchScore = this.calculateOverallMatchScore(
			matchedContent,
			gapAnalysisResult.gaps
		);

		span.end({
			output: {
				totalRequirements: researchData.extractedSkills.length,
				matchedCount: matchedContent.filter((m) => m.confidence.overall >= 60).length,
				gapsCount: gapAnalysisResult.gaps.length,
				criticalGapsCount: gapAnalysisResult.criticalGapsCount,
				overallMatchScore
			}
		});

		return {
			matchedContent,
			gaps: gapAnalysisResult.gaps,
			overallMatchScore
		};
	}

	// ===========================================================================
	// Phase 3: Assembly
	// ===========================================================================

	private async phase3_assembly(
		input: ResumeAgentInputV2,
		templateData: {
			matchedContent: MatchedContent[];
			gaps: GapAnalysis[];
		},
		libraryPatterns: ApplicablePattern[],
		context: AgentContext
	): Promise<AssemblyPlan> {
		const span = context.parentSpan!.span({ name: 'phase3-assembly' });

		// Reframe transferable/adjacent matches
		const reframingPlan: AssemblyPlan['reframingPlan'] = [];

		for (const match of templateData.matchedContent) {
			// Only reframe if confidence is in transferable/adjacent tier and strategy exists
			if (
				(match.confidence.tier === 'transferable' || match.confidence.tier === 'adjacent') &&
				match.reframingStrategy &&
				match.sourceContent.length > 0
			) {
				const reframingResult = await this.executeTool<
					{
						originalContent: string;
						targetRequirement: string;
						strategy: ReframingStrategy['type'];
						jobContext: {
							title: string;
							company: string;
							industry?: string;
							keywords?: string[];
						};
					},
					{
						reframedContent: string;
						preservedMeaning: string;
						adaptedElements: string[];
						confidence: number;
						strategyApplied: ReframingStrategy['type'];
						unchanged: boolean;
						unchangedReason?: string;
					}
				>(
					'content-reframer',
					{
						originalContent: match.sourceContent[0].originalText,
						targetRequirement: match.requirement,
						strategy: match.reframingStrategy.type,
						jobContext: {
							title: input.job.title,
							company: input.job.company
						}
					},
					context
				);

				// Update the matched content with reframed text
				if (!reframingResult.unchanged && reframingResult.confidence >= 50) {
					match.selectedContent = reframingResult.reframedContent;
					if (match.reframingStrategy) {
						match.reframingStrategy.reframedText = reframingResult.reframedContent;
						match.reframingStrategy.preservedMeaning = reframingResult.preservedMeaning;
						match.reframingStrategy.adaptedElements = reframingResult.adaptedElements;
					}

					reframingPlan.push({
						sourceContentId: match.sourceContent[0].id,
						targetRequirementId: match.requirementId,
						strategy: match.reframingStrategy,
						priority: match.confidence.overall >= 70 ? 'high' : 'medium'
					});
				}
			}
		}

		// Build assembly plan
		const assemblyPlan: AssemblyPlan = {
			jobId: input.job.id,
			matchedRequirements: templateData.matchedContent,
			gaps: templateData.gaps,
			reframingPlan,
			coverLetterRecommendations: [] // Extracted from gap analyzer
		};

		// Extract cover letter recommendations from gaps
		for (const gap of templateData.gaps) {
			const coverLetterStrategy = gap.mitigationStrategies.find(
				(s) => s.type === 'cover_letter'
			);
			if (coverLetterStrategy && gap.severity !== 'minor') {
				assemblyPlan.coverLetterRecommendations.push({
					gapId: gap.requirementId,
					recommendation: `Address ${gap.requirement} gap`,
					suggestedPhrasing: coverLetterStrategy.content || coverLetterStrategy.description,
					placement: gap.severity === 'critical' ? 'body' : 'closing'
				});
			}
		}

		span.end({
			output: {
				reframedCount: reframingPlan.length,
				coverLetterRecsCount: assemblyPlan.coverLetterRecommendations.length
			}
		});

		return assemblyPlan;
	}

	// ===========================================================================
	// Phase 4: Generation
	// ===========================================================================

	private async phase4_generation(
		input: ResumeAgentInputV2,
		researchData: {
			extractedSkills: ExtractedSkill[];
			companyResearch?: CompanyResearchEnhanced;
		},
		assemblyPlan: AssemblyPlan,
		context: AgentContext
	): Promise<{
		resume: string;
		atsScore: number;
		qualityScore: number;
		highlights: string[];
		attempts: number;
	}> {
		const span = context.parentSpan!.span({ name: 'phase4-generation' });

		const qualityThreshold = input.options?.qualityThreshold ?? 70;
		const maxAttempts = input.options?.maxRegenerationAttempts ?? 2;
		let attempts = 0;

		let resume = '';
		let qualityResult: {
			overall: number;
			atsCompatibility: number;
			passed: boolean;
			suggestions: string[];
		} = {
			overall: 0,
			atsCompatibility: 0,
			passed: false,
			suggestions: []
		};

		// Generate resume (with retry on low quality)
		while (attempts < maxAttempts) {
			attempts++;

			resume = await this.generateResumeMarkdown(
				input,
				researchData,
				assemblyPlan,
				attempts > 1 ? qualityResult.suggestions : undefined,
				context
			);

			// Quality check
			qualityResult = await this.executeTool<
				{
					content: string;
					contentType: 'resume';
					targetJob: JobInfo;
					originalProfile: {
						skills: string[];
						experience: Array<{ title: string; company: string }>;
					};
				},
				{
					overall: number;
					atsCompatibility: number;
					passed: boolean;
					suggestions: string[];
				}
			>(
				'quality-scorer',
				{
					content: resume,
					contentType: 'resume',
					targetJob: input.job,
					originalProfile: {
						skills: input.profile.skills,
						experience: input.profile.experience.map((e) => ({
							title: e.title,
							company: e.company
						}))
					}
				},
				context
			);

			// Check if quality meets threshold
			if (qualityResult.overall >= qualityThreshold) {
				break;
			}

			// Log regeneration attempt
			span.event({
				name: 'quality-below-threshold',
				metadata: {
					attempt: attempts,
					qualityScore: qualityResult.overall,
					threshold: qualityThreshold
				}
			});
		}

		// Extract highlights
		const highlights = this.extractHighlights(assemblyPlan, input.profile);

		span.end({
			output: {
				attempts,
				qualityScore: qualityResult.overall,
				atsScore: qualityResult.atsCompatibility,
				passedQuality: qualityResult.passed
			}
		});

		return {
			resume,
			atsScore: qualityResult.atsCompatibility,
			qualityScore: qualityResult.overall,
			highlights,
			attempts
		};
	}

	// ===========================================================================
	// Phase 5: Library Update
	// ===========================================================================

	private async phase5_libraryUpdate(
		input: ResumeAgentInputV2,
		generationResult: {
			resume: string;
			atsScore: number;
			qualityScore: number;
		},
		matchedContent: MatchedContent[],
		gaps: GapAnalysis[],
		context: AgentContext
	): Promise<void> {
		const span = context.parentSpan!.span({ name: 'phase5-library-update' });

		try {
			// Import the library storage function
			const { storeResumeInLibrary } = await import('../../resume-library/storage');

			await storeResumeInLibrary({
				userId: context.userId,
				jobId: input.job.id,
				resumeContent: generationResult.resume,
				matchScore: this.calculateOverallMatchScore(matchedContent, gaps),
				atsScore: generationResult.atsScore,
				confidence: generationResult.qualityScore,
				matchedRequirements: matchedContent,
				gaps,
				jobTitle: input.job.title,
				company: input.job.company,
				industry: 'Technology' // Default industry - will be refined with company research
			});

			span.end({
				output: {
					stored: true,
					atsScore: generationResult.atsScore
				}
			});
		} catch (error) {
			span.end({
				level: 'WARNING',
				statusMessage: error instanceof Error ? error.message : 'Library storage failed'
			});
			// Non-critical failure - continue
		}
	}

	// ===========================================================================
	// Helper Methods
	// ===========================================================================

	private buildContentSources(profile: ProfileInfo, skill: ExtractedSkill): ContentSource[] {
		const sources: ContentSource[] = [];

		// Check skills
		const matchingSkills = profile.skills.filter((s) =>
			s.toLowerCase().includes(skill.name.toLowerCase())
		);
		for (const matchedSkill of matchingSkills) {
			sources.push({
				type: 'skill',
				id: `skill-${matchedSkill.toLowerCase().replace(/\s+/g, '-')}`,
				originalText: matchedSkill,
				relevanceScore: 95
			});
		}

		// Check experience
		for (const exp of profile.experience) {
			const expText = `${exp.title} at ${exp.company}: ${exp.description || ''}`;
			const skillKeywords = skill.name.toLowerCase().split(/\s+/);

			// Check if experience mentions this skill
			if (
				skillKeywords.some(
					(kw) =>
						expText.toLowerCase().includes(kw) ||
						exp.skills?.some((s) => s.toLowerCase().includes(kw))
				)
			) {
				sources.push({
					type: 'experience',
					id: `exp-${exp.company}-${exp.title}`.toLowerCase().replace(/\s+/g, '-'),
					originalText: expText,
					relevanceScore: 80
				});
			}
		}

		// Limit to top 5 most relevant sources
		return sources.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
	}

	private calculateOverallMatchScore(
		matchedContent: MatchedContent[],
		gaps: GapAnalysis[]
	): number {
		if (matchedContent.length === 0) return 0;

		// Weight by requirement importance
		let totalWeight = 0;
		let weightedScore = 0;

		for (const match of matchedContent) {
			// Infer importance from confidence tier
			const weight = match.confidence.tier === 'direct' ? 3 : match.confidence.tier === 'transferable' ? 2 : 1;
			totalWeight += weight;
			weightedScore += match.confidence.overall * weight;
		}

		// Apply gap penalty
		const criticalGaps = gaps.filter((g) => g.severity === 'critical').length;
		const significantGaps = gaps.filter((g) => g.severity === 'significant').length;

		const gapPenalty = criticalGaps * 10 + significantGaps * 5;

		const rawScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
		return Math.max(0, Math.round(rawScore - gapPenalty));
	}

	private async generateResumeMarkdown(
		input: ResumeAgentInputV2,
		researchData: {
			extractedSkills: ExtractedSkill[];
			companyResearch?: CompanyResearchEnhanced;
		},
		assemblyPlan: AssemblyPlan,
		improvementSuggestions: string[] | undefined,
		context: AgentContext
	): Promise<string> {
		const systemPrompt = await this.getPromptWithFallback(
			'resume-generation-v2',
			{
				company_name: input.job.company,
				position: input.job.title
			},
			`You are an expert resume writer specializing in creating highly targeted, ATS-optimized resumes.

Your task is to create a tailored resume for {{position}} at {{company_name}}.

CRITICAL RULES:
1. NEVER fabricate experience, skills, or achievements
2. Only highlight and reframe EXISTING qualifications
3. Use keywords from the job description naturally
4. Quantify achievements wherever data is available
5. Keep format clean and ATS-friendly (no tables, columns, or graphics)
6. Maximum 2 pages
7. Use the provided matched content and reframed text exactly as given

Output the resume in clean markdown format.`
		);

		// Build detailed context from assembly plan
		const matchedRequirementsText = assemblyPlan.matchedRequirements
			.filter((m) => m.confidence.overall >= 60)
			.map(
				(m) =>
					`- ${m.requirement} (${m.confidence.tier}, ${m.confidence.overall}%): ${m.selectedContent || 'No content'}`
			)
			.join('\n');

		const gapsText = assemblyPlan.gaps
			.filter((g) => g.severity !== 'minor')
			.map((g) => {
				const bestStrategy = g.mitigationStrategies[0];
				return `- ${g.requirement} (${g.severity}): ${bestStrategy?.description || 'No mitigation'}`;
			})
			.join('\n');

		const userPrompt = `# Job Details
**Position:** ${input.job.title}
**Company:** ${input.job.company}
${input.job.location ? `**Location:** ${input.job.location}${input.job.isRemote ? ' (Remote)' : ''}` : ''}

**Description:**
${input.job.description}

${researchData.companyResearch ? `
# Company Research
**Industry:** ${researchData.companyResearch.industry || 'N/A'}
**Culture:** ${researchData.companyResearch.culture?.join(', ') || 'N/A'}
**Technologies:** ${researchData.companyResearch.technologies?.join(', ') || 'N/A'}
**Values:** ${researchData.companyResearch.values?.join(', ') || 'N/A'}
` : ''}

# Candidate Profile
**Name:** ${input.profile.fullName}
${input.profile.email ? `**Email:** ${input.profile.email}` : ''}
${input.profile.location ? `**Location:** ${input.profile.location}` : ''}
**Headline:** ${input.profile.headline || 'Professional'}

**Summary:**
${input.profile.summary || 'Not provided'}

**Skills:** ${input.profile.skills.join(', ')}

**Experience:**
${input.profile.experience
	.map(
		(exp) => `
### ${exp.title} at ${exp.company}
${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || 'N/A'}
${exp.location ? `Location: ${exp.location}` : ''}
${exp.description || ''}
${exp.skills?.length ? `Technologies: ${exp.skills.join(', ')}` : ''}
`
	)
	.join('\n')}

**Education:**
${input.profile.education
	.map(
		(edu) => `
- ${edu.degree}${edu.field ? ` in ${edu.field}` : ''} - ${edu.institution}
  ${edu.startDate || ''} - ${edu.endDate || ''}
`
	)
	.join('\n')}

# Assembly Plan

**Matched Requirements (Use This Content):**
${matchedRequirementsText}

${gapsText ? `**Gaps to Address Strategically:**
${gapsText}` : ''}

${assemblyPlan.coverLetterRecommendations.length > 0 ? `**Note:** Some gaps are better addressed in the cover letter rather than stretching resume content.` : ''}

${improvementSuggestions && improvementSuggestions.length > 0 ? `
# Improvements Needed (Previous Attempt Failed Quality Check)
${improvementSuggestions.map((s) => `- ${s}`).join('\n')}
` : ''}

${input.options?.maxLength ? `**Target Length:** ${input.options.maxLength === 'one_page' ? 'One page' : 'Two pages'}` : ''}

---

Create a tailored resume that:
1. Uses the EXACT matched content and reframed text provided above
2. Emphasizes the candidate's most relevant experience for this role
3. Incorporates required and preferred skills naturally
4. Addresses identified gaps through strategic framing (not fabrication)
5. Highlights achievements with quantifiable results
6. Uses language and keywords from the job description
${improvementSuggestions && improvementSuggestions.length > 0 ? '7. Addresses all improvement suggestions from the quality check' : ''}`;

		const result = await this.generate(
			{
				model: this.config.defaultModel,
				systemPrompt,
				userPrompt,
				maxTokens: 4000,
				temperature: 0.5
			},
			context
		);

		return result.content;
	}

	private extractHighlights(assemblyPlan: AssemblyPlan, profile: ProfileInfo): string[] {
		const highlights: string[] = [];

		// Top 3 direct matches
		const directMatches = assemblyPlan.matchedRequirements
			.filter((m) => m.confidence.tier === 'direct')
			.sort((a, b) => b.confidence.overall - a.confidence.overall)
			.slice(0, 3);

		for (const match of directMatches) {
			highlights.push(`Strong match for ${match.requirement}`);
		}

		// Top reframed content
		const reframed = assemblyPlan.matchedRequirements.filter(
			(m) => m.reframingStrategy && m.selectedContent !== m.sourceContent[0]?.originalText
		);
		if (reframed.length > 0) {
			highlights.push(
				`Strategically reframed ${reframed.length} experience${reframed.length > 1 ? 's' : ''} for better alignment`
			);
		}

		// Key skills
		const topSkills = profile.skills.slice(0, 5);
		if (topSkills.length > 0) {
			highlights.push(`Key skills: ${topSkills.join(', ')}`);
		}

		return highlights.slice(0, 5);
	}

	protected async validate(
		output: ResumeAgentOutputV2,
		input: ResumeAgentInputV2
	): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		// Check resume is not empty
		if (!output.resume || output.resume.length < 200) {
			errors.push('Resume content is too short or empty');
		}

		// Check for basic sections
		const resumeLower = output.resume.toLowerCase();
		if (!resumeLower.includes('experience') && !resumeLower.includes('work')) {
			errors.push('Resume missing experience section');
		}

		// Check that name is included
		if (!output.resume.includes(input.profile.fullName)) {
			errors.push('Resume missing candidate name');
		}

		// Check quality threshold
		const threshold = input.options?.qualityThreshold ?? 70;
		if (output.qualityScore < threshold) {
			errors.push(
				`Quality score ${output.qualityScore} below threshold ${threshold} after ${output.generationAttempts} attempts`
			);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}

// Export singleton instance
export const resumeGenerationAgentV2 = new ResumeGenerationAgentV2();
