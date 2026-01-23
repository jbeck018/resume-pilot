# Observable AI Client - Architecture

## System Architecture

```mermaid
graph TB
    User[User Request] --> Client[ObservableAIClient]

    subgraph "Pre-Call Hooks"
        Client --> Budget[Budget Check]
        Budget --> DB1[(Database)]
        Budget --> RateLimit[Rate Limiter]
        RateLimit --> Sanitize[Input Sanitizer]
        Sanitize --> Prompt[Prompt Fetcher]
        Prompt --> Langfuse1[(Langfuse)]
        Prompt --> Cache[Cache Check]
        Cache --> Memory1[(In-Memory Cache)]
    end

    Cache -->|Miss| LLM[LLM Execution]
    Cache -->|Hit| Response

    subgraph "LLM Call"
        LLM --> Retry[Retry Logic]
        Retry --> Gateway[Cloudflare AI Gateway]
        Gateway --> Anthropic[Anthropic API]
        Gateway --> OpenAI[OpenAI API]
        Gateway --> Google[Google API]
    end

    LLM --> PostHooks

    subgraph "Post-Call Hooks"
        PostHooks --> Record[Usage Recorder]
        Record --> DB2[(Database)]
        PostHooks --> Quality[Quality Scorer]
        PostHooks --> CacheStore[Cache Store]
        CacheStore --> Memory2[(In-Memory Cache)]
    end

    PostHooks --> Response[Response]

    subgraph "Tracing"
        Client --> Trace[Langfuse Trace]
        Trace --> Span1[Budget Check Span]
        Trace --> Span2[Rate Limit Span]
        Trace --> Span3[Sanitize Span]
        Trace --> Span4[Prompt Fetch Span]
        Trace --> Span5[Cache Check Span]
        Trace --> Span6[LLM Call Span]
        Trace --> Span7[Record Usage Span]
        Trace --> Span8[Quality Score Span]
        Trace --> Span9[Cache Store Span]
    end

    Response --> User
```

## Request Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Client as ObservableAIClient
    participant Budget as Budget Checker
    participant DB as Database
    participant Cache as Cache Layer
    participant LLM as AI Provider
    participant Langfuse as Langfuse

    User->>Client: generate(options)
    Client->>Langfuse: Create trace

    Note over Client,Budget: Pre-Call Hooks
    Client->>Budget: checkBudget(userId)
    Budget->>DB: Query user_budgets
    DB-->>Budget: Budget info
    Budget-->>Client: Budget allowed

    Client->>Client: Rate limit check
    Client->>Client: Sanitize input

    Client->>Cache: Check cache
    Cache-->>Client: Cache miss

    Note over Client,LLM: LLM Execution
    Client->>LLM: generateText()
    LLM-->>Client: Response + usage

    Note over Client,DB: Post-Call Hooks
    Client->>DB: Record usage
    Client->>Client: Calculate quality score
    Client->>Cache: Store in cache

    Client->>Langfuse: End trace with metrics
    Client-->>User: ObservableResult
```

## Trace Structure

```mermaid
graph TB
    Trace[Trace: observable-llm-generation]
    Trace --> Parent[Span: llm-generation]

    Parent --> S1[Span: budget-check]
    Parent --> S2[Span: rate-limit-check]
    Parent --> S3[Span: input-sanitization]
    Parent --> S4[Span: fetch-prompt-langfuse]
    Parent --> S5[Span: cache-check]
    Parent --> S6[Span: llm-call-attempt-1]
    Parent --> S7[Span: record-usage]
    Parent --> S8[Span: quality-scoring]
    Parent --> S9[Span: cache-store]

    S6 --> Retry1[Attempt 1: Success]
    S6 -.->|If failed| Retry2[Attempt 2]
    Retry2 -.->|If failed| Retry3[Attempt 3]
```

## Cache Key Generation

```mermaid
graph LR
    Input[Input] --> Normalize[Normalize Messages]
    Normalize --> Combine[Combine with Params]
    Model[Model Name] --> Combine
    Temp[Temperature] --> Combine
    MaxTokens[Max Tokens] --> Combine
    Purpose[Purpose] --> Combine

    Combine --> Hash[SHA-256 Hash]
    Hash --> Key[Cache Key]

    Namespace[Namespace] --> Prefix[Add Prefix]
    Key --> Prefix
    Prefix --> Final[Final Cache Key]
```

## Rate Limiting (Token Bucket)

```mermaid
graph TB
    Request[New Request] --> Check{Tokens Available?}
    Check -->|Yes| Consume[Consume 1 Token]
    Check -->|No| Calculate[Calculate Wait Time]
    Calculate --> Error[Throw Rate Limit Error]

    Consume --> Refill[Refill Tokens Based on Time]
    Refill --> Process[Process Request]

    subgraph "Token Bucket State"
        Tokens[Current Tokens]
        Capacity[Capacity: 100]
        Rate[Refill Rate: 10/s]
        LastRefill[Last Refill Time]
    end
```

## Cost Calculation Flow

```mermaid
graph LR
    Usage[Token Usage] --> Input[Input Tokens]
    Usage --> Output[Output Tokens]

    Input --> Calc1[Input × Cost/1M]
    Output --> Calc2[Output × Cost/1M]

    Calc1 --> Sum[Sum Costs]
    Calc2 --> Sum

    Sum --> Round[Round Up to Cents]
    Round --> Cost[Final Cost]

    subgraph "Model Costs"
        Claude[Claude Sonnet: 300/1500]
        Haiku[Claude Haiku: 25/125]
        GPT4[GPT-4o: 250/1000]
        Mini[GPT-4o Mini: 15/60]
    end
```

## Data Flow

```mermaid
graph TB
    subgraph "Input Processing"
        I1[User Messages] --> I2[Sanitize]
        I2 --> I3[Normalize]
        I3 --> I4[Cache Key Gen]
    end

    subgraph "Cache Layer"
        C1[In-Memory Map]
        C2[TTL Check]
        C3[Entry Retrieval]
    end

    I4 --> C1
    C1 --> C2
    C2 -->|Valid| C3
    C2 -->|Expired| LLM
    C3 --> Response1[Cached Response]

    subgraph "LLM Layer"
        LLM[Provider Call]
        L1[Retry Logic]
        L2[Response]
    end

    C2 --> LLM
    LLM --> L1
    L1 --> L2

    subgraph "Storage Layer"
        S1[Database Write]
        S2[Cache Write]
        S3[Langfuse Write]
    end

    L2 --> S1
    L2 --> S2
    L2 --> S3
    L2 --> Response2[New Response]

    Response1 --> User[User]
    Response2 --> User
```

## Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| **ObservableAIClient** | Main orchestrator, coordinates hooks | `observable-client.ts` |
| **Budget Checker** | Validates user budget before calls | `budget.ts` |
| **Rate Limiter** | Token bucket algorithm, prevents abuse | `observable-client.ts` (in-memory) |
| **Input Sanitizer** | Trims whitespace, limits length | `observable-client.ts` |
| **Prompt Fetcher** | Retrieves versioned prompts from Langfuse | `observable-client.ts` + Langfuse |
| **Cache Layer** | In-memory cache with TTL, SHA-256 keys | `observable-client.ts` (Map) |
| **LLM Executor** | Calls AI SDK with retry logic | `observable-client.ts` + `client.ts` |
| **Usage Recorder** | Stores token usage in database | `budget.ts` |
| **Quality Scorer** | Heuristic-based quality assessment | `observable-client.ts` |
| **Tracer** | Creates hierarchical traces in Langfuse | `observable-client.ts` + Langfuse |

## Performance Metrics

```mermaid
graph TB
    subgraph "Latency Breakdown"
        Total[Total Latency: 2-5s]
        Budget[Budget Check: ~50ms]
        RateLimit[Rate Limit: <1ms]
        Sanitize[Sanitize: <1ms]
        Prompt[Prompt Fetch: <5ms]
        Cache[Cache Check: <5ms]
        LLM[LLM Call: 2-4s]
        Record[Record Usage: ~50ms]
        Quality[Quality Score: ~10ms]
        Store[Cache Store: <5ms]
    end

    Total --> Budget
    Total --> RateLimit
    Total --> Sanitize
    Total --> Prompt
    Total --> Cache
    Total --> LLM
    Total --> Record
    Total --> Quality
    Total --> Store
```

## Error Handling Flow

```mermaid
graph TB
    Request[Request] --> Try{Try Execute}

    Try -->|Success| PostHooks[Post-Call Hooks]
    Try -->|Budget Error| BudgetErr[BudgetExceededError]
    Try -->|Rate Limit Error| RateErr[Rate Limit Error]
    Try -->|LLM Error| Retry{Retry Available?}

    Retry -->|Yes| Wait[Exponential Backoff]
    Wait --> Try
    Retry -->|No| Fail[Throw Error]

    BudgetErr --> TraceErr[Record in Trace]
    RateErr --> TraceErr
    Fail --> TraceErr

    TraceErr --> Flush[Flush Langfuse]
    Flush --> UserErr[Return Error to User]

    PostHooks --> Success[Return Success]
```

## Cache Management

```mermaid
graph TB
    subgraph "Cache Operations"
        Generate[Generate Cache Key]
        Check[Check Existence]
        ValidateTTL[Validate TTL]
        Store[Store Entry]
        Prune[Prune Expired]
    end

    Generate --> Check
    Check -->|Exists| ValidateTTL
    Check -->|Not Exists| LLMCall[Call LLM]

    ValidateTTL -->|Valid| Hit[Cache Hit]
    ValidateTTL -->|Expired| Delete[Delete Entry]
    Delete --> LLMCall

    LLMCall --> Store

    Prune -->|Periodic| Scan[Scan All Entries]
    Scan --> DeleteExpired[Delete Expired]
```

## Quality Scoring Algorithm

```mermaid
graph LR
    Response[LLM Response] --> Baseline[Baseline: 50]

    Baseline --> Length{Length Check}
    Length -->|100-10k chars| L1[+20]
    Length -->|Otherwise| L2[+0]

    L1 --> Unique{Uniqueness}
    L2 --> Unique
    Unique -->|>50% unique| U1[+20]
    Unique -->|Otherwise| U2[+0]

    U1 --> Structure{Has Structure}
    U2 --> Structure
    Structure -->|Paragraphs| S1[+10]
    Structure -->|Otherwise| S2[+0]

    S1 --> Final[Final Score 0-100]
    S2 --> Final
```

## Integration Points

```mermaid
graph TB
    subgraph "External Systems"
        DB[(PostgreSQL)]
        Langfuse[(Langfuse Cloud)]
        Gateway[Cloudflare AI Gateway]
        Anthropic[Anthropic API]
        OpenAI[OpenAI API]
        Google[Google API]
    end

    subgraph "Application"
        Client[ObservableAIClient]
        Budget[Budget Module]
        Routes[SvelteKit Routes]
        Inngest[Inngest Jobs]
    end

    Client --> Budget
    Client --> Langfuse
    Client --> Gateway

    Gateway --> Anthropic
    Gateway --> OpenAI
    Gateway --> Google

    Budget --> DB

    Routes --> Client
    Inngest --> Client

    Client --> Langfuse
    Langfuse --> UI[Langfuse UI Dashboard]
```

---

## Key Design Decisions

### 1. **In-Memory Cache vs Redis**
- **Decision**: Start with in-memory Map
- **Rationale**: Simpler, zero dependencies, sufficient for single-instance deployments
- **Future**: Migrate to Redis/Valkey for distributed caching

### 2. **Token Bucket vs Sliding Window**
- **Decision**: Token bucket algorithm
- **Rationale**: Allows burst traffic, simpler implementation, fair distribution
- **Configuration**: 100 capacity, 10 tokens/second refill rate

### 3. **Heuristic vs LLM-as-Judge Quality Scoring**
- **Decision**: Start with heuristics
- **Rationale**: Fast (<10ms), no LLM cost, good baseline
- **Future**: Add LLM-as-judge for advanced scoring

### 4. **SHA-256 vs MD5 for Cache Keys**
- **Decision**: SHA-256
- **Rationale**: More secure, collision-resistant, industry standard
- **Trade-off**: Slightly slower (negligible in practice)

### 5. **Exponential Backoff Retry Strategy**
- **Decision**: Exponential backoff (1s, 2s, 4s)
- **Rationale**: Prevents thundering herd, respects rate limits
- **Configuration**: Max 3 retries by default

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Cache Hit Rate | >50% | TBD (depends on usage) |
| Cache Lookup Latency | <5ms | ~2ms (in-memory) |
| Budget Check Latency | <100ms | ~50ms (database query) |
| Rate Limit Check | <1ms | <1ms (in-memory) |
| Quality Scoring | <20ms | ~10ms (heuristics) |
| Total Overhead | <200ms | ~70ms (without LLM call) |
| Cache Size | <1GB | TBD (depends on usage) |

---

## Monitoring Dashboard (Langfuse)

### Key Metrics to Track

1. **Cost Metrics**
   - Total cost per user
   - Cost per model
   - Cost per purpose
   - Cache savings

2. **Performance Metrics**
   - Average latency
   - P95/P99 latency
   - Cache hit rate
   - LLM call rate

3. **Quality Metrics**
   - Average quality score
   - Quality score distribution
   - Quality by model
   - Quality by purpose

4. **Error Metrics**
   - Budget exceeded rate
   - Rate limit errors
   - LLM failures
   - Retry success rate

---

## Security Considerations

1. **Input Sanitization**: Prevent prompt injection attacks
2. **Budget Enforcement**: Hard limits to prevent abuse
3. **Rate Limiting**: Prevent DoS attacks
4. **Cache Key Hashing**: Deterministic but secure (SHA-256)
5. **Trace Data**: Sensitive data may appear in traces (PII concerns)

---

## Scalability Considerations

### Current Limits (In-Memory)
- Cache: Limited by Node.js heap (~1.4GB)
- Rate Limiting: Per-instance (not distributed)
- Trace Flushing: Non-blocking async

### Future Scaling (Redis/Distributed)
- Cache: Shared across instances
- Rate Limiting: Distributed token bucket
- Horizontal Scaling: Multiple instances share state
