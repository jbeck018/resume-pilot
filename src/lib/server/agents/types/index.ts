/**
 * Resume Generation V2 Type Definitions
 * 
 * This module exports all TypeScript type definitions for the resume generation V2 system.
 * The types are organized into five main categories:
 * 
 * 1. Confidence - Core confidence scoring and content matching types
 * 2. Research - Company and role research types
 * 3. Assembly - Resume assembly and gap analysis types
 * 4. Discovery - Interactive experience discovery types
 * 5. Library - Resume library and pattern learning types
 */

// Confidence scoring types
export type {
	ConfidenceTier,
	ConfidenceScore,
	ReframingStrategyType,
	ReframingStrategy,
	ContentSourceType,
	ContentSource,
	MatchedContent
} from './confidence.js';

// Research phase types
export type {
	HiringFrequency,
	HiringPattern,
	CompanyResearchEnhanced,
	SkillImportance,
	MarketDemand,
	BenchmarkSkill,
	RoleBenchmark,
	SuccessProfile
} from './research.js';

// Assembly phase types
export type {
	GapType,
	GapSeverity,
	MitigationStrategyType,
	MitigationStrategy,
	GapAnalysis,
	ReframingPriority,
	ReframingPlan,
	CoverLetterPlacement,
	CoverLetterRecommendation,
	AssemblyPlan
} from './assembly.js';

// Discovery phase types
export type {
	DiscoveryCategory,
	DiscoveryQuestion,
	DiscoveredExperience,
	DiscoverySessionStatus,
	ExtractedInsight,
	DiscoveryResponse,
	ExperienceDiscoverySession
} from './discovery.js';

// Library and learning types
export type {
	OutcomeResponse,
	PatternType,
	LibraryOutcome,
	ResumeLibraryEntry,
	ApplicablePattern,
	LibrarySearchResult
} from './library.js';
