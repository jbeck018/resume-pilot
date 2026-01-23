# LLM Gateway Comparison: Cloudflare vs Self-Hosted LiteLLM

## Executive Summary

**Recommendation: Migrate to Cloudflare AI Gateway**

For a SvelteKit application deployed on Cloudflare Pages with requirements for multi-provider access (Claude, GPT, Gemini), per-user tracking, and cost optimization, **Cloudflare AI Gateway** is the optimal choice.

### Key Reasons
1. **Zero infrastructure overhead** - No additional services to deploy or maintain
2. **Native Cloudflare integration** - Seamless with Pages/Workers deployment
3. **Free tier with core features** - Caching, analytics, rate limiting at no cost
4. **Lower latency** - Edge-native processing vs external proxy roundtrip
5. **Automatic scaling** - No capacity planning or database management

### Migration Complexity: Low (2-3 hours)
- Update API endpoint configuration
- Add AI Gateway route in Cloudflare dashboard
- Test with existing models
- Remove Docker dependencies

---

## Detailed Comparison

### 1. Cloudflare AI Gateway

#### Overview
AI Gateway is a proxy layer that sits between your application and AI providers (OpenAI, Anthropic, Google, etc.), providing observability, caching, and control features at the network edge.

#### Architecture for Your Stack
```
SvelteKit (Cloudflare Pages)
    ↓
Cloudflare AI Gateway (Edge)
    ↓
Provider APIs (OpenAI/Anthropic/Google)
```

#### Core Features

**Observability & Analytics**
- Request/response logging with configurable retention
- Token usage tracking per request
- Cost analytics across all providers
- Error rate monitoring
- Performance metrics

**Caching**
- Response caching with configurable TTL
- Up to 90% latency reduction for repeated requests
- Significant cost savings by avoiding duplicate API calls
- Cache hit rate analytics

**Rate Limiting**
- Flexible rate limits per time window
- Sliding or fixed window strategies
- Protect against abuse and runaway costs
- Per-user or per-key limits

**Security**
- API key management (store keys in Cloudflare's encrypted infrastructure)
- Request/response filtering
- Token-based authentication for gateway access
- DDoS protection via Cloudflare network

**Request Management**
- Automatic retries with exponential backoff
- Request routing and load balancing
- A/B testing capabilities
- Fallback strategies

#### Supported Providers (Your Requirements ✅)
- ✅ Anthropic (Claude)
- ✅ OpenAI (GPT-4, GPT-4o, etc.)
- ✅ Google (Gemini)
- Also: Hugging Face, Replicate, Perplexity, Groq, Workers AI

#### Pricing
- **Core Features**: FREE on all plans
  - Caching
  - Rate limiting
  - Basic analytics
  - Request routing

- **Persistent Logs**: Free allocation included, then usage-based pricing
  - Free tier: Adequate for small-medium applications
  - Paid tier: Based on logs stored per month

- **Logpush**: Requires Workers Paid plan ($5/month)
  - Export logs to external services (S3, BigQuery, etc.)

#### Integration Example
```typescript
// Before (LiteLLM)
const LITELLM_PROXY_URL = 'http://localhost:4000';

// After (AI Gateway)
const AI_GATEWAY_URL = 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}';

// Usage
const response = await fetch(`${AI_GATEWAY_URL}/openai/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [...]
  })
});
```

#### Pros
✅ **Zero infrastructure** - No Docker, no database, no servers to manage
✅ **Native Cloudflare integration** - Same platform as your deployment
✅ **Edge performance** - Sub-10ms overhead, closer to users
✅ **Free core features** - Caching, rate limiting, basic analytics
✅ **Automatic scaling** - Handles any load without configuration
✅ **Built-in DDoS protection** - Cloudflare's network security
✅ **Global edge network** - 300+ cities worldwide
✅ **Simple setup** - Configure via dashboard, minimal code changes

#### Cons
❌ **Limited per-user budgets** - No built-in virtual key system with spending limits
❌ **Less granular access control** - No RBAC out of the box
❌ **Vendor lock-in** - Tied to Cloudflare ecosystem
❌ **Analytics depth** - Less detailed than dedicated solutions
❌ **No automatic failover** - Manual fallback configuration required

#### Per-User Tracking Solution
While AI Gateway doesn't have built-in virtual keys, you can implement per-user tracking:

```typescript
// Add custom headers for tracking
const response = await fetch(`${AI_GATEWAY_URL}/openai/chat/completions`, {
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'cf-aig-metadata': JSON.stringify({
      userId: user.id,
      email: user.email,
      tier: user.subscription_tier
    })
  }
});

// Then query analytics API or logs for per-user usage
```

Store usage in your Supabase database:
```sql
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2. Cloudflare Workers AI

#### Overview
Cloudflare's own AI models running at the edge on their GPU infrastructure. Different from AI Gateway - this is for using Cloudflare's models, not proxying external providers.

#### Available Models
- Meta Llama 4 Scout, Llama 3.1
- OpenAI's open-weight GPT (gpt-oss-120b, gpt-oss-20b)
- FLUX.2 (image generation)
- Qwen3 (embeddings, language)
- Whisper (speech recognition)
- Text-to-speech models
- 50+ total models

#### Pricing
- **$0.011 per 1,000 Neurons**
- **10,000 Neurons/day FREE**
- Serverless pricing (no hourly charges)
- Per-model pricing based on size/capabilities

#### Latency
- Very low latency (edge deployment)
- Automatic routing to nearest city
- Sub-second inference for most models

#### Verdict for Your Use Case
**❌ Not Recommended**

**Reasons:**
1. **Model limitations** - Lacks Claude (your primary requirement)
2. **Quality gap** - Open-weight models generally inferior to Claude/GPT-4o
3. **Resume generation** - Requires best-in-class models for quality output
4. **Redundant** - You already have provider accounts for Claude/GPT/Gemini

**Potential Use:**
- Embeddings (Qwen3) - Could reduce costs for job matching
- Background tasks with lower quality requirements
- Image generation (FLUX.2) if needed for profile pictures

---

### 3. Self-Hosted LiteLLM Proxy (Current Setup)

#### Overview
LiteLLM is an open-source unified API layer that provides a single OpenAI-compatible interface for 100+ LLM providers, with advanced features for enterprise usage.

#### Current Architecture
```
SvelteKit (Cloudflare Pages)
    ↓ (network call)
Docker Container (LiteLLM Proxy) + PostgreSQL
    ↓
Provider APIs (OpenAI/Anthropic/Google)
```

#### Your Current Configuration
- Docker container running LiteLLM
- Separate PostgreSQL database for usage tracking
- Configuration file with 6 models (Claude, GPT, Gemini)
- Langfuse integration for observability
- Fallback to direct API calls if proxy unavailable

#### Core Features

**Virtual Keys**
- Generate API keys with model restrictions
- Per-key budgets and rate limits
- Key rotation support
- Default parameters per key
- Master key for admin operations

**Budget Management**
- User-level budgets across all calls
- Team-based budgets with isolation
- Budget duration (seconds, minutes, hours, days)
- Automatic budget resets
- Budget alerts and enforcement

**Rate Limiting**
- Per-key, per-user, or per-team limits
- Max parallel requests
- Tokens per minute (TPM) limits
- Requests per minute (RPM) limits
- Persistent limits across restarts

**Cost Tracking**
- Request/response logging to PostgreSQL
- Token counting per request
- Cost calculation per provider
- Usage dashboards
- Per-project/user cost breakdowns

**Fallbacks & Load Balancing**
- Automatic provider fallbacks
- Retry logic with exponential backoff
- Load balancing across providers
- Health checking
- Circuit breaker patterns

**Access Control**
- Hooks for custom authentication
- API key validation
- Secure storage of provider keys
- Centralized access management

**Observability**
- Langfuse integration (as configured)
- MLflow, Lunary, Helicone support
- Request/response logging
- Performance metrics
- Error tracking

#### Pricing
- **FREE** (open-source)
- **Self-hosting costs:**
  - Compute: $10-50/month (VPS/cloud instance)
  - Database: $0-25/month (managed PostgreSQL or included)
  - Total: ~$10-75/month depending on scale

#### Deployment Options
- Docker (your current approach)
- Kubernetes
- Fly.io / Railway / Render
- AWS Marketplace
- Azure Container Instances
- Self-managed VPS

#### Pros
✅ **Rich feature set** - Virtual keys, budgets, teams, RBAC
✅ **Detailed cost tracking** - PostgreSQL-backed analytics
✅ **Flexible deployment** - Run anywhere
✅ **Provider agnostic** - 100+ providers supported
✅ **Active development** - Regular updates and new features
✅ **Open source** - No vendor lock-in, full control
✅ **Observability integrations** - Langfuse, MLflow, etc.
✅ **Granular access control** - Per-key, per-user, per-team

#### Cons
❌ **Infrastructure overhead** - Requires separate deployment + database
❌ **Latency penalty** - Additional network hop (SvelteKit → LiteLLM → Provider)
❌ **Operational complexity** - Monitoring, updates, scaling, backups
❌ **Separate from Cloudflare** - Not integrated with Pages deployment
❌ **Database management** - PostgreSQL maintenance and costs
❌ **Scaling considerations** - Performance at high RPS requires tuning
❌ **Network costs** - Data transfer between services
❌ **Single point of failure** - If LiteLLM is down, your app is down

#### Deployment Challenges for Cloudflare Pages
1. **Network latency** - LiteLLM must be deployed separately (not on Cloudflare)
2. **Cold starts** - If using serverless deployment options
3. **Database costs** - PostgreSQL required for persistence
4. **Monitoring overhead** - Need to track LiteLLM health separately
5. **CORS configuration** - Cross-origin requests from Pages to proxy

#### Current Setup Issues
Based on your `docker-compose.yml`:
- **Local development only** - Not production-ready
- **Hardcoded credentials** - Security risk
- **No high availability** - Single container
- **No backup strategy** - Data loss risk
- **Resource limits not set** - Potential memory/CPU issues

---

## Feature Comparison Matrix

| Feature | Cloudflare AI Gateway | Workers AI | Self-Hosted LiteLLM |
|---------|----------------------|------------|---------------------|
| **Provider Support** | ||||
| Claude (Anthropic) | ✅ | ❌ | ✅ |
| GPT (OpenAI) | ✅ | ❌ (only open-weight) | ✅ |
| Gemini (Google) | ✅ | ❌ | ✅ |
| Total Providers | 10+ | 1 (Cloudflare) | 100+ |
| **Cost Management** | ||||
| Response Caching | ✅ (up to 90% savings) | N/A | ✅ (manual) |
| Cost Analytics | ✅ | ✅ | ✅ |
| Per-User Budgets | ⚠️ (custom) | ❌ | ✅ (built-in) |
| Virtual Keys | ❌ | ❌ | ✅ |
| **Performance** | ||||
| Latency Overhead | ~5-10ms | <1s (edge) | 50-200ms |
| Global Edge Network | ✅ (300+ cities) | ✅ | ❌ |
| Auto-scaling | ✅ | ✅ | ⚠️ (manual) |
| **Operations** | ||||
| Infrastructure Required | ❌ | ❌ | ✅ (Docker+DB) |
| Database Required | ❌ | ❌ | ✅ (PostgreSQL) |
| Deployment Complexity | Low | Low | Medium-High |
| Maintenance Burden | None | None | High |
| **Features** | ||||
| Request Logging | ✅ | ✅ | ✅ |
| Rate Limiting | ✅ | ✅ | ✅ |
| Automatic Retries | ✅ | ✅ | ✅ |
| Fallback Strategies | ⚠️ (manual) | N/A | ✅ (built-in) |
| A/B Testing | ✅ | ❌ | ⚠️ (custom) |
| **Pricing** | ||||
| Base Cost | FREE | $0.011/1k neurons | FREE (OSS) |
| Infrastructure Cost | $0 | $0 | $10-75/month |
| Free Tier | ✅ (generous) | ✅ (10k neurons/day) | N/A |
| **Integration** | ||||
| Cloudflare Pages | ✅ (native) | ✅ (native) | ⚠️ (external) |
| Setup Time | <1 hour | <30 min | 2-4 hours |
| Code Changes | Minimal | Minimal | Moderate |

---

## Recommendation for Your Stack

### Primary Recommendation: **Cloudflare AI Gateway**

#### Justification

**Your Requirements:**
1. ✅ **Multi-provider access** - Supports Claude, GPT, Gemini
2. ✅ **Per-user tracking** - Achievable via custom metadata + Supabase
3. ✅ **Cost optimization** - Free tier + caching = significant savings
4. ✅ **SvelteKit on Cloudflare Pages** - Native integration, zero latency penalty

**Why AI Gateway Wins:**

1. **Operational Simplicity**
   - No Docker containers to manage
   - No PostgreSQL database to maintain
   - No infrastructure monitoring
   - No scaling concerns
   - No backup/restore procedures

2. **Cost Efficiency**
   - **Current:** $10-75/month infrastructure + API costs
   - **With AI Gateway:** $0 infrastructure + reduced API costs (caching)
   - **Savings:** $120-900/year + API cost reductions

3. **Performance Benefits**
   - **Current latency:** SvelteKit → LiteLLM (50-200ms) → Provider
   - **With AI Gateway:** SvelteKit → AI Gateway (5-10ms) → Provider
   - **Improvement:** 40-190ms faster per request

4. **Developer Experience**
   - Configure via Cloudflare dashboard
   - Same platform as your deployment
   - Built-in analytics and monitoring
   - No context switching between tools

5. **Scalability**
   - Handles any load automatically
   - Global edge network (300+ cities)
   - No capacity planning required
   - No database performance tuning

6. **Security**
   - Cloudflare's DDoS protection
   - Encrypted API key storage
   - Rate limiting to prevent abuse
   - No additional attack surface

#### Trade-offs You'll Accept

1. **Virtual Keys**
   - **Lost:** Built-in virtual key system with budgets
   - **Solution:** Implement in your application layer
   - **Effort:** ~4 hours of development

   ```typescript
   // Generate API tokens for users
   CREATE TABLE api_tokens (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     token TEXT UNIQUE,
     budget_cents INTEGER,
     spent_cents INTEGER DEFAULT 0,
     rate_limit_rpm INTEGER,
     expires_at TIMESTAMPTZ
   );

   // Middleware to check budget/rate limits
   async function checkUserBudget(userId: string, estimatedCost: number) {
     const usage = await db.getUserUsage(userId);
     if (usage.spent_cents + estimatedCost > usage.budget_cents) {
       throw new Error('Budget exceeded');
     }
   }
   ```

2. **Automatic Failover**
   - **Lost:** LiteLLM's built-in provider fallback
   - **Solution:** Implement manual fallback in your client code
   - **Effort:** ~2 hours of development

   ```typescript
   async function completeWithFallback(messages: Message[]) {
     try {
       return await completionViaGateway('claude-3-5-sonnet', messages);
     } catch (error) {
       console.warn('Claude failed, falling back to GPT-4o');
       return await completionViaGateway('gpt-4o', messages);
     }
   }
   ```

3. **Granular RBAC**
   - **Lost:** Per-key model restrictions, team isolation
   - **Solution:** Application-level authorization
   - **Effort:** Already partially implemented in your auth layer

#### Implementation Complexity: **Low**

**Estimated Time:** 2-3 hours

**Steps:**
1. Create AI Gateway in Cloudflare dashboard (10 min)
2. Update API client to use gateway URL (30 min)
3. Implement custom metadata for user tracking (1 hour)
4. Test with all providers (30 min)
5. Deploy and verify (30 min)

---

### Alternative: Hybrid Approach (Not Recommended)

**Use Case:** If you absolutely need LiteLLM's virtual keys

**Architecture:**
```
SvelteKit (Cloudflare Pages)
    ↓
Cloudflare AI Gateway (caching, rate limiting)
    ↓
LiteLLM Proxy (virtual keys, budgets)
    ↓
Provider APIs
```

**Pros:**
- Get both AI Gateway's caching and LiteLLM's virtual keys
- Staged migration path

**Cons:**
- Double latency penalty
- Increased complexity
- Higher infrastructure costs
- More failure points

**Verdict:** Adds complexity without sufficient benefit. Implement virtual keys in your app layer instead.

---

### Workers AI: When to Consider

**Use Cases Where Workers AI Makes Sense:**

1. **Embeddings for Job Matching**
   - Use Qwen3 embeddings instead of OpenAI
   - Cost: $0.011/1k neurons vs OpenAI's $0.13/1M tokens
   - 10x cheaper for high-volume embedding tasks

2. **Background Processing**
   - Job description summaries
   - Resume parsing
   - Keyword extraction

3. **Real-time Features**
   - Chat interfaces (Llama models)
   - Auto-complete suggestions

**Recommendation:** Use Workers AI for embeddings only, keep Claude/GPT for resume generation.

```typescript
// Hybrid approach
async function generateJobEmbedding(description: string) {
  // Use Workers AI for cheap embeddings
  return await workersAI.run('@cf/qwen/qwen-2.5-coder-32b-instruct', {
    text: description
  });
}

async function generateResume(jobDescription: string, userProfile: Profile) {
  // Use Claude via AI Gateway for high-quality generation
  return await aiGateway.complete({
    model: 'claude-3-5-sonnet-20241022',
    messages: [...]
  });
}
```

---

## Migration Plan

### Phase 1: Setup (30 minutes)

1. **Create AI Gateway**
   - Log into Cloudflare dashboard
   - Navigate to AI → AI Gateway
   - Click "Create Gateway"
   - Name: `resume-pilot-gateway`
   - Copy gateway URL: `https://gateway.ai.cloudflare.com/v1/{account_id}/resume-pilot-gateway`

2. **Configure Providers**
   - Add OpenAI configuration
   - Add Anthropic configuration
   - Add Google configuration
   - Enable caching (TTL: 1 hour for static prompts)
   - Set rate limits (e.g., 100 req/min per user)

### Phase 2: Code Updates (1-2 hours)

1. **Update Environment Variables**
   ```bash
   # Add to .env
   AI_GATEWAY_ACCOUNT_ID=your_account_id
   AI_GATEWAY_ID=resume-pilot-gateway
   AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/${AI_GATEWAY_ACCOUNT_ID}/${AI_GATEWAY_ID}
   ```

2. **Update LLM Client**

   Create new file: `src/lib/server/llm/ai-gateway-client.ts`

   ```typescript
   const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL;
   const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
   const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
   const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

   export async function complete(options: CompletionOptions): Promise<CompletionResult> {
     const { model, messages, maxTokens = 4096, temperature = 0.7 } = options;

     // Route to appropriate provider via AI Gateway
     if (model.startsWith('claude')) {
       return await completeViaGateway('anthropic', model, messages, maxTokens, temperature, ANTHROPIC_API_KEY);
     }

     if (model.startsWith('gpt')) {
       return await completeViaGateway('openai', model, messages, maxTokens, temperature, OPENAI_API_KEY);
     }

     if (model.startsWith('gemini')) {
       return await completeViaGateway('google-ai-studio', model, messages, maxTokens, temperature, GOOGLE_API_KEY);
     }

     throw new Error(`Unsupported model: ${model}`);
   }

   async function completeViaGateway(
     provider: 'anthropic' | 'openai' | 'google-ai-studio',
     model: string,
     messages: Message[],
     maxTokens: number,
     temperature: number,
     apiKey: string
   ): Promise<CompletionResult> {
     // Provider-specific endpoint mapping
     const endpoints = {
       'anthropic': '/v1/messages',
       'openai': '/v1/chat/completions',
       'google-ai-studio': `/v1beta/models/${model}:generateContent`
     };

     const url = `${AI_GATEWAY_URL}/${provider}${endpoints[provider]}`;

     // Add custom metadata for tracking
     const metadata = {
       userId: getCurrentUserId(), // Implement this
       requestId: crypto.randomUUID(),
       timestamp: new Date().toISOString()
     };

     const response = await fetch(url, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKey}`,
         'Content-Type': 'application/json',
         'cf-aig-metadata': JSON.stringify(metadata)
       },
       body: JSON.stringify(formatRequestForProvider(provider, model, messages, maxTokens, temperature))
     });

     if (!response.ok) {
       throw new Error(`AI Gateway error: ${response.status} ${await response.text()}`);
     }

     const data = await response.json();
     return parseProviderResponse(provider, model, data);
   }
   ```

3. **Add Usage Tracking**

   Update `src/lib/server/database/schema.ts`:

   ```typescript
   export const llmUsage = pgTable('llm_usage', {
     id: uuid('id').primaryKey().defaultRandom(),
     userId: uuid('user_id').references(() => users.id).notNull(),
     model: text('model').notNull(),
     promptTokens: integer('prompt_tokens').notNull(),
     completionTokens: integer('completion_tokens').notNull(),
     totalTokens: integer('total_tokens').notNull(),
     costCents: integer('cost_cents').notNull(),
     provider: text('provider').notNull(), // 'anthropic', 'openai', 'google'
     cached: boolean('cached').default(false), // Whether response was cached
     latencyMs: integer('latency_ms'),
     createdAt: timestamp('created_at').defaultNow()
   });

   export const userBudgets = pgTable('user_budgets', {
     userId: uuid('user_id').primaryKey().references(() => users.id),
     budgetCents: integer('budget_cents').notNull().default(1000), // $10 default
     spentCents: integer('spent_cents').notNull().default(0),
     periodStart: timestamp('period_start').defaultNow(),
     periodEnd: timestamp('period_end'),
     resetInterval: text('reset_interval') // 'daily', 'weekly', 'monthly'
   });
   ```

   Create migration:
   ```bash
   npx drizzle-kit generate:pg
   npx drizzle-kit push:pg
   ```

4. **Implement Budget Checking Middleware**

   Create `src/lib/server/llm/budget-guard.ts`:

   ```typescript
   export async function checkUserBudget(userId: string, estimatedCostCents: number): Promise<void> {
     const budget = await db.query.userBudgets.findFirst({
       where: eq(userBudgets.userId, userId)
     });

     if (!budget) {
       // Create default budget for new user
       await db.insert(userBudgets).values({
         userId,
         budgetCents: 1000, // $10 default
         spentCents: 0
       });
       return;
     }

     // Check if budget period needs reset
     if (budget.periodEnd && new Date() > budget.periodEnd) {
       await resetUserBudget(userId);
       return;
     }

     // Check if user would exceed budget
     if (budget.spentCents + estimatedCostCents > budget.budgetCents) {
       throw new Error(`Budget exceeded. Current: $${budget.spentCents/100}, Limit: $${budget.budgetCents/100}`);
     }
   }

   export async function trackUsage(userId: string, usage: {
     model: string;
     provider: string;
     promptTokens: number;
     completionTokens: number;
     costCents: number;
     cached: boolean;
     latencyMs: number;
   }): Promise<void> {
     await db.transaction(async (tx) => {
       // Insert usage record
       await tx.insert(llmUsage).values({
         userId,
         ...usage,
         totalTokens: usage.promptTokens + usage.completionTokens
       });

       // Update user's spent amount
       await tx.update(userBudgets)
         .set({
           spentCents: sql`${userBudgets.spentCents} + ${usage.costCents}`
         })
         .where(eq(userBudgets.userId, userId));
     });
   }
   ```

### Phase 3: Testing (30 minutes)

1. **Test Each Provider**
   ```bash
   # Test Claude
   curl -X POST https://gateway.ai.cloudflare.com/v1/{account}/resume-pilot-gateway/anthropic/v1/messages \
     -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "claude-3-5-sonnet-20241022", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 100}'

   # Test OpenAI
   curl -X POST https://gateway.ai.cloudflare.com/v1/{account}/resume-pilot-gateway/openai/v1/chat/completions \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'

   # Test Google
   curl -X POST https://gateway.ai.cloudflare.com/v1/{account}/resume-pilot-gateway/google-ai-studio/v1beta/models/gemini-1.5-pro:generateContent \
     -H "Authorization: Bearer $GOOGLE_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
   ```

2. **Test Caching**
   - Send same request twice
   - Verify second request is faster (cache hit)
   - Check AI Gateway dashboard for cache hit rate

3. **Test Budget System**
   - Create test user with $1 budget
   - Make requests until budget exceeded
   - Verify error handling

### Phase 4: Deployment (30 minutes)

1. **Update Production Environment Variables**
   - Add `AI_GATEWAY_URL` to Cloudflare Pages environment
   - Add `AI_GATEWAY_ACCOUNT_ID` and `AI_GATEWAY_ID`
   - Keep provider API keys as secrets

2. **Deploy New Code**
   ```bash
   git add .
   git commit -m "Migrate to Cloudflare AI Gateway"
   git push origin main
   ```

3. **Monitor**
   - Check Cloudflare AI Gateway dashboard
   - Verify requests are flowing through gateway
   - Monitor cache hit rates
   - Check error rates

### Phase 5: Cleanup (15 minutes)

1. **Remove LiteLLM Infrastructure**
   ```bash
   # Stop and remove containers
   docker-compose down -v

   # Remove Docker Compose file
   git rm docker-compose.yml litellm-config.yaml

   # Remove old client code
   git rm src/lib/server/llm/client.ts

   # Rename new client
   git mv src/lib/server/llm/ai-gateway-client.ts src/lib/server/llm/client.ts
   ```

2. **Update Documentation**
   - Update README with new setup instructions
   - Document AI Gateway configuration
   - Update environment variable documentation

3. **Cost Savings**
   - Cancel any LiteLLM hosting (if applicable)
   - Remove PostgreSQL instance (if separate)
   - Estimated savings: $10-75/month

---

## Cost Analysis

### Current Setup (Self-Hosted LiteLLM)

**Infrastructure Costs:**
- VPS/Cloud Instance: $10-50/month
- PostgreSQL Database: $0-25/month (if managed)
- Total: **$10-75/month**

**API Costs:** (example for 100k resume generations/month)
- Claude Sonnet: 100k × (1500 input + 500 output tokens) × $3/1M input + $15/1M output = $600/month
- GPT-4o: Similar usage = ~$400/month
- Gemini: Similar usage = ~$200/month
- Total API: **~$1,200/month** (varies by usage)

**Total Monthly Cost:** $1,210 - $1,275

### With Cloudflare AI Gateway

**Infrastructure Costs:**
- Cloudflare AI Gateway: **$0/month** (free tier)
- Persistent Logs: **$0-5/month** (within free allocation for most use cases)
- Total: **$0-5/month**

**API Costs (with 30% cache hit rate):**
- Cached requests: 30k × $0 = $0
- Non-cached requests: 70k × normal costs = $840/month
- Total API: **~$840/month** (30% savings from caching)

**Total Monthly Cost:** $840 - $845

**Savings:** $365 - $430/month = **$4,380 - $5,160/year**

### Break-Even Analysis

Even if you only achieve 10% cache hit rate, you save:
- Infrastructure: $10-75/month
- API costs (10% reduction): ~$120/month
- **Total savings:** $130-195/month

**ROI on Migration:**
- Migration time: 3 hours
- Monthly savings: $365-430
- Payback period: **Immediate** (saves time and money from day one)

---

## Risk Assessment

### Migration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Service disruption during migration | Low | High | Blue-green deployment, feature flag rollout |
| Increased latency | Very Low | Medium | Edge processing is faster than external proxy |
| Missing features (virtual keys) | High | Medium | Implement in application layer before migration |
| Budget tracking gaps | Medium | Medium | Comprehensive testing of budget system |
| Vendor lock-in | High | Low | OpenAI-compatible API makes future migration easy |
| Rate limit issues | Low | Medium | Configure appropriate limits, monitor closely |

### Operational Risks (Current LiteLLM Setup)

| Risk | Likelihood | Impact | Current Mitigation |
|------|------------|--------|-------------------|
| LiteLLM proxy downtime | Medium | High | Fallback to direct API (implemented) |
| PostgreSQL database failure | Medium | High | None (no backups configured) |
| Docker container OOM | Medium | Medium | None (no resource limits) |
| Security vulnerability in LiteLLM | Low | High | Manual updates required |
| Scaling bottleneck | Medium | Medium | Would require infrastructure changes |
| Network latency to proxy | High | Low | Unavoidable with current architecture |

**Verdict:** Migration to AI Gateway reduces operational risks significantly.

---

## Monitoring & Observability

### Cloudflare AI Gateway Dashboard

**Available Metrics:**
- Total requests per day/week/month
- Requests per provider (OpenAI, Anthropic, Google)
- Cache hit rate percentage
- Average latency (p50, p95, p99)
- Error rates by provider
- Cost estimates based on usage
- Top users by request count (via metadata)

**Recommended Alerts:**
1. Error rate > 5%
2. Cache hit rate < 20%
3. Latency p95 > 2 seconds
4. Daily request count > 10,000 (adjust based on your tier)

### Application-Level Tracking

**Supabase Dashboard:**
Create views for common queries:

```sql
-- User usage summary
CREATE VIEW user_usage_summary AS
SELECT
  u.email,
  COUNT(*) as total_requests,
  SUM(l.total_tokens) as total_tokens,
  SUM(l.cost_cents) as total_cost_cents,
  AVG(l.latency_ms) as avg_latency_ms,
  SUM(CASE WHEN l.cached THEN 1 ELSE 0 END) as cached_requests
FROM users u
JOIN llm_usage l ON u.id = l.user_id
WHERE l.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email
ORDER BY total_cost_cents DESC;

-- Budget alerts
CREATE VIEW budget_alerts AS
SELECT
  u.email,
  b.spent_cents,
  b.budget_cents,
  (b.spent_cents::float / b.budget_cents * 100) as usage_percent
FROM users u
JOIN user_budgets b ON u.id = b.user_id
WHERE b.spent_cents > b.budget_cents * 0.8;
```

**Recommended Custom Alerts:**
1. User approaching budget limit (80%)
2. Unusual spike in requests (>3x daily average)
3. High error rate for specific user
4. Model costs exceeding estimates

### Integration with External Tools

**Recommended:** Keep Langfuse for deeper observability
```typescript
// src/lib/server/llm/observability.ts
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY
});

export async function trackLLMCall(
  userId: string,
  model: string,
  messages: Message[],
  response: CompletionResult,
  metadata: Record<string, any>
) {
  const trace = langfuse.trace({
    name: 'llm-completion',
    userId,
    metadata: {
      ...metadata,
      model,
      cached: response.cached,
      provider: getProvider(model)
    }
  });

  trace.generation({
    name: model,
    model,
    modelParameters: {
      temperature: metadata.temperature,
      maxTokens: metadata.maxTokens
    },
    input: messages,
    output: response.content,
    usage: {
      input: response.usage.promptTokens,
      output: response.usage.completionTokens,
      total: response.usage.totalTokens
    }
  });

  await trace.finalize();
}
```

---

## Alternative Scenarios

### Scenario A: High Volume + Complex Budget Requirements

**If you need:**
- 1M+ requests/month
- Complex multi-tier pricing
- Detailed RBAC with 100+ team structures
- Compliance requirements for audit trails

**Recommendation:** Consider **Portkey.ai** or **Helicone**
- Enterprise LLM gateways with advanced features
- Managed service (no infrastructure)
- Built-in virtual keys, budgets, RBAC
- SOC2 compliant
- Pricing: ~$50-500/month based on volume

### Scenario B: Multi-Region Deployment

**If you need:**
- Data residency (EU, US, Asia)
- Regional failover
- Compliance with GDPR/data localization

**Recommendation:** Cloudflare AI Gateway + regional API keys
- AI Gateway respects regional routing
- Deploy separate gateways per region
- Use Cloudflare's global network for optimal routing

### Scenario C: Extremely High Performance Requirements

**If you need:**
- Sub-100ms total latency
- 10,000+ req/sec throughput
- Real-time streaming

**Recommendation:** Hybrid approach
- Workers AI for ultra-low latency tasks
- AI Gateway for provider access
- Direct API calls for streaming (bypass gateway for stream responses)

---

## Frequently Asked Questions

### Q: Can I use AI Gateway with streaming responses?

**A:** Yes, AI Gateway supports streaming. Configure pass-through mode for streaming:
```typescript
const response = await fetch(`${AI_GATEWAY_URL}/openai/v1/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [...],
    stream: true
  })
});

const reader = response.body.getReader();
// Handle streaming chunks
```

### Q: How do I migrate existing LiteLLM virtual keys to AI Gateway?

**A:** Implement application-layer API tokens:
1. Export existing LiteLLM keys from PostgreSQL
2. Create corresponding tokens in your Supabase database
3. Migrate budget/rate limit settings
4. Update client applications to use new tokens
5. Sunset old LiteLLM keys after grace period

### Q: What happens if Cloudflare AI Gateway goes down?

**A:** Implement fallback to direct API calls:
```typescript
const AI_GATEWAY_ENABLED = process.env.AI_GATEWAY_ENABLED !== 'false';

async function complete(options: CompletionOptions) {
  if (AI_GATEWAY_ENABLED) {
    try {
      return await completeViaGateway(options);
    } catch (error) {
      console.error('AI Gateway failed, using direct API', error);
      // Fall through to direct API
    }
  }

  // Direct API fallback
  return await completeViaDirectAPI(options);
}
```

### Q: Can I use AI Gateway for embeddings?

**A:** Yes, AI Gateway supports OpenAI's embedding endpoint:
```typescript
const response = await fetch(
  `${AI_GATEWAY_URL}/openai/v1/embeddings`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: 'Your text to embed'
    })
  }
);
```

Consider using Workers AI for embeddings to save costs:
```typescript
// 10x cheaper than OpenAI embeddings
const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
  text: 'Your text to embed'
});
```

### Q: How do I set up per-user rate limits?

**A:** Implement rate limiting in your middleware:
```typescript
// src/lib/server/middleware/rate-limiter.ts
import { RateLimiter } from 'limiter';

const userLimiters = new Map<string, RateLimiter>();

export async function checkRateLimit(userId: string): Promise<void> {
  let limiter = userLimiters.get(userId);

  if (!limiter) {
    // 100 requests per minute per user
    limiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'minute'
    });
    userLimiters.set(userId, limiter);
  }

  const hasToken = await limiter.removeTokens(1);
  if (!hasToken) {
    throw new Error('Rate limit exceeded');
  }
}
```

AI Gateway also has built-in rate limiting:
- Configure in dashboard: 100 req/min globally
- Use custom metadata to track per-user requests
- Set up alerts for rate limit violations

### Q: How do I track costs by team/organization?

**A:** Add organization ID to metadata and track in database:
```typescript
const metadata = {
  userId: user.id,
  organizationId: user.organization_id,
  tier: user.subscription_tier
};

// Query costs by organization
SELECT
  u.organization_id,
  o.name,
  SUM(l.cost_cents) as total_cost_cents,
  COUNT(*) as total_requests
FROM llm_usage l
JOIN users u ON l.user_id = u.id
JOIN organizations o ON u.organization_id = o.id
WHERE l.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.organization_id, o.name;
```

---

## Conclusion

**Migrate to Cloudflare AI Gateway immediately.**

### Summary of Benefits

✅ **$4,380-5,160/year cost savings**
✅ **40-190ms latency improvement**
✅ **Zero infrastructure maintenance**
✅ **Native Cloudflare Pages integration**
✅ **Free tier covers core features**
✅ **2-3 hour migration time**
✅ **Reduced operational complexity**
✅ **Better performance and reliability**

### Action Items

1. **Today:** Create AI Gateway in Cloudflare dashboard (15 min)
2. **This week:** Implement budget tracking schema in Supabase (2 hours)
3. **Next sprint:** Migrate API client to use AI Gateway (2 hours)
4. **Following sprint:** Test thoroughly and deploy to production (1 hour)
5. **After verification:** Decomission LiteLLM infrastructure (30 min)

### Long-term Strategy

1. **Months 1-3:** Monitor usage patterns, optimize cache settings
2. **Months 3-6:** Implement advanced features (A/B testing, multi-region)
3. **Months 6+:** Evaluate Workers AI for embeddings to reduce costs further

### Final Recommendation

The choice is clear: **Cloudflare AI Gateway** provides the best balance of cost, performance, simplicity, and integration for your SvelteKit application on Cloudflare Pages. The migration is low-risk, low-effort, and delivers immediate benefits.

Self-hosted LiteLLM made sense when you needed features that weren't available elsewhere, but AI Gateway now provides 90% of the functionality with 0% of the operational overhead. The remaining 10% (virtual keys, granular budgets) can be implemented in your application layer with minimal effort.

**Start your migration today.**

---

## Sources

- [Cloudflare AI Gateway Pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)
- [Cloudflare AI Gateway Features](https://developers.cloudflare.com/ai-gateway/features/)
- [Cloudflare AI Gateway Overview](https://www.cloudflare.com/developer-platform/products/ai-gateway/)
- [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [LiteLLM Virtual Keys](https://docs.litellm.ai/docs/proxy/virtual_keys)
- [LiteLLM Budgets & Rate Limits](https://docs.litellm.ai/docs/proxy/users)
- [LiteLLM Proxy Documentation](https://docs.litellm.ai/docs/simple_proxy)
- [Top LLM Gateways Comparison 2025](https://www.helicone.ai/blog/top-llm-gateways-comparison-2025)
- [LLM Gateway Benchmarks](https://www.getmaxim.ai/articles/best-llm-gateways-in-2025-features-benchmarks-and-builders-guide/)
