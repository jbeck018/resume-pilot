# Job Scraping and ATS Integration Improvements

## Executive Summary

This document provides a comprehensive analysis of job API options, web scraping services, ATS integrations, and smart scraping features to improve HowlerHire's job discovery capabilities. The current implementation supports Adzuna, The Muse, Greenhouse, and Lever. This research identifies additional sources and optimization strategies.

---

## Current Implementation Analysis

### Existing Sources

| Source | Type | Auth Required | Features |
|--------|------|---------------|----------|
| **Adzuna** | Aggregator API | API Key | Salary data, location filtering, multiple countries |
| **The Muse** | Direct API | None | Category-based search, experience levels |
| **Greenhouse** | ATS API | None | Public job boards, company-specific |
| **Lever** | ATS API | None | Public job boards, company-specific |

### Current Limitations

1. **Limited Company Coverage**: Only 20 pre-defined companies for Greenhouse/Lever
2. **No Major Job Board Integration**: Missing Indeed, LinkedIn, Glassdoor
3. **Basic Deduplication**: No cross-source duplicate detection
4. **Simple Requirement Extraction**: Regex-based parsing only
5. **No Salary Normalization**: Currency and format handling varies

---

## 1. Additional Job APIs

### 1.1 Tier 1: Recommended (Free/Low-Cost with Good Access)

#### JSearch API (via RapidAPI)
- **Description**: Real-time job data from Google for Jobs aggregate
- **Coverage**: LinkedIn, Indeed, Glassdoor, and 100+ job sites
- **Pricing**:
  - Free tier: 100 requests/month
  - Basic: $50/month for 10,000 requests
  - Pro: $150/month for 50,000 requests
- **Rate Limits**: Varies by plan
- **Data Points**: 30+ fields per job including salary
- **Recommendation**: **HIGH PRIORITY** - Best value for comprehensive coverage

Sources: [JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch), [OpenWeb Ninja JSearch](https://www.openwebninja.com/api/jsearch)

#### Adzuna API (Current - Optimization)
- **Description**: Job aggregator with salary insights
- **Coverage**: 16 countries including US, UK, Australia
- **Pricing**: Free tier with generous limits
- **Rate Limits**: Negotiable for high-volume users
- **Recommendation**: **Keep and optimize** - Already integrated

Sources: [Adzuna Developer Portal](https://developer.adzuna.com/overview)

#### RemoteOK API
- **Description**: Remote-only job board API
- **Coverage**: 30,000+ remote jobs globally
- **Pricing**: Free public API
- **Rate Limits**: Reasonable for typical usage
- **Data Format**: JSON feed
- **Recommendation**: **HIGH PRIORITY** for remote job focus

Sources: [RemoteOK](https://remoteok.com/), [RemoteOK API](https://www.freepublicapis.com/remote-ok-jobs-api)

#### WeWorkRemotely API
- **Description**: Premium remote job board
- **Coverage**: Curated remote positions
- **Pricing**: Free for reads, partnership for posting
- **Rate Limits**: 1,000 requests/day authenticated
- **Auth**: Token-based (email wwr@weworkremotely.com for access)
- **Recommendation**: **MEDIUM PRIORITY** - Good supplement to RemoteOK

Sources: [WeWorkRemotely API](https://weworkremotely.com/api)

### 1.2 Tier 2: Aggregator APIs (Paid)

#### Indeed Publisher API
- **Status**: Currently suspended for new registrations (as of 2022)
- **Alternative**: Job Sync API available for ATS partners
- **Pricing**:
  - Job Sync API: Free for job posting
  - Sponsored Jobs API: $3 USD/call (Feb 2026)
- **Recommendation**: **NOT RECOMMENDED** - Limited access, expensive

Sources: [Indeed Partner Docs](https://docs.indeed.com/), [Sponsored Jobs API Policy](https://docs.indeed.com/sponsored-jobs-api/sponsored-jobs-api-usage-policy)

#### ZipRecruiter API
- **Description**: Partner-focused job distribution
- **Access**: Publisher account required
- **Features**: Job posting, search, webhooks
- **Integration**: HTTPS POST endpoint required
- **Recommendation**: **MEDIUM PRIORITY** - Good for two-way integration

Sources: [ZipRecruiter Documentation](https://www.ziprecruiter.com/partner/documentation/)

### 1.3 Tier 3: Restricted Access

#### LinkedIn Jobs API
- **Access**: Partner Program only (enterprise review process)
- **Pricing**: Custom enterprise agreements ($1000s/month minimum)
- **Products**:
  - Talent API (recruiting data)
  - Recruiter System Connect (ATS integration)
  - Apply Connect (easy apply)
- **Recommendation**: **NOT RECOMMENDED** for startups - Cost prohibitive

Sources: [LinkedIn Developer Portal](https://developer.linkedin.com/product-catalog), [LinkedIn API Pricing Guide](https://medium.com/@proxycurl/the-linkedin-api-pricing-guide-you-need-and-how-to-get-access-d2bf20242944)

#### Glassdoor API
- **Status**: Public API closed (2021)
- **Access**: Partner-only
- **Alternative**: Third-party scrapers available
- **Recommendation**: **Use third-party scraping** if needed

Sources: [Glassdoor API Status](https://zuplo.com/learning-center/what-is-glassdoor-api)

#### Wellfound (AngelList)
- **API**: No public API available
- **Integrations**: Works with Lever, Workable, Greenhouse
- **Recommendation**: **Access via ATS integrations**

Sources: [Wellfound on GetApp](https://www.getapp.com/hr-employee-management-software/a/angellist/)

---

## 2. Web Scraping Services

### 2.1 Apify Platform

#### Multi-Source Job Scrapers

| Actor | Cost | Success Rate | Features |
|-------|------|--------------|----------|
| **LinkedIn Jobs Scraper** | $0.001/job | High | No login required |
| **Indeed Scraper** | $0.73/1k jobs + $20/mo | 100% | Full descriptions |
| **Glassdoor Scraper** | $0.001/record | Good | Reviews + jobs |
| **Workday Scraper** | Varies | High | 140k+ company sites |
| **Combined Scraper** | Pay-per-job | Good | Indeed + LinkedIn + Glassdoor |

**Platform Pricing**:
- Free tier: $5/month in credits
- Starter: $49/month
- Scale: $499/month

**Recommendation**: **HIGH PRIORITY** - Best for sites without APIs

Sources: [Apify Indeed Scraper](https://apify.com/curious_coder/indeed-scraper), [Apify LinkedIn Jobs](https://apify.com/practicaltools/linkedin-jobs), [Apify Pricing](https://apify.com/pricing)

### 2.2 Bright Data

- **Jobs Scraper API**: $0.001/record starting price
- **Promotion**: 25% off for 6 months (code: APIS25)
- **Features**:
  - LinkedIn, Indeed, Glassdoor coverage
  - 150M+ residential IPs
  - Auto-retry and CAPTCHA bypass
- **Pricing Tiers**:
  - Pay-as-you-go: $1.50/1k records
  - Business ($999/mo): ~$0.84/1k records
  - Premium ($1999/mo): ~$0.79/1k records

**Recommendation**: **MEDIUM PRIORITY** - Enterprise-grade but expensive

Sources: [Bright Data Jobs Scraper](https://brightdata.com/products/web-scraper/jobs-scraper), [Bright Data Pricing](https://brightdata.com/pricing/web-scraper)

### 2.3 ScrapingDog

- **Pricing**: $40/month for 200k credits
- **Per-request cost**: Starting at $0.000196
- **Success Rate**: 100% on Indeed, Glassdoor
- **Response Time**: 14.47s average

**Recommendation**: **HIGH PRIORITY** - Best price/performance ratio

Sources: [ScrapingDog Comparison](https://www.scrapingdog.com/blog/scrapingbee-vs-scraperapi-vs-scrapingdog/)

### 2.4 ScrapingBee

- **Pricing**: Similar to ScrapingDog
- **Indeed Pricing**: $0.0147/request (Stealth Proxy)
- **Issues**: 0% success rate on Glassdoor in tests
- **Features**: JavaScript rendering, proxies

**Recommendation**: **LOW PRIORITY** - Inconsistent reliability

Sources: [ScrapingBee Pricing](https://www.scrapingbee.com/pricing/)

### 2.5 Oxylabs

- **Web Scraper API**: Starting at $49/month
- **Features**:
  - ML-driven proxy selection
  - Headless browser option
  - Automatic CAPTCHA bypass
- **Residential Proxies**: Pay-as-you-go available

**Recommendation**: **MEDIUM PRIORITY** - Good for complex scraping needs

Sources: [Oxylabs Pricing](https://oxylabs.io/pricing), [Oxylabs Web Scraper](https://oxylabs.io/products/scraper-api/web)

### 2.6 Self-Hosted Solutions (Puppeteer/Playwright)

#### Puppeteer
- **Maintainer**: Google
- **Browser Support**: Chromium only
- **Stealth Plugin**: puppeteer-extra-plugin-stealth

#### Playwright
- **Maintainer**: Microsoft
- **Browser Support**: Chromium, Firefox, WebKit
- **Better for**: Cross-browser testing

#### Stealth Considerations
- Use `puppeteer-extra-plugin-stealth`
- Rotate residential proxies
- Randomize fingerprints
- Avoid headless mode when possible

**Recommendation**: **For specific use cases** - Higher maintenance, lower cost

Sources: [Puppeteer Stealth](https://scrapingant.com/blog/avoid-detection-with-puppeteer-stealth), [Playwright vs Puppeteer](https://research.aimultiple.com/playwright-vs-puppeteer/)

---

## 3. ATS Direct Integrations

### 3.1 Workday

- **API**: No public API
- **Scraping Options**:
  - Apify Workday actors
  - Custom crawlers (GitHub available)
- **Data Available**: Job title, location, description, posting date
- **Coverage**: Thousands of companies use Workday

**Implementation Pattern**:
```typescript
// Workday URL pattern
const workdayUrl = `https://${company}.wd1.myworkdayjobs.com/en-US/${company}_careers`;
```

Sources: [Apify Workday Scraper](https://apify.com/gooyer.co/myworkdayjobs/api), [Workday Crawler GitHub](https://github.com/chuchro3/WebCrawler)

### 3.2 Oracle Taleo

- **Integration**: OVI (Oracle Validated Integration) program
- **Options**:
  - Job Feed API (since v14B)
  - Third-party scraping
- **Partners**: eQuest for job distribution
- **Note**: Being replaced by Oracle Fusion Cloud HCM

**Recommendation**: **LOW PRIORITY** - Legacy system, complex integration

Sources: [Taleo Configuration](https://docs.oracle.com/en/cloud/saas/talent-acquisition/17.6/tsscg/taleo-configuration.html), [Taleo Reviews](https://www.selecthub.com/p/recruiting-software/taleo/)

### 3.3 iCIMS

- **API**: REST API with OAuth 2.0
- **Rate Limits**: 10,000 calls/day per customer
- **Features**:
  - Job Portal API
  - Search API
  - Application webhooks
- **Access**: Developer community membership required

**Implementation Notes**:
- JSON request/response format
- Not optimized for real-time usage
- Best for batch synchronization

Sources: [iCIMS Developer Resources](https://developer-community.icims.com/), [iCIMS Job Portal API](https://developer.icims.com/REST-API/Object-Types-Commands/Job-Portal-API)

### 3.4 BambooHR

- **API**: REST API with Basic Auth or OAuth
- **Job Access**: Available but requires authorization
- **Features**:
  - Employee data management
  - Report generation
  - Job postings (via ATS component)

**Third-Party Options**: Merge.dev unified API for easier access

Sources: [BambooHR API Docs](https://documentation.bamboohr.com/docs/getting-started), [BambooHR Jobs API](https://fantastic.jobs/ats/bamboohr)

---

## 4. Smart Scraping Features

### 4.1 Deduplication Strategies

#### Hash-Based Deduplication
```typescript
interface JobHash {
  titleNormalized: string;  // lowercase, trimmed
  companyNormalized: string;
  locationNormalized: string;
}

function generateJobHash(job: JobResult): string {
  const normalized = {
    title: job.title.toLowerCase().trim(),
    company: job.company.toLowerCase().trim(),
    location: normalizeLocation(job.location)
  };
  return crypto.createHash('md5')
    .update(JSON.stringify(normalized))
    .digest('hex');
}
```

#### Similarity-Based Deduplication
- Use TF-IDF or embeddings for description similarity
- Threshold: 0.85+ similarity = likely duplicate
- Consider Levenshtein distance for titles

#### Time-Window Deduplication
- Track jobs within 10-minute windows
- Route duplicates to existing job entry
- Use Redis or in-memory cache for speed

Sources: [BullMQ Deduplication](https://docs.bullmq.io/guide/jobs/deduplication), [Holistics Job Deduplication](https://docs.holistics.io/docs/jobs/job-deduplication)

### 4.2 Job Freshness Detection

```typescript
interface FreshnessSignals {
  postedAt: Date;
  lastSeen: Date;
  sourceUpdatedAt?: Date;
  isRepost: boolean;
}

function calculateFreshness(job: JobResult): number {
  const hoursSincePosted = (Date.now() - new Date(job.postedAt).getTime()) / 3600000;

  // Decay function: fresher jobs score higher
  return Math.max(0, 1 - (hoursSincePosted / 720)); // 30-day window
}
```

**Detection Patterns**:
- Track job ID changes with similar content
- Monitor "updated_at" vs "created_at" fields
- Flag reposted positions (same job, new ID)

### 4.3 Salary Extraction and Normalization

#### Regex Patterns for Salary Extraction
```typescript
const salaryPatterns = [
  // "$100,000 - $150,000"
  /\$[\d,]+\s*[-–]\s*\$[\d,]+/gi,
  // "$100k-$150k"
  /\$\d+k\s*[-–]\s*\$\d+k/gi,
  // "100,000 USD"
  /[\d,]+\s*(USD|EUR|GBP|CAD|AUD)/gi,
  // "$50/hour"
  /\$\d+\s*\/?\s*(hour|hr|hourly)/gi,
  // "Salary: $100,000"
  /salary[:\s]+\$?[\d,k]+/gi,
];

function extractSalary(text: string): SalaryRange | null {
  // Implementation
}
```

#### Normalization Functions
```typescript
interface NormalizedSalary {
  min: number;
  max: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
  period: 'yearly' | 'monthly' | 'hourly';
  normalizedYearly: number;
}

function normalizeSalary(raw: string, currency: string): NormalizedSalary {
  // Convert hourly to yearly (2080 hours)
  // Convert monthly to yearly (x12)
  // Normalize all to USD using exchange rates
}
```

Sources: [Salary Predictor GitHub](https://github.com/bonniema/salary-predictor), [NLP Skill Extraction](https://www.kaggle.com/code/sanabdriss/nlp-extract-skills-from-job-descriptions)

### 4.4 Remote Work Detection

#### Keyword-Based (Simple)
```typescript
const remoteKeywords = [
  'remote', 'work from home', 'wfh', 'distributed',
  'anywhere', 'virtual', 'telecommute', 'remote-first'
];

const hybridKeywords = [
  'hybrid', 'flexible', 'partial remote', '2-3 days'
];

const onsiteKeywords = [
  'on-site', 'in-office', 'in office', 'must be local'
];
```

#### Context-Aware (Advanced)
- "Remote site" vs "Remote work" distinction
- BERT-based classification: 99% accuracy
- Model available at: https://wfhmap.com/

```typescript
type RemoteStatus = 'remote' | 'hybrid' | 'onsite' | 'unknown';

function classifyRemoteStatus(description: string, location: string): RemoteStatus {
  // Check explicit indicators first
  // Then use context analysis
  // Return with confidence score
}
```

Sources: [CEPR Remote Work Detection](https://cepr.org/voxeu/columns/using-job-postings-quantify-remote-work), [NLP Job Classification](https://medium.com/data-science-101/classifying-job-posts-via-nlp-3b2b49a33247)

### 4.5 Experience Level Parsing

#### Pattern Matching
```typescript
const experienceLevelPatterns = {
  entry: [
    /entry[\s-]?level/i,
    /0-2\s*years?/i,
    /no\s+experience\s+required/i,
    /recent\s+graduate/i,
    /junior/i
  ],
  mid: [
    /mid[\s-]?level/i,
    /3-5\s*years?/i,
    /some\s+experience/i,
    /associate/i
  ],
  senior: [
    /senior/i,
    /5\+?\s*years?/i,
    /7\+?\s*years?/i,
    /lead/i,
    /principal/i,
    /staff/i
  ],
  executive: [
    /director/i,
    /vp/i,
    /vice\s+president/i,
    /chief/i,
    /c-level/i,
    /10\+?\s*years?/i
  ]
};

function parseExperienceLevel(title: string, description: string): ExperienceLevel {
  // Check title first (highest confidence)
  // Then check description
  // Return with confidence score
}
```

#### Years of Experience Extraction
```typescript
const yearsPatterns = [
  /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
  /(\d+)-(\d+)\s*years?/gi,
  /minimum\s+(\d+)\s*years?/gi
];
```

Sources: [Job Level Classification Guide](https://www.deel.com/blog/job-level-classification/), [Penbrothers Guide](https://penbrothers.com/blog/entry-level-job-level-classification-guide/)

---

## 5. API Comparison Table

| Provider | Type | Free Tier | Paid Starting | Rate Limits | Best For |
|----------|------|-----------|---------------|-------------|----------|
| **JSearch** | Aggregator | 100/mo | $50/mo (10k) | Plan-based | Comprehensive coverage |
| **Adzuna** | Aggregator | Yes | Negotiable | Generous | International jobs |
| **RemoteOK** | Direct | Unlimited | Free | Reasonable | Remote-only jobs |
| **WeWorkRemotely** | Direct | Yes | Partnership | 1k/day | Premium remote |
| **Greenhouse** | ATS | Unlimited | Free | None | Tech companies |
| **Lever** | ATS | Unlimited | Free | None | Tech companies |
| **Apify** | Scraping | $5/mo | $49/mo | Credits | Complex scraping |
| **Bright Data** | Scraping | Trial | $999/mo | Pay-per-record | Enterprise scale |
| **ScrapingDog** | Scraping | 1k credits | $40/mo | Plan-based | Best value scraping |
| **iCIMS** | ATS | None | Enterprise | 10k/day | Direct ATS access |

---

## 6. Recommended Integration Roadmap

### Phase 1: Quick Wins (Week 1-2)
**Cost: ~$50-100/month**

1. **Add JSearch API**
   - Provides access to Indeed, LinkedIn, Glassdoor via Google for Jobs
   - Single integration covers multiple sources
   - Implementation: 2-3 days

2. **Add RemoteOK API**
   - Free API for remote jobs
   - Easy JSON integration
   - Implementation: 1 day

3. **Implement Deduplication**
   - Hash-based duplicate detection
   - Cross-source matching
   - Implementation: 1-2 days

### Phase 2: Enhanced Coverage (Week 3-4)
**Cost: ~$100-200/month**

1. **Add Apify Integration**
   - LinkedIn Jobs actor for detailed data
   - Workday scraper for enterprise companies
   - Implementation: 3-4 days

2. **Expand Greenhouse/Lever Lists**
   - Add 100+ companies to each list
   - Implement company discovery
   - Implementation: 2 days

3. **Implement Smart Parsing**
   - Salary extraction and normalization
   - Remote work classification
   - Experience level detection
   - Implementation: 3-4 days

### Phase 3: Advanced Features (Week 5-6)
**Cost: ~$200-500/month**

1. **ATS Direct Integrations**
   - iCIMS API for enterprise access
   - BambooHR via Merge.dev
   - Implementation: 5-7 days

2. **ML-Based Classification**
   - Train remote work classifier
   - Job similarity scoring
   - Implementation: 1 week

3. **Real-Time Monitoring**
   - Job freshness tracking
   - Repost detection
   - Alert system
   - Implementation: 3-4 days

---

## 7. Cost Estimates by Usage Tier

### Startup Tier (< 10,000 jobs/month)
| Service | Monthly Cost |
|---------|--------------|
| JSearch Basic | $50 |
| RemoteOK | Free |
| Greenhouse/Lever | Free |
| Apify Starter | $49 |
| **Total** | **~$99/month** |

### Growth Tier (10,000-50,000 jobs/month)
| Service | Monthly Cost |
|---------|--------------|
| JSearch Pro | $150 |
| RemoteOK | Free |
| Greenhouse/Lever | Free |
| Apify Scale | $199 |
| ScrapingDog | $90 |
| **Total** | **~$439/month** |

### Scale Tier (50,000+ jobs/month)
| Service | Monthly Cost |
|---------|--------------|
| JSearch Enterprise | Custom |
| Bright Data | $999+ |
| Apify Enterprise | $499+ |
| Direct ATS APIs | $500+ |
| **Total** | **~$2,500+/month** |

---

## 8. Technical Implementation Notes

### Architecture Recommendations

```
┌─────────────────────────────────────────────────────────┐
│                    Job Aggregator Service               │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   API Layer  │  │ Scraper Layer│  │   ATS Layer  │  │
│  │  (JSearch,   │  │  (Apify,     │  │  (Greenhouse,│  │
│  │   Adzuna,    │  │  ScrapingDog)│  │   Lever,     │  │
│  │   RemoteOK)  │  │              │  │   iCIMS)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
│         └────────────┬────┴────────────────┘          │
│                      ▼                                 │
│              ┌───────────────┐                         │
│              │ Normalizer &  │                         │
│              │ Deduplicator  │                         │
│              └───────┬───────┘                         │
│                      ▼                                 │
│              ┌───────────────┐                         │
│              │   Job Store   │                         │
│              │  (PostgreSQL) │                         │
│              └───────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

### Interface Extensions

```typescript
// Extended types for /src/lib/server/jobs/types.ts

export type JobSource =
  | 'adzuna' | 'muse' | 'greenhouse' | 'lever'
  | 'jsearch' | 'remoteok' | 'weworkremotely'
  | 'apify-linkedin' | 'apify-indeed' | 'apify-workday'
  | 'icims' | 'bamboohr';

export interface JobResult {
  // ... existing fields ...

  // New fields for smart features
  dedupeHash?: string;
  freshnessScore?: number;
  remoteClassification?: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  experienceLevelParsed?: 'entry' | 'mid' | 'senior' | 'executive';
  salaryNormalized?: {
    min: number;
    max: number;
    currency: string;
    period: 'yearly' | 'hourly';
  };
  firstSeenAt?: string;
  lastSeenAt?: string;
  isRepost?: boolean;
}

export interface JobSearchParams {
  // ... existing fields ...

  // New filter options
  remoteOnly?: boolean;
  experienceLevels?: ('entry' | 'mid' | 'senior' | 'executive')[];
  excludeCompanies?: string[];
  postedWithinDays?: number;
}
```

---

## 9. References

### Job APIs
- [JSearch API on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
- [Adzuna Developer Portal](https://developer.adzuna.com/overview)
- [RemoteOK](https://remoteok.com/)
- [WeWorkRemotely API](https://weworkremotely.com/api)
- [Indeed Partner Docs](https://docs.indeed.com/)
- [ZipRecruiter Partner Documentation](https://www.ziprecruiter.com/partner/documentation/)
- [LinkedIn Developer Portal](https://developer.linkedin.com/product-catalog)

### Scraping Services
- [Apify Platform](https://apify.com/pricing)
- [Bright Data Jobs Scraper](https://brightdata.com/products/web-scraper/jobs-scraper)
- [ScrapingDog](https://www.scrapingdog.com/)
- [ScrapingBee](https://www.scrapingbee.com/pricing/)
- [Oxylabs Web Scraper](https://oxylabs.io/products/scraper-api/web)

### ATS Platforms
- [iCIMS Developer Resources](https://developer-community.icims.com/)
- [BambooHR API Documentation](https://documentation.bamboohr.com/docs/getting-started)
- [Oracle Taleo Documentation](https://docs.oracle.com/en/cloud/saas/talent-acquisition/)

### Technical Resources
- [Puppeteer Stealth Plugin](https://scrapingant.com/blog/avoid-detection-with-puppeteer-stealth)
- [BullMQ Job Deduplication](https://docs.bullmq.io/guide/jobs/deduplication)
- [NLP Job Description Parsing](https://www.kaggle.com/code/sanabdriss/nlp-extract-skills-from-job-descriptions)
- [Remote Work Classification (WFH Map)](https://wfhmap.com/)
- [Job Level Classification Guide](https://www.deel.com/blog/job-level-classification/)

---

*Last updated: January 2026*
