# Resume Generation System Refactor Plan

## Executive Summary

This document outlines a comprehensive refactor of the resume generation system based on the resume-tailoring skill patterns. The refactor introduces a confidence-based content matching system, structured phases for research and assembly, gap handling strategies, and multi-job batch processing capabilities.

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Target Architecture](#target-architecture)
3. [New Types and Interfaces](#new-types-and-interfaces)
4. [Database Schema Changes](#database-schema-changes)
5. [New Tools](#new-tools)
6. [Refactored Agent Workflow](#refactored-agent-workflow)
7. [Inngest Function Updates](#inngest-function-updates)
8. [Implementation Phases](#implementation-phases)
9. [Migration Strategy](#migration-strategy)

---

## Current System Analysis

### Existing Components

**Resume Agent (`resume-agent.ts`)**
- Single-pass resume generation
- Basic skill extraction and matching
- Simple quality scoring (pass/fail)
- Optional company research via web search
- No confidence scoring for content matching
- No structured gap handling

**Orchestrator (`orchestrator.ts`)**
- Coordinates ResumeAgent, CoverLetterAgent, JobMatchAgent
- Sequential execution with MCP pattern learning
- Basic success/failure tracking

**Tools**
- `skill-extractor`: Extracts skills with importance levels
- `quality-scorer`: ATS compatibility, keyword coverage, format quality
- `profile-analyzer`: Strengths, weaknesses, gaps analysis
- `web-search`: Company research

### Current Limitations

1. **No confidence-based matching**: Content is either matched or not, no scoring
2. **No content reframing**: Cannot adapt terminology or emphasis
3. **Gap handling is superficial**: Gaps are listed but not strategically addressed
4. **No resume library**: Each generation starts fresh, no learning from successful resumes
5. **Single job focus**: No batch processing optimization
6. **No experience discovery**: Missing undocumented experiences are not surfaced

---

## Target Architecture

### Phase-Based Generation Pipeline

```
Phase 0: Library Initialization
    |
    v
Phase 1: Research Phase
    |-- Company Research
    |-- Role Benchmarking
    |-- Success Profile Analysis
    |
    v
Phase 2: Template Generation
    |-- Role Consolidation
    |-- Title Reframing
    |-- Bullet Allocation
    |
    v
Phase 2.5: Experience Discovery (Optional)
    |-- Branching Questions
    |-- Undocumented Experience Surfacing
    |
    v
Phase 3: Assembly Phase
    |-- Confidence-Based Content Matching
    |-- Gap Identification
    |-- Reframing Strategy Selection
    |
    v
Phase 4: Generation
    |-- Resume Generation (MD)
    |-- Cover Letter Generation
    |-- Match Report Generation
    |
    v
Phase 5: Library Update
    |-- Store Successful Resume
    |-- Update Pattern Database
```

---

## New Types and Interfaces

### Core Types

```typescript
// File: src/lib/server/agents/types/confidence.ts

/**
 * Confidence tiers for content matching
 */
export type ConfidenceTier =
  | 'direct'        // 90-100%: Use with confidence
  | 'transferable'  // 75-89%: Strong candidate
  | 'adjacent'      // 60-74%: Acceptable with reframing
  | 'weak'          // 45-59%: Consider only if no better option
  | 'gap';          // <45%: Flag as unaddressed requirement

export interface ConfidenceScore {
  overall: number;  // 0-100
  tier: ConfidenceTier;
  breakdown: {
    keyword: number;      // 40% weight - Direct keyword match
    domain: number;       // Included in keyword
    technology: number;   // Included in keyword
    outcome: number;      // Included in keyword
    transferable: number; // 30% weight - Same capability, different context
    adjacent: number;     // 20% weight - Related tools/methodologies
    impact: number;       // 10% weight - Achievement type alignment
  };
}

/**
 * Matched content item with confidence scoring
 */
export interface MatchedContent {
  requirementId: string;
  requirement: string;
  confidence: ConfidenceScore;
  sourceContent: ContentSource[];
  reframingStrategy?: ReframingStrategy;
  selectedContent?: string;
}

export interface ContentSource {
  type: 'experience' | 'skill' | 'project' | 'education' | 'certification';
  id: string;
  originalText: string;
  relevanceScore: number;
}

/**
 * Reframing strategies for content adaptation
 */
export type ReframingStrategyType =
  | 'keyword_alignment'    // Preserve meaning, adjust terminology
  | 'emphasis_shift'       // Same facts, different focus
  | 'abstraction_adjust'   // Adjust technical specificity
  | 'scale_emphasis';      // Highlight relevant aspects

export interface ReframingStrategy {
  type: ReframingStrategyType;
  originalText: string;
  reframedText: string;
  preservedMeaning: string;
  adaptedElements: string[];
}
```

### Research Phase Types

```typescript
// File: src/lib/server/agents/types/research.ts

export interface CompanyResearchEnhanced {
  name: string;
  description?: string;
  industry?: string;
  size?: string;
  culture?: string[];
  recentNews?: string[];
  technologies?: string[];
  values?: string[];
  hiringPatterns?: HiringPattern[];
  competitorAnalysis?: string[];
  researchedAt: Date;
}

export interface HiringPattern {
  pattern: string;
  frequency: 'common' | 'occasional' | 'rare';
  relevance: number;
}

export interface RoleBenchmark {
  roleTitle: string;
  industry: string;
  requiredSkills: BenchmarkSkill[];
  preferredSkills: BenchmarkSkill[];
  typicalExperience: {
    minYears: number;
    maxYears: number;
    keyAreas: string[];
  };
  compensationRange?: {
    min: number;
    max: number;
    currency: string;
  };
  careerProgression: string[];
}

export interface BenchmarkSkill {
  name: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  marketDemand: 'high' | 'medium' | 'low';
  alternatives?: string[];
}

export interface SuccessProfile {
  targetRole: string;
  idealCandidate: {
    background: string[];
    achievements: string[];
    skills: string[];
    traits: string[];
  };
  differentiators: string[];
  redFlags: string[];
}
```

### Template Phase Types

```typescript
// File: src/lib/server/agents/types/template.ts

export interface ResumeTemplate {
  id: string;
  name: string;
  targetRole: string;
  sections: TemplateSection[];
  bulletAllocations: BulletAllocation[];
  titleReframing: TitleReframing[];
  createdAt: Date;
  successRate?: number;
}

export interface TemplateSection {
  name: string;
  order: number;
  required: boolean;
  maxBullets: number;
  focusAreas: string[];
}

export interface BulletAllocation {
  sectionName: string;
  requirementId: string;
  allocatedBullets: number;
  priority: number;
}

export interface TitleReframing {
  originalTitle: string;
  reframedTitle: string;
  rationale: string;
  targetRole: string;
}

export interface RoleConsolidation {
  experiences: ExperienceItem[];
  consolidatedRole: string;
  combinedAchievements: string[];
  relevantSkills: string[];
}
```

### Experience Discovery Types

```typescript
// File: src/lib/server/agents/types/discovery.ts

export interface DiscoveryQuestion {
  id: string;
  category: DiscoveryCategory;
  question: string;
  followUpQuestions?: DiscoveryQuestion[];
  expectedInsights: string[];
}

export type DiscoveryCategory =
  | 'leadership'
  | 'technical_depth'
  | 'cross_functional'
  | 'impact_metrics'
  | 'problem_solving'
  | 'innovation'
  | 'mentorship'
  | 'process_improvement';

export interface DiscoveredExperience {
  category: DiscoveryCategory;
  description: string;
  context: string;
  impact?: string;
  skills: string[];
  confidence: number;
}

export interface ExperienceDiscoverySession {
  userId: string;
  jobId: string;
  questions: DiscoveryQuestion[];
  responses: DiscoveryResponse[];
  discoveredExperiences: DiscoveredExperience[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface DiscoveryResponse {
  questionId: string;
  response: string;
  extractedInsights: string[];
}
```

### Assembly Phase Types

```typescript
// File: src/lib/server/agents/types/assembly.ts

export interface AssemblyPlan {
  jobId: string;
  matchedRequirements: MatchedContent[];
  gaps: GapAnalysis[];
  reframingPlan: ReframingPlan[];
  coverLetterRecommendations: CoverLetterRecommendation[];
}

export interface GapAnalysis {
  requirementId: string;
  requirement: string;
  gapType: 'hard_skill' | 'soft_skill' | 'experience' | 'education' | 'certification';
  severity: 'critical' | 'significant' | 'minor';
  mitigationStrategies: MitigationStrategy[];
}

export interface MitigationStrategy {
  type: 'reframe_adjacent' | 'highlight_transferable' | 'cover_letter' | 'acknowledge_learning';
  description: string;
  content?: string;
  confidence: number;
}

export interface ReframingPlan {
  sourceContentId: string;
  targetRequirementId: string;
  strategy: ReframingStrategy;
  priority: number;
}

export interface CoverLetterRecommendation {
  gapId: string;
  recommendation: string;
  suggestedPhrasing: string;
  placement: 'opening' | 'body' | 'closing';
}
```

### Resume Library Types

```typescript
// File: src/lib/server/agents/types/library.ts

export interface ResumeLibraryEntry {
  id: string;
  userId: string;
  jobId: string;
  resumeContent: string;
  matchScore: number;
  atsScore: number;
  confidence: ConfidenceScore;
  matchedRequirements: MatchedContent[];
  gaps: GapAnalysis[];
  outcome?: LibraryOutcome;
  createdAt: Date;
}

export interface LibraryOutcome {
  applied: boolean;
  response?: 'interview' | 'rejection' | 'offer' | 'no_response';
  feedback?: string;
  updatedAt: Date;
}

export interface LibrarySearchResult {
  entry: ResumeLibraryEntry;
  similarity: number;
  applicablePatterns: ApplicablePattern[];
}

export interface ApplicablePattern {
  patternType: 'skill_match' | 'reframing' | 'gap_mitigation' | 'structure';
  description: string;
  confidence: number;
}
```

### Multi-Job Batch Types

```typescript
// File: src/lib/server/agents/types/batch.ts

export interface BatchGenerationRequest {
  userId: string;
  jobIds: string[];
  sharedDiscovery: boolean;
  priority: 'parallel' | 'sequential';
  options: BatchGenerationOptions;
}

export interface BatchGenerationOptions {
  includeResearch: boolean;
  generateCoverLetter: boolean;
  maxConcurrency: number;
  progressCallback?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  totalJobs: number;
  completedJobs: number;
  currentJobId?: string;
  phase: string;
  estimatedTimeRemaining?: number;
}

export interface BatchGenerationResult {
  results: Map<string, ApplicationGenerationOutput>;
  sharedInsights: SharedInsights;
  totalDurationMs: number;
  totalCostCents: number;
}

export interface SharedInsights {
  commonRequirements: string[];
  discoveredExperiences: DiscoveredExperience[];
  reusableReframings: ReframingStrategy[];
}
```

---

## Database Schema Changes

### New Tables

```sql
-- File: supabase/migrations/XXXX_resume_library.sql

-- Resume library for storing successful resumes
CREATE TABLE IF NOT EXISTS resume_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

    -- Resume content
    resume_content TEXT NOT NULL,
    resume_hash VARCHAR(64) NOT NULL, -- For deduplication

    -- Scoring
    match_score INTEGER NOT NULL,
    ats_score INTEGER NOT NULL,
    confidence_score JSONB NOT NULL, -- ConfidenceScore structure

    -- Matching data
    matched_requirements JSONB NOT NULL, -- MatchedContent[]
    gaps JSONB, -- GapAnalysis[]
    reframing_strategies JSONB, -- ReframingStrategy[]

    -- Outcome tracking
    outcome JSONB, -- LibraryOutcome

    -- Metadata
    job_title VARCHAR(500),
    company VARCHAR(255),
    industry VARCHAR(100),

    -- Embedding for similarity search
    embedding vector(1536),

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_resume_library_user_id ON resume_library(user_id);
CREATE INDEX idx_resume_library_hash ON resume_library(resume_hash);
CREATE INDEX idx_resume_library_scores ON resume_library(match_score, ats_score);
CREATE INDEX idx_resume_library_embedding ON resume_library
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS policies
ALTER TABLE resume_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own library entries"
    ON resume_library FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own library entries"
    ON resume_library FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own library entries"
    ON resume_library FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own library entries"
    ON resume_library FOR DELETE
    USING (auth.uid() = user_id);
```

```sql
-- Experience discovery sessions
CREATE TABLE IF NOT EXISTS experience_discovery_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Session data
    job_ids JSONB NOT NULL, -- UUID[] of related jobs
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    -- Questions and responses
    questions JSONB NOT NULL, -- DiscoveryQuestion[]
    responses JSONB DEFAULT '[]'::jsonb, -- DiscoveryResponse[]

    -- Discovered experiences
    discovered_experiences JSONB DEFAULT '[]'::jsonb, -- DiscoveredExperience[]

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_discovery_sessions_user_id ON experience_discovery_sessions(user_id);
CREATE INDEX idx_discovery_sessions_status ON experience_discovery_sessions(status);

ALTER TABLE experience_discovery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own discovery sessions"
    ON experience_discovery_sessions FOR ALL
    USING (auth.uid() = user_id);
```

### Modifications to Existing Tables

```sql
-- File: supabase/migrations/XXXX_enhance_job_applications.sql

-- Add confidence scoring and assembly data to job_applications
ALTER TABLE job_applications
ADD COLUMN IF NOT EXISTS confidence_score JSONB,
ADD COLUMN IF NOT EXISTS matched_requirements JSONB,
ADD COLUMN IF NOT EXISTS assembly_plan JSONB,
ADD COLUMN IF NOT EXISTS reframing_strategies JSONB,
ADD COLUMN IF NOT EXISTS cover_letter_recommendations JSONB,
ADD COLUMN IF NOT EXISTS generation_phase VARCHAR(50),
ADD COLUMN IF NOT EXISTS library_entry_id UUID REFERENCES resume_library(id);

-- Add comments
COMMENT ON COLUMN job_applications.confidence_score IS
    'Overall confidence score with tier and breakdown';
COMMENT ON COLUMN job_applications.matched_requirements IS
    'Array of matched requirements with confidence scores';
COMMENT ON COLUMN job_applications.assembly_plan IS
    'Full assembly plan including gaps and mitigation strategies';
COMMENT ON COLUMN job_applications.generation_phase IS
    'Current phase: research, template, discovery, assembly, generation, complete';
```

---

## New Tools

### 1. Confidence Scorer Tool

```typescript
// File: src/lib/server/agents/tools/confidence-scorer.ts

export interface ConfidenceScorerInput {
  requirement: string;
  candidateContent: ContentSource[];
  jobContext: {
    title: string;
    company: string;
    industry?: string;
  };
}

export interface ConfidenceScorerOutput {
  confidence: ConfidenceScore;
  bestMatch: ContentSource | null;
  reframingRecommendation?: ReframingStrategyType;
  explanation: string;
}

export const ConfidenceScorerTool: ToolDefinition<ConfidenceScorerInput, ConfidenceScorerOutput> = {
  id: 'confidence-scorer',
  name: 'Confidence Scorer',
  description:
    'Scores how well candidate content matches a job requirement using a multi-factor ' +
    'confidence model. Returns tier classification (direct/transferable/adjacent/weak/gap) ' +
    'and reframing recommendations.',
  // ... implementation
};
```

### 2. Content Reframer Tool

```typescript
// File: src/lib/server/agents/tools/content-reframer.ts

export interface ContentReframerInput {
  originalContent: string;
  targetRequirement: string;
  strategy: ReframingStrategyType;
  jobContext: {
    title: string;
    company: string;
    industry?: string;
    keywords: string[];
  };
}

export interface ContentReframerOutput {
  reframedContent: string;
  preservedMeaning: string;
  adaptedElements: string[];
  confidence: number;
}

export const ContentReframerTool: ToolDefinition<ContentReframerInput, ContentReframerOutput> = {
  id: 'content-reframer',
  name: 'Content Reframer',
  description:
    'Reframes candidate content to better match job requirements while preserving ' +
    'truthfulness. Supports keyword alignment, emphasis shift, abstraction adjustment, ' +
    'and scale emphasis strategies.',
  // ... implementation
};
```

### 3. Gap Analyzer Tool

```typescript
// File: src/lib/server/agents/tools/gap-analyzer.ts

export interface GapAnalyzerInput {
  requirements: ExtractedSkill[];
  matchedContent: MatchedContent[];
  profile: ProfileInfo;
  options?: {
    includeTransferable: boolean;
    includeLearningRecommendations: boolean;
  };
}

export interface GapAnalyzerOutput {
  gaps: GapAnalysis[];
  criticalGapsCount: number;
  mitigationCoverage: number; // Percentage of gaps with mitigation strategies
  coverLetterRecommendations: CoverLetterRecommendation[];
}

export const GapAnalyzerTool: ToolDefinition<GapAnalyzerInput, GapAnalyzerOutput> = {
  id: 'gap-analyzer',
  name: 'Gap Analyzer',
  description:
    'Analyzes gaps between job requirements and matched content. Provides mitigation ' +
    'strategies including adjacent experience reframing and cover letter recommendations.',
  // ... implementation
};
```

### 4. Role Benchmarker Tool

```typescript
// File: src/lib/server/agents/tools/role-benchmarker.ts

export interface RoleBenchmarkerInput {
  roleTitle: string;
  company: string;
  industry?: string;
  jobDescription: string;
}

export interface RoleBenchmarkerOutput {
  benchmark: RoleBenchmark;
  successProfile: SuccessProfile;
  marketPosition: {
    demandLevel: 'high' | 'medium' | 'low';
    competitionLevel: 'high' | 'medium' | 'low';
    growthTrend: 'growing' | 'stable' | 'declining';
  };
}

export const RoleBenchmarkerTool: ToolDefinition<RoleBenchmarkerInput, RoleBenchmarkerOutput> = {
  id: 'role-benchmarker',
  name: 'Role Benchmarker',
  description:
    'Creates a benchmark for a role including required/preferred skills, typical ' +
    'experience, compensation ranges, and success profiles based on industry standards.',
  // ... implementation
};
```

### 5. Resume Library Search Tool

```typescript
// File: src/lib/server/agents/tools/library-search.ts

export interface LibrarySearchInput {
  userId: string;
  jobDescription: string;
  targetRole: string;
  requiredSkills: string[];
  limit?: number;
}

export interface LibrarySearchOutput {
  results: LibrarySearchResult[];
  applicablePatterns: ApplicablePattern[];
  recommendedStrategies: string[];
}

export const LibrarySearchTool: ToolDefinition<LibrarySearchInput, LibrarySearchOutput> = {
  id: 'library-search',
  name: 'Resume Library Search',
  description:
    'Searches the user\'s resume library for similar past resumes. Returns applicable ' +
    'patterns and strategies that worked for similar roles.',
  // ... implementation
};
```

### 6. Experience Discovery Tool

```typescript
// File: src/lib/server/agents/tools/experience-discovery.ts

export interface ExperienceDiscoveryInput {
  profile: ProfileInfo;
  gaps: GapAnalysis[];
  targetRole: string;
}

export interface ExperienceDiscoveryOutput {
  questions: DiscoveryQuestion[];
  categories: DiscoveryCategory[];
  estimatedDiscoveryTime: number; // minutes
}

export const ExperienceDiscoveryTool: ToolDefinition<ExperienceDiscoveryInput, ExperienceDiscoveryOutput> = {
  id: 'experience-discovery',
  name: 'Experience Discovery',
  description:
    'Generates targeted questions to surface undocumented experiences that could ' +
    'address identified gaps. Uses branching questions for depth.',
  // ... implementation
};
```

---

## Refactored Agent Workflow

### New Agent: ResumeGenerationAgentV2

```typescript
// File: src/lib/server/agents/agents/resume-generation-v2.ts

export class ResumeGenerationAgentV2 extends BaseAgent<ResumeAgentInputV2, ResumeAgentOutputV2> {
  constructor() {
    const config: AgentConfig = {
      id: 'resume-generation-v2',
      name: 'Resume Generation Agent V2',
      description: 'Phase-based resume generation with confidence scoring',
      defaultModel: 'claude-sonnet-4-5-20250929',
      maxRetries: 2,
      timeoutMs: 180000, // 3 minutes
      priority: 'high'
    };

    super(config);

    // Register tools
    this.registerTool(SkillExtractorTool);
    this.registerTool(ConfidenceScorerTool);
    this.registerTool(ContentReframerTool);
    this.registerTool(GapAnalyzerTool);
    this.registerTool(RoleBenchmarkerTool);
    this.registerTool(LibrarySearchTool);
    this.registerTool(ExperienceDiscoveryTool);
    this.registerTool(WebSearchTool);
    this.registerTool(QualityScorerTool);
  }

  protected async executeInternal(
    input: ResumeAgentInputV2,
    context: AgentContext
  ): Promise<ResumeAgentOutputV2> {
    // Phase 0: Library Initialization
    const libraryResults = await this.phase0_libraryInit(input, context);

    // Phase 1: Research
    const research = await this.phase1_research(input, context, libraryResults);

    // Phase 2: Template Generation
    const template = await this.phase2_template(input, context, research);

    // Phase 2.5: Experience Discovery (if enabled and gaps exist)
    let discoveredExperiences: DiscoveredExperience[] = [];
    if (input.options?.enableDiscovery && template.gaps.length > 0) {
      discoveredExperiences = await this.phase25_discovery(input, context, template);
    }

    // Phase 3: Assembly
    const assembly = await this.phase3_assembly(
      input, context, research, template, discoveredExperiences
    );

    // Phase 4: Generation
    const generated = await this.phase4_generation(input, context, assembly);

    // Phase 5: Library Update
    await this.phase5_libraryUpdate(input, context, generated);

    return generated;
  }

  private async phase0_libraryInit(
    input: ResumeAgentInputV2,
    context: AgentContext
  ): Promise<LibrarySearchOutput> {
    context.trace.span({ name: 'phase0-library-init' });

    return this.executeTool('library-search', {
      userId: context.userId,
      jobDescription: input.job.description,
      targetRole: input.job.title,
      requiredSkills: input.job.requirements || []
    }, context);
  }

  private async phase1_research(
    input: ResumeAgentInputV2,
    context: AgentContext,
    libraryResults: LibrarySearchOutput
  ): Promise<ResearchOutput> {
    const span = context.trace.span({ name: 'phase1-research' });

    // Parallel execution of research tasks
    const [companyResearch, roleBenchmark, skillExtraction] = await Promise.all([
      input.options?.includeResearch
        ? this.executeTool('web-search', {
            query: `${input.job.company} company culture values technology`,
            type: 'company',
            companyName: input.job.company
          }, context)
        : null,
      this.executeTool('role-benchmarker', {
        roleTitle: input.job.title,
        company: input.job.company,
        industry: extractIndustry(input.job.description),
        jobDescription: input.job.description
      }, context),
      this.executeTool('skill-extractor', {
        text: input.job.description,
        context: 'job_description'
      }, context)
    ]);

    span.end({
      output: {
        hasCompanyResearch: !!companyResearch,
        requiredSkillsCount: skillExtraction.skills.filter(s => s.importance === 'required').length
      }
    });

    return {
      companyResearch,
      roleBenchmark,
      skills: skillExtraction.skills,
      libraryPatterns: libraryResults.applicablePatterns
    };
  }

  private async phase2_template(
    input: ResumeAgentInputV2,
    context: AgentContext,
    research: ResearchOutput
  ): Promise<TemplateOutput> {
    const span = context.trace.span({ name: 'phase2-template' });

    // Score each requirement against profile content
    const matchedRequirements = await this.scoreAllRequirements(
      research.skills,
      input.profile,
      input.job,
      context
    );

    // Analyze gaps
    const gapAnalysis = await this.executeTool('gap-analyzer', {
      requirements: research.skills,
      matchedContent: matchedRequirements,
      profile: input.profile,
      options: {
        includeTransferable: true,
        includeLearningRecommendations: true
      }
    }, context);

    // Generate bullet allocations
    const bulletAllocations = this.allocateBullets(matchedRequirements, research.roleBenchmark);

    // Generate title reframings
    const titleReframings = await this.generateTitleReframings(
      input.profile.experience,
      input.job.title,
      context
    );

    span.end({
      output: {
        matchedCount: matchedRequirements.filter(m => m.confidence.tier !== 'gap').length,
        gapsCount: gapAnalysis.gaps.length,
        criticalGapsCount: gapAnalysis.criticalGapsCount
      }
    });

    return {
      matchedRequirements,
      gaps: gapAnalysis.gaps,
      bulletAllocations,
      titleReframings,
      coverLetterRecommendations: gapAnalysis.coverLetterRecommendations
    };
  }

  private async phase25_discovery(
    input: ResumeAgentInputV2,
    context: AgentContext,
    template: TemplateOutput
  ): Promise<DiscoveredExperience[]> {
    const span = context.trace.span({ name: 'phase25-discovery' });

    // Generate discovery questions based on gaps
    const discovery = await this.executeTool('experience-discovery', {
      profile: input.profile,
      gaps: template.gaps,
      targetRole: input.job.title
    }, context);

    // If discovery is synchronous (user provides answers immediately)
    if (input.discoveryResponses) {
      const discoveredExperiences = await this.processDiscoveryResponses(
        discovery.questions,
        input.discoveryResponses,
        context
      );
      span.end({ output: { discoveredCount: discoveredExperiences.length } });
      return discoveredExperiences;
    }

    // Otherwise, create a discovery session for async completion
    await this.createDiscoverySession(context.userId, input.job.id, discovery.questions);
    span.end({ output: { sessionCreated: true, questionsCount: discovery.questions.length } });

    return [];
  }

  private async phase3_assembly(
    input: ResumeAgentInputV2,
    context: AgentContext,
    research: ResearchOutput,
    template: TemplateOutput,
    discoveredExperiences: DiscoveredExperience[]
  ): Promise<AssemblyPlan> {
    const span = context.trace.span({ name: 'phase3-assembly' });

    // Apply reframing to matched content
    const reframingPlan: ReframingPlan[] = [];

    for (const matched of template.matchedRequirements) {
      if (matched.confidence.tier === 'transferable' || matched.confidence.tier === 'adjacent') {
        const reframedContent = await this.executeTool('content-reframer', {
          originalContent: matched.sourceContent[0]?.originalText || '',
          targetRequirement: matched.requirement,
          strategy: matched.reframingStrategy?.type || 'keyword_alignment',
          jobContext: {
            title: input.job.title,
            company: input.job.company,
            industry: extractIndustry(input.job.description),
            keywords: research.skills.map(s => s.name)
          }
        }, context);

        reframingPlan.push({
          sourceContentId: matched.sourceContent[0]?.id || '',
          targetRequirementId: matched.requirementId,
          strategy: {
            type: matched.reframingStrategy?.type || 'keyword_alignment',
            originalText: matched.sourceContent[0]?.originalText || '',
            reframedText: reframedContent.reframedContent,
            preservedMeaning: reframedContent.preservedMeaning,
            adaptedElements: reframedContent.adaptedElements
          },
          priority: matched.confidence.overall
        });
      }
    }

    // Incorporate discovered experiences
    const enhancedMatches = this.incorporateDiscoveries(
      template.matchedRequirements,
      discoveredExperiences,
      template.gaps
    );

    span.end({
      output: {
        reframingCount: reframingPlan.length,
        discoveredIntegrated: discoveredExperiences.length
      }
    });

    return {
      jobId: input.job.id,
      matchedRequirements: enhancedMatches,
      gaps: template.gaps,
      reframingPlan,
      coverLetterRecommendations: template.coverLetterRecommendations
    };
  }

  private async phase4_generation(
    input: ResumeAgentInputV2,
    context: AgentContext,
    assembly: AssemblyPlan
  ): Promise<ResumeAgentOutputV2> {
    const span = context.trace.span({ name: 'phase4-generation' });

    // Generate resume using assembly plan
    const resumeContent = await this.generateResumeFromAssembly(input, assembly, context);

    // Quality check
    const qualityScore = await this.executeTool('quality-scorer', {
      content: resumeContent,
      contentType: 'resume',
      targetJob: input.job,
      originalProfile: {
        skills: input.profile.skills,
        experience: input.profile.experience.map(e => ({ title: e.title, company: e.company }))
      }
    }, context);

    // Regenerate if quality is too low
    if (!qualityScore.passed && qualityScore.suggestions.length > 0) {
      const improvedResume = await this.improveResume(
        resumeContent,
        qualityScore.suggestions,
        context
      );
      // ... continue with improved resume
    }

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(assembly.matchedRequirements);

    span.end({
      output: {
        atsScore: qualityScore.overall,
        confidenceTier: overallConfidence.tier
      }
    });

    return {
      resume: resumeContent,
      confidence: overallConfidence,
      matchedRequirements: assembly.matchedRequirements,
      gaps: assembly.gaps,
      reframingStrategies: assembly.reframingPlan.map(p => p.strategy),
      coverLetterRecommendations: assembly.coverLetterRecommendations,
      atsScore: qualityScore.overall,
      highlights: this.extractHighlights(assembly.matchedRequirements)
    };
  }

  private async phase5_libraryUpdate(
    input: ResumeAgentInputV2,
    context: AgentContext,
    generated: ResumeAgentOutputV2
  ): Promise<void> {
    const span = context.trace.span({ name: 'phase5-library-update' });

    // Only store if quality threshold met
    if (generated.atsScore >= 70 && generated.confidence.tier !== 'gap') {
      await this.storeInLibrary({
        userId: context.userId,
        jobId: input.job.id,
        resumeContent: generated.resume,
        matchScore: generated.matchedRequirements
          .filter(m => m.confidence.tier === 'direct' || m.confidence.tier === 'transferable')
          .length * 10,
        atsScore: generated.atsScore,
        confidence: generated.confidence,
        matchedRequirements: generated.matchedRequirements,
        gaps: generated.gaps,
        jobTitle: input.job.title,
        company: input.job.company
      });
    }

    span.end();
  }

  private async scoreAllRequirements(
    skills: ExtractedSkill[],
    profile: ProfileInfo,
    job: JobInfo,
    context: AgentContext
  ): Promise<MatchedContent[]> {
    const contentSources = this.extractContentSources(profile);

    return Promise.all(
      skills
        .filter(s => s.importance === 'required' || s.importance === 'preferred')
        .map(async (skill) => {
          const scoreResult = await this.executeTool('confidence-scorer', {
            requirement: skill.sourceText || skill.name,
            candidateContent: contentSources,
            jobContext: {
              title: job.title,
              company: job.company,
              industry: extractIndustry(job.description)
            }
          }, context);

          return {
            requirementId: skill.name,
            requirement: skill.sourceText || skill.name,
            confidence: scoreResult.confidence,
            sourceContent: scoreResult.bestMatch ? [scoreResult.bestMatch] : [],
            reframingStrategy: scoreResult.reframingRecommendation
              ? { type: scoreResult.reframingRecommendation } as ReframingStrategy
              : undefined
          };
        })
    );
  }

  // ... additional helper methods
}
```

---

## Inngest Function Updates

### Updated Resume Generation Function

```typescript
// File: src/lib/server/inngest/functions/resume-generation-v2.ts

import { inngest } from '../client';
import { ResumeGenerationAgentV2 } from '$lib/server/agents/agents/resume-generation-v2';

export const generateResumeForJobV2 = inngest.createFunction(
  {
    id: 'generate-resume-for-job-v2',
    name: 'Generate Resume for Job V2',
    retries: 3,
    concurrency: { limit: 5 }
  },
  { event: 'resume/generation.requested.v2' },
  async ({ event, step }) => {
    const {
      userId,
      jobId,
      applicationId,
      skipUsageCheck = false,
      enableDiscovery = false,
      discoverySessionId = null
    } = event.data;

    // Step 0: Check usage limits
    if (!skipUsageCheck) {
      const usageCheck = await step.run('check-usage-limit', async () => {
        return usageService.checkUsageLimit(userId);
      });

      if (!usageCheck.canGenerate) {
        await step.run('mark-limit-exceeded', async () => {
          // ... mark as limit_exceeded
        });
        return { success: false, error: 'usage_limit_exceeded' };
      }
    }

    // Step 1: Get job and profile data
    const { job, profile, resume } = await step.run('get-data', async () => {
      // ... fetch job, profile, resume
    });

    // Step 2: Check for pending discovery session
    let discoveryResponses = null;
    if (discoverySessionId) {
      discoveryResponses = await step.run('get-discovery-responses', async () => {
        // ... fetch discovery session responses
      });
    }

    // Step 3: Update phase tracking
    await step.run('update-phase', async () => {
      await supabase
        .from('job_applications')
        .update({ generation_phase: 'research' })
        .eq('id', applicationId);
    });

    // Step 4: Execute V2 agent
    const agent = new ResumeGenerationAgentV2();
    const result = await step.run('generate-resume-v2', async () => {
      try {
        return await agent.execute({
          userId,
          job: {
            id: jobId,
            title: job.title,
            company: job.company,
            description: job.description || '',
            requirements: job.requirements || [],
            location: job.location,
            isRemote: job.is_remote,
            sourceUrl: job.source_url || ''
          },
          profile: {
            id: profile.id,
            fullName: profile.full_name || '',
            email: profile.email,
            headline: profile.headline || '',
            summary: profile.summary || '',
            skills: profile.skills || [],
            experience: profile.experience || [],
            education: profile.education || []
          },
          resume: resume ? {
            id: resume.id,
            name: resume.file_name,
            parsedContent: resume.parsed_content
          } : undefined,
          options: {
            includeResearch: true,
            generateCoverLetter: true,
            enableDiscovery
          },
          discoveryResponses
        }, {
          userId,
          jobId,
          applicationId,
          trace: langfuse.trace({ name: 'resume-generation-v2' })
        });
      } catch (error) {
        if (error instanceof BudgetExceededError) {
          await supabase
            .from('job_applications')
            .update({ status: 'budget_exceeded' })
            .eq('id', applicationId);
        }
        throw error;
      }
    });

    // Step 5: Save application with new fields
    await step.run('save-application', async () => {
      await supabase
        .from('job_applications')
        .update({
          tailored_resume: result.resume,
          cover_letter: result.coverLetter || null,
          match_score: result.matchScore,
          ats_score: result.atsScore,
          matched_skills: result.matchedRequirements
            .filter(m => m.confidence.tier === 'direct')
            .map(m => m.requirementId),
          skill_gaps: result.gaps.map(g => g.requirement),
          confidence_score: result.confidence,
          matched_requirements: result.matchedRequirements,
          assembly_plan: result.assemblyPlan,
          reframing_strategies: result.reframingStrategies,
          cover_letter_recommendations: result.coverLetterRecommendations,
          library_entry_id: result.libraryEntryId,
          generation_phase: 'complete',
          status: 'ready'
        })
        .eq('id', applicationId);
    });

    // Step 6: Increment usage
    if (!skipUsageCheck) {
      await step.run('increment-usage', async () => {
        return usageService.incrementUsage(userId, 'generation');
      });
    }

    // Step 7: Send notification
    await step.run('send-notification', async () => {
      // ... send email notification
    });

    return {
      success: true,
      jobId,
      applicationId,
      matchScore: result.matchScore,
      atsScore: result.atsScore,
      confidenceTier: result.confidence.tier,
      gapsCount: result.gaps.length,
      traceId: result.traceId
    };
  }
);
```

### Batch Generation Function

```typescript
// File: src/lib/server/inngest/functions/batch-resume-generation.ts

export const batchGenerateResumes = inngest.createFunction(
  {
    id: 'batch-generate-resumes',
    name: 'Batch Generate Resumes',
    retries: 2,
    concurrency: { limit: 3 }
  },
  { event: 'resume/batch-generation.requested' },
  async ({ event, step }) => {
    const { userId, jobIds, options } = event.data;

    // Step 1: Initialize batch
    const batchId = await step.run('init-batch', async () => {
      // Create batch tracking record
      return `batch_${Date.now()}`;
    });

    // Step 2: Shared research phase (if enabled)
    let sharedInsights: SharedInsights | null = null;
    if (options.sharedDiscovery) {
      sharedInsights = await step.run('shared-research', async () => {
        // Perform discovery once across all jobs
        const allGaps = await analyzeCommonGaps(userId, jobIds);
        const discovery = await generateSharedDiscoveryQuestions(allGaps);
        return discovery;
      });
    }

    // Step 3: Process jobs in parallel with controlled concurrency
    const results = await step.run('process-jobs', async () => {
      const batchProcessor = new BatchResumeProcessor(options.maxConcurrency || 3);
      return batchProcessor.process(jobIds, userId, sharedInsights);
    });

    // Step 4: Aggregate results
    const aggregated = await step.run('aggregate-results', async () => {
      return {
        totalJobs: jobIds.length,
        successfulJobs: results.filter(r => r.success).length,
        failedJobs: results.filter(r => !r.success).length,
        averageAtsScore: calculateAverageScore(results, 'atsScore'),
        averageMatchScore: calculateAverageScore(results, 'matchScore'),
        reusedPatterns: sharedInsights?.reusableReframings.length || 0
      };
    });

    return {
      batchId,
      ...aggregated,
      results
    };
  }
);
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

1. **Create new type definitions**
   - Add all new interfaces to `src/lib/server/agents/types/`
   - Update existing types for backward compatibility

2. **Database migrations**
   - Create `resume_library` table
   - Create `experience_discovery_sessions` table
   - Add new columns to `job_applications`

3. **Create core tools**
   - ConfidenceScorerTool
   - ContentReframerTool
   - GapAnalyzerTool

### Phase 2: Research & Template (Week 3-4)

1. **Implement research phase tools**
   - RoleBenchmarkerTool
   - LibrarySearchTool

2. **Create ResumeGenerationAgentV2**
   - Implement Phase 0 (Library Init)
   - Implement Phase 1 (Research)
   - Implement Phase 2 (Template)

3. **Update orchestrator**
   - Add V2 agent support
   - Maintain backward compatibility

### Phase 3: Assembly & Generation (Week 5-6)

1. **Implement assembly phase**
   - Content reframing logic
   - Gap mitigation strategies
   - Cover letter recommendations

2. **Implement generation phase**
   - Resume generation from assembly plan
   - Quality scoring integration
   - Library update logic

3. **Create V2 Inngest function**
   - Phase tracking
   - New field storage
   - Error handling

### Phase 4: Discovery & Batch (Week 7-8)

1. **Implement experience discovery**
   - ExperienceDiscoveryTool
   - Discovery session management
   - Response processing

2. **Implement batch processing**
   - BatchResumeProcessor
   - Shared insights logic
   - Batch Inngest function

3. **Frontend integration**
   - Discovery question UI
   - Batch progress tracking
   - Confidence tier display

### Phase 5: Testing & Rollout (Week 9-10)

1. **Testing**
   - Unit tests for new tools
   - Integration tests for V2 agent
   - E2E tests for Inngest functions

2. **Gradual rollout**
   - Feature flag for V2
   - A/B testing against V1
   - Metrics collection

3. **Documentation**
   - API documentation
   - User guides
   - Migration guide from V1

---

## Migration Strategy

### Backward Compatibility

1. **Keep V1 functions active**
   - `generateResumeForJob` remains for existing applications
   - New event `resume/generation.requested.v2` for V2

2. **Gradual feature adoption**
   - Feature flag `RESUME_V2_ENABLED`
   - User-level opt-in for V2 features
   - Default to V1 for existing users

3. **Data migration**
   - No breaking changes to existing tables
   - New columns are optional
   - Library built incrementally from successful generations

### Rollback Plan

1. **Feature flag disable**
   - Instant switch back to V1
   - No data loss

2. **Database rollback**
   - New tables can be dropped
   - New columns can be ignored
   - Existing data unaffected

---

## Success Metrics

### Quality Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Average ATS Score | 72% | 85% |
| Direct Match Rate | 45% | 60% |
| Gap Mitigation Coverage | 0% | 75% |
| User Satisfaction (post-generation) | N/A | 4.2/5 |

### Performance Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Generation Time (single) | 45s | 60s |
| Generation Time (batch of 5) | 225s | 120s |
| Library Lookup Time | N/A | <500ms |
| Pattern Reuse Rate | 0% | 40% |

### Business Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Resume Regeneration Rate | 25% | 10% |
| Interview Callback Rate | TBD | +15% |
| User Retention (30-day) | TBD | +10% |

---

## Appendix: Confidence Tier Examples

### Direct Match (90-100%)

**Requirement**: "5+ years of Python development experience"
**Profile**: "Senior Python Developer at Company X (6 years), built microservices, APIs, ML pipelines"
**Score**: 95%
**Strategy**: Use directly with minimal adjustment

### Transferable (75-89%)

**Requirement**: "Experience with AWS Lambda and serverless architecture"
**Profile**: "Built serverless functions using Google Cloud Functions for real-time data processing"
**Score**: 82%
**Strategy**: Keyword alignment - same capability, different platform

### Adjacent (60-74%)

**Requirement**: "Experience with Kubernetes orchestration"
**Profile**: "Managed Docker Swarm clusters for container orchestration, 50+ containers"
**Score**: 68%
**Strategy**: Abstraction adjustment - emphasize container orchestration concepts

### Weak (45-59%)

**Requirement**: "Experience with GraphQL API design"
**Profile**: "Designed REST APIs following OpenAPI specification"
**Score**: 52%
**Strategy**: Consider only if no better match; cover letter recommendation

### Gap (<45%)

**Requirement**: "Certified AWS Solutions Architect"
**Profile**: No AWS certification
**Score**: 20%
**Strategy**: Flag as unaddressable; recommend for cover letter acknowledgment
