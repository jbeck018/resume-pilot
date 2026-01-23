# Observable AI Client - Usage Guide

Comprehensive LLM observability wrapper for Vercel AI SDK with budget validation, rate limiting, caching, tracing, and quality scoring.

## Features

### 🔒 Pre-Call Hooks
1. **Budget Validation**: Check user budget before expensive LLM calls
2. **Rate Limiting**: Token bucket algorithm to prevent abuse
3. **Input Sanitization**: Trim and limit input length
4. **Prompt Retrieval**: Fetch versioned prompts from Langfuse

### 📊 Post-Call Hooks
1. **Usage Recording**: Store token usage and costs to database
2. **Cost Calculation**: Accurate cost tracking per model
3. **Quality Scoring**: Heuristic-based quality assessment
4. **Error Handling**: Automatic retries with exponential backoff

### 🔍 Tracing & Observability
1. **Parent-Child Spans**: Hierarchical trace structure
2. **Metadata Attachment**: Rich context for every operation
3. **Performance Metrics**: Latency tracking per hook
4. **Langfuse Integration**: Full observability with Langfuse

### 💾 Caching
1. **SHA-256 Cache Keys**: Deterministic hashing of normalized prompts
2. **TTL Management**: Purpose-based TTL strategies
3. **Cache Pruning**: Automatic cleanup of expired entries
4. **Zero-Cost Cache Hits**: Cached responses have zero cost

---

## Quick Start

### Basic Usage

```typescript
import { ObservableAIClient } from '$lib/server/llm/observable-client';
import { getLangfuse } from '$lib/server/llm/client';

const client = new ObservableAIClient(getLangfuse());

const result = await client.generate({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Write a professional summary for a software engineer' }
  ],
  userId: 'user-123',
  purpose: 'resume',
  jobId: 'job-456'
});

console.log(result.content); // Generated text
console.log(result.cost); // Cost in cents
console.log(result.cached); // Was this a cache hit?
console.log(result.qualityScore); // 0-100 quality score
```

### Streaming Usage

```typescript
const stream = client.generateStream({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Write a cover letter for a frontend role' }
  ],
  userId: 'user-123',
  purpose: 'cover_letter'
});

// Stream chunks to client
for await (const chunk of stream) {
  process.stdout.write(chunk);
}

// Get final result with usage metrics
const finalResult = await stream.return();
console.log('Total cost:', finalResult.cost);
```

---

## Advanced Features

### 1. Langfuse Prompt Management

Store prompts in Langfuse UI and fetch them by name:

```typescript
const result = await client.generate({
  model: 'claude-3-5-sonnet-20241022',
  promptName: 'resume-summary-v2', // Fetch from Langfuse
  promptVersion: 'production', // Or specific version number
  userId: 'user-123',
  purpose: 'resume'
});
```

**Benefits**:
- Non-technical teams can update prompts in UI
- Zero-latency client-side caching
- Version control for prompts
- Link prompts to traces for metrics

### 2. Custom Caching Strategy

```typescript
const result = await client.generate({
  model: 'gemini-1.5-flash',
  messages: [
    { role: 'user', content: 'Match this job to my profile' }
  ],
  userId: 'user-123',
  purpose: 'job_match',

  // Custom cache config
  enableCache: true,
  cacheTTL: 300, // 5 minutes (job data can change)
  cacheNamespace: 'job-matching'
});
```

**Default TTLs by Purpose**:
- `resume`: 3600s (1 hour)
- `cover_letter`: 1800s (30 minutes)
- `job_match`: 300s (5 minutes)
- `summary`: 3600s (1 hour)
- `embedding`: 86400s (24 hours)
- `general`: 600s (10 minutes)

### 3. Parent-Child Span Tracing

```typescript
const langfuse = getLangfuse();

// Create parent trace
const trace = langfuse.trace({
  name: 'resume-generation-workflow',
  userId: 'user-123'
});

// Generate summary (child span 1)
const summary = await client.generate({
  model: 'claude-3-haiku-20240307',
  messages: [{ role: 'user', content: 'Summarize experience' }],
  userId: 'user-123',
  traceId: trace.id,
  parentSpanId: trace.id,
  purpose: 'summary'
});

// Generate full resume (child span 2)
const resume = await client.generate({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: `Summary: ${summary.content}\n\nFull resume...` }],
  userId: 'user-123',
  traceId: trace.id,
  parentSpanId: trace.id,
  purpose: 'resume'
});

// View full trace in Langfuse with parent-child relationships
```

### 4. Budget-Aware Generation

```typescript
try {
  const result = await client.generate({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: '...' }],
    userId: 'user-123',
    purpose: 'resume'
    // skipBudgetCheck: false (default)
  });
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.log('Budget exceeded:', error.budgetCheck.message);
    console.log('Remaining:', error.budgetCheck.remainingCents, 'cents');
    console.log('Usage:', error.budgetCheck.usagePercent, '%');
    // Prompt user to upgrade or wait
  }
}
```

### 5. Rate Limiting (Token Bucket)

```typescript
// Rate limiting is automatic - 10 requests/second per user per model
// For burst traffic, use skipRateLimit:

const result = await client.generate({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Quick summary' }],
  userId: 'admin-user',
  skipRateLimit: true // Admin bypass
});
```

### 6. Retry Logic with Exponential Backoff

```typescript
const result = await client.generate({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: '...' }],
  userId: 'user-123',

  // Retry config
  maxRetries: 5, // Default: 3
  retryDelay: 2000 // Initial delay in ms (doubles each retry)
});
```

---

## Integration Examples

### Migrate Existing Code

**Before** (using `complete` from `client.ts`):
```typescript
import { complete } from '$lib/server/llm/client';

const result = await complete({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Generate resume' }],
  userId: 'user-123'
});
```

**After** (using `ObservableAIClient`):
```typescript
import { getObservableClient } from '$lib/server/llm/observable-client';
import { getLangfuse } from '$lib/server/llm/client';

const client = getObservableClient(getLangfuse());

const result = await client.generate({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Generate resume' }],
  userId: 'user-123',
  purpose: 'resume', // Enables proper caching + analytics
  enableCache: true // Now includes caching
});
```

### SvelteKit Server Action

```typescript
// src/routes/api/generate-resume/+server.ts
import { json } from '@sveltejs/kit';
import { getObservableClient } from '$lib/server/llm/observable-client';
import { getLangfuse } from '$lib/server/llm/client';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { jobId, resumeData } = await request.json();
  const userId = locals.session.user.id;

  const client = getObservableClient(getLangfuse());

  try {
    const result = await client.generate({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'system',
          content: 'You are a professional resume writer.'
        },
        {
          role: 'user',
          content: `Job: ${jobId}\nResume: ${JSON.stringify(resumeData)}\n\nGenerate tailored resume.`
        }
      ],
      userId,
      jobId,
      purpose: 'resume',
      enableCache: true,
      metadata: {
        source: 'web-ui',
        version: '1.0'
      }
    });

    return json({
      success: true,
      resume: result.content,
      cost: result.cost,
      cached: result.cached,
      traceId: result.traceId
    });
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return json(
        {
          success: false,
          error: 'Budget exceeded',
          remaining: error.budgetCheck.remainingCents
        },
        { status: 402 }
      );
    }
    throw error;
  }
};
```

### Inngest Background Job

```typescript
// src/lib/server/inngest/functions/resume-generation.ts
import { inngest } from '../client';
import { getObservableClient } from '$lib/server/llm/observable-client';
import { getLangfuse } from '$lib/server/llm/client';

export const generateResumeJob = inngest.createFunction(
  { id: 'generate-resume' },
  { event: 'resume/generate.requested' },
  async ({ event, step }) => {
    const client = getObservableClient(getLangfuse());

    // Step 1: Generate summary (fast, cheap)
    const summary = await step.run('generate-summary', async () => {
      return await client.generate({
        model: 'claude-3-haiku-20240307',
        messages: [
          { role: 'user', content: 'Summarize: ' + event.data.experience }
        ],
        userId: event.data.userId,
        purpose: 'summary',
        enableCache: true
      });
    });

    // Step 2: Generate full resume (high quality)
    const resume = await step.run('generate-resume', async () => {
      return await client.generate({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: `Summary: ${summary.content}\n\nGenerate full resume...`
          }
        ],
        userId: event.data.userId,
        jobId: event.data.jobId,
        purpose: 'resume',
        enableCache: true,
        traceId: event.data.traceId // Link to parent trace
      });
    });

    return {
      resume: resume.content,
      totalCost: summary.cost + resume.cost,
      cached: summary.cached || resume.cached
    };
  }
);
```

---

## Cache Management

### Prune Expired Entries

```typescript
const client = getObservableClient();

// Run periodically (e.g., cron job)
setInterval(() => {
  client.pruneCache();
  console.log('Cache pruned');
}, 60000); // Every minute
```

### Cache Statistics

```typescript
const stats = client.getCacheStats();
console.log('Cache size:', stats.size);
console.log('Total entries:', stats.totalEntries);
```

---

## Observability Best Practices

### 1. Always Provide Context

```typescript
const result = await client.generate({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '...' }],
  userId: 'user-123',

  // Rich context for observability
  purpose: 'cover_letter',
  jobId: 'job-456',
  metadata: {
    source: 'web-ui',
    version: '2.0',
    jobTitle: 'Senior Frontend Engineer',
    company: 'Tech Corp'
  }
});
```

### 2. Link Related Operations

```typescript
const langfuse = getLangfuse();
const trace = langfuse.trace({
  name: 'job-application-workflow',
  userId: 'user-123'
});

// All operations share the same trace
const summary = await client.generate({ traceId: trace.id, ... });
const resume = await client.generate({ traceId: trace.id, ... });
const coverLetter = await client.generate({ traceId: trace.id, ... });

// View full workflow in Langfuse
```

### 3. Monitor Quality Scores

```typescript
const result = await client.generate({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: '...' }],
  userId: 'user-123',
  enableQualityScore: true // Default
});

if (result.qualityScore && result.qualityScore < 60) {
  console.warn('Low quality output detected:', result.qualityScore);
  // Trigger alert or retry
}
```

---

## Architecture Diagrams

### Request Flow

```
User Request
    ↓
[Budget Check] ← Database (user_budgets)
    ↓
[Rate Limit] ← In-Memory (token bucket)
    ↓
[Input Sanitization]
    ↓
[Prompt Fetch?] ← Langfuse (if promptName provided)
    ↓
[Cache Check] ← In-Memory Cache
    ↓ (miss)
[LLM Call] → Cloudflare AI Gateway → Provider API
    ↓
[Usage Recording] → Database (token_usage)
    ↓
[Quality Scoring]
    ↓
[Cache Store] → In-Memory Cache
    ↓
[Response] → User
```

### Trace Structure (Langfuse)

```
Trace: observable-llm-generation
├── Span: llm-generation (parent)
│   ├── Span: budget-check
│   ├── Span: rate-limit-check
│   ├── Span: input-sanitization
│   ├── Span: fetch-prompt-langfuse (if applicable)
│   ├── Span: cache-check
│   ├── Span: llm-call-attempt-1
│   │   └── (success or retry)
│   ├── Span: record-usage
│   ├── Span: quality-scoring
│   └── Span: cache-store
```

---

## Performance Considerations

### Cache Hit Rates

With proper cache configuration, you can achieve:
- **Resume generation**: 40-60% hit rate (users regenerate with minor tweaks)
- **Job matching**: 70-80% hit rate (same job descriptions)
- **Summaries**: 50-70% hit rate

### Cost Savings

Example savings with caching:
- 1000 resume generations/day
- 50% cache hit rate
- Average cost: 3 cents/generation
- **Savings**: $15/day = $450/month

### Latency Improvements

- Cache hit: <5ms (in-memory lookup)
- Cache miss: 2-5s (LLM call)
- **Average latency reduction**: 60-70% with good hit rates

---

## Migration Checklist

- [ ] Install dependencies (already in package.json)
- [ ] Import `ObservableAIClient` instead of `complete`
- [ ] Add `purpose` field to all LLM calls
- [ ] Enable caching with `enableCache: true`
- [ ] Configure Langfuse (already done)
- [ ] Add periodic cache pruning (cron job)
- [ ] Monitor cache hit rates in Langfuse
- [ ] Set up alerts for budget exceeded errors
- [ ] Review quality scores in Langfuse dashboard

---

## Troubleshooting

### Budget Exceeded Errors

```typescript
// Handle gracefully
try {
  const result = await client.generate({ ... });
} catch (error) {
  if (error instanceof BudgetExceededError) {
    // Show upgrade prompt or wait message
    return { error: 'Please upgrade your plan or wait until next billing cycle' };
  }
}
```

### Rate Limit Errors

```typescript
// Implement exponential backoff in client
async function generateWithBackoff(options) {
  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      return await client.generate(options);
    } catch (error) {
      if (error.message.includes('Rate limit')) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}
```

### Cache Misses

If cache hit rate is lower than expected:
1. Check TTL settings (may be too short)
2. Verify cache key generation (temperature, model changes invalidate cache)
3. Monitor cache size (may be pruning too aggressively)

---

## Future Enhancements

Planned features:
- [ ] Redis/Valkey backend for distributed caching
- [ ] Advanced quality scoring with LLM-as-judge
- [ ] Semantic caching (embedding-based similarity)
- [ ] Cost prediction before LLM call
- [ ] A/B testing support (prompt variants)
- [ ] Automatic prompt optimization based on quality scores

---

## Sources & Research

This implementation is based on 2026 LLM observability best practices:

- [LLM Observability Tools: 2026 Comparison](https://lakefs.io/blog/llm-observability-tools/)
- [OpenTelemetry LLM Observability](https://opentelemetry.io/blog/2024/llm-observability/)
- [The complete guide to LLM observability for 2026](https://portkey.ai/blog/the-complete-guide-to-llm-observability/)
- [Vercel AI SDK 4.2 Middleware](https://vercel.com/blog/ai-sdk-4-2)
- [Langfuse Prompt Management](https://langfuse.com/docs/prompt-management/overview)
- [LLM Caching Strategies](https://latitude-blog.ghost.io/blog/ultimate-guide-to-llm-caching-for-low-latency-ai/)

---

## Support

For issues or questions:
- Review Langfuse traces for debugging
- Check database logs for usage recording errors
- Monitor cache statistics for performance issues
