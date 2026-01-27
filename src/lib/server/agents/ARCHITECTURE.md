# Agentic Flow Architecture for HowlerHire

## Overview

This document describes the multi-agent architecture for HowlerHire, enabling intelligent resume tailoring, cover letter generation, job matching, and profile enhancement through composable AI agents.

## Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              HOWLERHIRE AGENTIC SYSTEM                          |
+-----------------------------------------------------------------------------------+
                                        |
                    +-------------------v-------------------+
                    |           ORCHESTRATOR LAYER          |
                    |  (Inngest Workflows + Agent Router)   |
                    +-------------------+-------------------+
                                        |
        +---------------+---------------+---------------+---------------+
        |               |               |               |               |
        v               v               v               v               v
+---------------+ +---------------+ +---------------+ +---------------+ +---------------+
|  ResumeAgent  | |CoverLetter    | |JobMatchAgent  | |ProfileAgent   | |ResearchAgent  |
|               | |Agent          | |               | |               | |               |
| - Research    | | - Company     | | - Scoring     | | - Analysis    | | - Web Search  |
| - Tailor      | |   Research    | | - Ranking     | | - Enhance     | | - Data Extract|
| - Optimize    | | - Generate    | | - Filter      | | - Suggest     | | - Summarize   |
+-------+-------+ +-------+-------+ +-------+-------+ +-------+-------+ +-------+-------+
        |               |               |               |               |
        +---------------+---------------+---------------+---------------+
                                        |
                    +-------------------v-------------------+
                    |              TOOLS LAYER              |
                    +---------------------------------------+
                    |                                       |
    +---------------+---------------+---------------+---------------+
    |               |               |               |               |
    v               v               v               v               v
+--------+    +----------+    +---------+    +----------+    +---------+
| Web    |    | Profile  |    | Skill   |    | Content  |    | Quality |
| Search |    | Analyzer |    | Extract |    | Generate |    | Score   |
+--------+    +----------+    +---------+    +----------+    +---------+

                                        |
                    +-------------------v-------------------+
                    |           INFRASTRUCTURE              |
                    +---------------------------------------+
                    |                                       |
    +---------------+---------------+---------------+---------------+
    |               |               |               |               |
    v               v               v               v               v
+---------+    +----------+    +----------+    +----------+    +---------+
| Langfuse|    | Budget   |    | LLM      |    | Database |    | Cache   |
| Tracing |    | Manager  |    | Client   |    | (Drizzle)|    | (KV)    |
+---------+    +----------+    +----------+    +----------+    +---------+
```

## Component Interactions

```
                         User Request
                              |
                              v
+-------------------------------------------------------------------------+
|                        API ENDPOINT                                      |
|  POST /api/jobs/[id]/apply                                              |
+-------------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------------+
|                     INNGEST EVENT                                        |
|  Event: "application/generate.requested"                                |
|  Data: { userId, jobId, options: { includeResearch: true } }           |
+-------------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------------+
|                    ORCHESTRATOR                                          |
|  1. Validate request                                                    |
|  2. Check budget                                                        |
|  3. Create Langfuse trace                                               |
|  4. Route to appropriate agents                                         |
+-------------------------------------------------------------------------+
                              |
         +--------------------+--------------------+
         |                    |                    |
         v                    v                    v
+------------------+ +------------------+ +------------------+
|  RESEARCH PHASE  | |   PARALLEL       | |   SEQUENTIAL     |
|  (if enabled)    | |   EXECUTION      | |   EXECUTION      |
+------------------+ +------------------+ +------------------+
| ResearchAgent    | | JobMatchAgent    | | ResumeAgent      |
| - Company info   | | - Score fit      | | - After research |
| - Culture        | | - Gap analysis   | | CoverLetterAgent |
| - Recent news    | |                  | | - After resume   |
+------------------+ +------------------+ +------------------+
         |                    |                    |
         +--------------------+--------------------+
                              |
                              v
+-------------------------------------------------------------------------+
|                    QUALITY CHECK                                         |
|  QualityScorer.score(resume, coverLetter, job)                          |
|  - ATS compatibility                                                    |
|  - Keyword coverage                                                     |
|  - Format validation                                                    |
+-------------------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------------------+
|                    PERSISTENCE                                           |
|  - Save to job_applications table                                       |
|  - Update job status                                                    |
|  - Generate PDF (async)                                                 |
+-------------------------------------------------------------------------+
```

## Data Flow for Resume Generation

```
+-------------+     +-------------+     +-------------+     +-------------+
|   Profile   | --> |   Tools     | --> |   Agent     | --> |   Output    |
|   + Job     |     |   Execute   |     |   Reason    |     |   Result    |
+-------------+     +-------------+     +-------------+     +-------------+
      |                   |                   |                   |
      |    Langfuse Span  |   Langfuse Span   |   Langfuse Span   |
      |    "input"        |   "tool:skill"    |   "generate"      |
      v                   v                   v                   v
+-----------------------------------------------------------------------------+
|                           LANGFUSE TRACE                                    |
|  trace_id: "app-gen-{uuid}"                                                |
|  user_id: "{userId}"                                                       |
|  metadata: { jobId, company, position }                                    |
|                                                                            |
|  Spans:                                                                    |
|  [input] --> [tool:research] --> [tool:skills] --> [generate] --> [output] |
|                                                                            |
|  Generations:                                                              |
|  - research-company (gemini-1.5-flash)                                    |
|  - extract-skills (gemini-1.5-flash)                                      |
|  - generate-resume (claude-3-5-sonnet)                                    |
|  - generate-cover (gpt-4o)                                                |
|  - quality-score (gemini-1.5-flash)                                       |
+-----------------------------------------------------------------------------+
```

## Agent State Machine

```
                    +------------+
                    |   IDLE     |
                    +-----+------+
                          |
                    start |
                          v
                    +------------+
             +----->| PLANNING   |<-----+
             |      +-----+------+      |
             |            |             |
             |      plan  |             | retry
             |            v             |
             |      +------------+      |
             |      | EXECUTING  |------+
             |      +-----+------+
             |            |
             |   complete | error
             |            |
             |      +-----v------+      +------------+
             |      | VALIDATING |----->|  FAILED    |
             |      +-----+------+      +------------+
             |            |
             |    valid   | invalid
             |            |
             +------------+
                          |
                    +-----v------+
                    | COMPLETED  |
                    +------------+
```

## Prompt Management via Langfuse

```
+-------------------------------------------------------------------------+
|                     LANGFUSE PROMPT REGISTRY                            |
+-------------------------------------------------------------------------+
|                                                                         |
|  PROMPTS:                                                              |
|  +-------------------------------------------------------------------+ |
|  | Name: resume-generation                                           | |
|  | Version: 2.1                                                      | |
|  | Variables: {job_title, company, description, profile, skills}     | |
|  +-------------------------------------------------------------------+ |
|  | Name: cover-letter-generation                                     | |
|  | Version: 1.5                                                      | |
|  | Variables: {job_title, company, why_interested, achievements}     | |
|  +-------------------------------------------------------------------+ |
|  | Name: job-match-scoring                                           | |
|  | Version: 1.2                                                      | |
|  | Variables: {job_requirements, profile_skills, experience}         | |
|  +-------------------------------------------------------------------+ |
|  | Name: skill-extraction                                            | |
|  | Version: 1.0                                                      | |
|  | Variables: {job_description}                                      | |
|  +-------------------------------------------------------------------+ |
|  | Name: company-research                                            | |
|  | Version: 1.1                                                      | |
|  | Variables: {company_name, position}                               | |
|  +-------------------------------------------------------------------+ |
|                                                                         |
+-------------------------------------------------------------------------+

USAGE IN CODE:
```typescript
const prompt = await langfuse.getPrompt('resume-generation', { version: 2 });
const compiled = prompt.compile({
  job_title: job.title,
  company: job.company,
  // ... other variables
});
```
```

## Budget-Aware Execution Flow

```
+-----------------------------------------------------------------------------+
|                        BUDGET-AWARE AGENT EXECUTION                         |
+-----------------------------------------------------------------------------+

                    Agent.execute(task)
                          |
                          v
                +-------------------+
                |  checkBudget()    |
                +--------+----------+
                         |
            +------------+------------+
            |                         |
     allowed: true             allowed: false
            |                         |
            v                         v
    +--------------+          +-----------------+
    | Estimate     |          | Return          |
    | Token Cost   |          | BudgetExceeded  |
    +--------------+          +-----------------+
            |
            v
    +--------------+
    | Reserve      |
    | Budget       |
    +--------------+
            |
            v
    +--------------+
    | Execute LLM  |
    | Call         |
    +--------------+
            |
    +-------+-------+
    |               |
 success         error
    |               |
    v               v
+---------+    +----------+
| Record  |    | Release  |
| Usage   |    | Reserve  |
+---------+    +----------+
```

## Error Handling & Retry Strategy

```
+-----------------------------------------------------------------------------+
|                           ERROR HANDLING MATRIX                             |
+-----------------------------------------------------------------------------+

| Error Type          | Retry? | Max Retries | Backoff    | Fallback         |
|---------------------|--------|-------------|------------|------------------|
| Rate Limit          | Yes    | 5           | Exponential| Switch provider  |
| Budget Exceeded     | No     | -           | -          | Notify user      |
| API Error           | Yes    | 3           | Linear     | Cache/default    |
| Invalid Response    | Yes    | 2           | None       | Simpler prompt   |
| Timeout             | Yes    | 2           | None       | Reduce tokens    |
| Validation Failed   | Yes    | 1           | None       | Manual review    |

IMPLEMENTATION:
```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error)) throw error;
      if (attempt === config.maxRetries) throw error;

      await sleep(calculateBackoff(attempt, config));
    }
  }

  throw lastError!;
}
```
```

## Streaming Response Architecture

```
+-----------------------------------------------------------------------------+
|                        STREAMING RESPONSE FLOW                              |
+-----------------------------------------------------------------------------+

Client                    Server                         LLM
   |                         |                            |
   |  POST /api/generate     |                            |
   |  Accept: text/event-stream                           |
   |------------------------>|                            |
   |                         |  Start Langfuse trace      |
   |                         |--------------------------->|
   |                         |                            |
   |                         |  streamText()              |
   |                         |--------------------------->|
   |                         |                            |
   |  event: token           |<-- chunk 1 ----------------|
   |  data: "Dear "          |                            |
   |<------------------------|                            |
   |                         |                            |
   |  event: token           |<-- chunk 2 ----------------|
   |  data: "Hiring "        |                            |
   |<------------------------|                            |
   |                         |                            |
   |  event: token           |<-- chunk N ----------------|
   |  data: "..."            |                            |
   |<------------------------|                            |
   |                         |                            |
   |  event: done            |  End generation span       |
   |  data: {usage, cost}    |  Record usage              |
   |<------------------------|                            |
   |                         |                            |
```

## File Structure

```
src/lib/server/agents/
├── ARCHITECTURE.md           # This document
├── index.ts                  # Main exports
├── types.ts                  # All TypeScript interfaces and types
├── orchestrator.ts           # High-level orchestration functions
│
├── core/
│   ├── index.ts              # Core exports
│   └── base-agent.ts         # Abstract base agent class
│
├── agents/
│   ├── index.ts              # Agent exports
│   ├── resume-agent.ts       # Multi-step resume tailoring
│   ├── cover-letter-agent.ts # Company-aware cover letters
│   ├── job-match-agent.ts    # Profile-job matching and scoring
│   └── profile-agent.ts      # Profile analysis and enhancement
│
└── tools/
    ├── index.ts              # Tool exports
    ├── web-search.ts         # Company/industry research
    ├── profile-analyzer.ts   # Profile strength analysis
    ├── skill-extractor.ts    # Skill extraction from text
    ├── content-generator.ts  # Content generation utilities
    └── quality-scorer.ts     # Resume/cover letter scoring
```

## Agent Composition Patterns

### 1. Sequential Composition (Application Generation)

```
                    generateApplication()
                           |
                           v
            +-----------------------------+
            |      JobMatchAgent          |  <-- Fast, runs first
            |  (Score profile-job fit)    |      Informs other agents
            +-----------------------------+
                           |
                           v
            +-----------------------------+
            |       ResumeAgent           |  <-- Primary deliverable
            |  (Tailor resume to job)     |      Uses match insights
            +-----------------------------+
                           |
                           v
            +-----------------------------+
            |    CoverLetterAgent         |  <-- Uses resume context
            |  (Generate cover letter)    |      Company research
            +-----------------------------+
```

### 2. Parallel Composition (Batch Matching)

```
                    batchMatchJobs()
                           |
            +--------------+--------------+
            |              |              |
            v              v              v
      +---------+    +---------+    +---------+
      | Match   |    | Match   |    | Match   |
      | Job 1   |    | Job 2   |    | Job 3   |
      +---------+    +---------+    +---------+
            |              |              |
            +--------------+--------------+
                           |
                           v
                    Sort by score
                    Filter by threshold
```

### 3. Tool Composition (Within Agents)

```
ResumeAgent.execute()
       |
       +----> SkillExtractorTool.execute()
       |             |
       |             v
       |      Extract job requirements
       |
       +----> ProfileAnalyzerTool.execute()
       |             |
       |             v
       |      Analyze profile-job fit
       |
       +----> WebSearchTool.execute() [optional]
       |             |
       |             v
       |      Research company culture
       |
       +----> generate() [LLM call]
       |             |
       |             v
       |      Generate tailored resume
       |
       +----> QualityScorerTool.execute()
                     |
                     v
              Validate output quality
```

### 4. Custom Orchestration Plans

```typescript
// Example: Custom plan for quick job evaluation
const quickEvalPlan: OrchestrationPlan = {
  id: 'quick-eval',
  name: 'Quick Job Evaluation',
  steps: [
    {
      id: 'match',
      name: 'Calculate Match Score',
      agentId: 'job-match-agent',
      inputMapping: {
        job: 'input.job',
        profile: 'input.profile'
      }
    },
    {
      id: 'preview',
      name: 'Generate Resume Preview',
      agentId: 'resume-agent',
      inputMapping: {
        job: 'input.job',
        profile: 'input.profile'
      },
      dependsOn: ['match'],
      condition: (ctx) => ctx['match.overallScore'] >= 60,
      optional: true
    }
  ],
  input: { job, profile },
  timeoutMs: 60000
};

await executeOrchestrationPlan(quickEvalPlan, userId);
```

## Integration with Existing Systems

### Inngest Integration

```typescript
// src/lib/server/inngest/functions/application-generation.ts
import { inngest } from '../client';
import { generateApplication } from '$lib/server/agents';

export const generateApplicationWorkflow = inngest.createFunction(
  {
    id: 'generate-application',
    name: 'Generate Job Application',
    retries: 2,
    concurrency: { limit: 3 }
  },
  { event: 'application/generate.requested' },
  async ({ event, step }) => {
    const { userId, jobId, applicationId, options } = event.data;

    // Load data (existing pattern)
    const { job, profile, resume } = await step.run('load-data', async () => {
      // ... load from database
    });

    // Use agent orchestrator
    const result = await step.run('generate-application', async () => {
      return await generateApplication({
        userId,
        job,
        profile,
        resume,
        options
      });
    });

    // Save results (existing pattern)
    await step.run('save-results', async () => {
      // ... save to database
    });

    return result;
  }
);
```

### API Route Integration

```typescript
// src/routes/api/jobs/[id]/apply/+server.ts
import { json } from '@sveltejs/kit';
import { generateApplication } from '$lib/server/agents';

export async function POST({ params, locals }) {
  const userId = locals.user.id;
  const jobId = params.id;

  // For synchronous (streaming) generation
  const result = await generateApplication({
    userId,
    job: await loadJob(jobId),
    profile: await loadProfile(userId),
    resume: await loadDefaultResume(userId)
  });

  return json(result);
}
```

## Key Interfaces

### AgentContext
```typescript
interface AgentContext {
  userId: string;
  jobId?: string;
  applicationId?: string;
  trace: LangfuseTraceClient;    // Required for observability
  parentSpan?: LangfuseSpanClient;
  abortSignal?: AbortSignal;     // For cancellation
  metadata?: Record<string, unknown>;
}
```

### AgentResult
```typescript
interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: AgentErrorCode;
  durationMs: number;
  costCents: number;
  usage: TokenUsage;
  traceId: string;
}
```

### ToolDefinition
```typescript
interface ToolDefinition<TInput, TOutput> {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: TInput, context: ToolContext) => Promise<ToolResult<TOutput>>;
}
```

## Model Selection Strategy

| Agent/Tool           | Model                    | Rationale                        |
|---------------------|--------------------------|----------------------------------|
| ResumeAgent         | claude-3-5-sonnet        | High quality content generation  |
| CoverLetterAgent    | gpt-4o                   | Good balance of quality/cost     |
| JobMatchAgent       | gemini-1.5-flash         | Fast scoring, cost-effective     |
| ProfileAgent        | claude-3-haiku           | Quick analysis tasks             |
| SkillExtractor      | gemini-1.5-flash         | Structured extraction            |
| QualityScorer       | gemini-1.5-flash         | Fast validation                  |
| WebSearch           | gemini-1.5-flash         | Summarization tasks              |
| ContentGenerator    | varies by content type   | Flexible based on needs          |

## Observability

All agents and tools automatically trace to Langfuse:

1. **Traces**: One per orchestration (application generation, batch matching)
2. **Spans**: One per agent execution, nested for tools
3. **Generations**: One per LLM call with full prompt/response
4. **Metrics**: Token usage, cost, duration, success/failure

View traces at: `https://cloud.langfuse.com/project/{project_id}/traces`
