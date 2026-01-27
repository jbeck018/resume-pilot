# HowlerHire

AI-powered job search and resume optimization application. Automatically finds matching jobs, generates tailored resumes and cover letters, and tracks your applications.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | SvelteKit + shadcn-svelte |
| **Database** | Supabase (PostgreSQL + pgvector + Auth + RLS) |
| **LLM Gateway** | LiteLLM (self-hosted, multi-provider) |
| **Workflows** | Inngest (durable execution) |
| **Job Sources** | Adzuna, The Muse, Greenhouse APIs |
| **Deployment** | Cloudflare Pages + Workers |

## Features

- **Daily Job Discovery**: Automatically finds 20 matching jobs per day
- **Smart Matching**: Keyword-based job matching with skill analysis (embedding support in schema)
- **Tailored Documents**: AI-generated resume and cover letter for each job
- **Application Tracking**: Mark jobs as applied, saved, or not relevant
- **Learning System**: Improves recommendations based on your feedback
- **Multi-provider LLM**: Switch between Claude, GPT, and Gemini as needed

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account (free tier works)
- LLM API keys (at least one of: Anthropic, OpenAI, Google)
- Inngest account (free tier: 50k executions/month)

### 1. Clone and Install

```bash
git clone <repo-url>
cd howlerhire
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run the migration:
   ```bash
   cat supabase/migrations/0001_initial_schema.sql
   ```
3. Enable the `vector` extension in Extensions settings
4. Copy your project URL and keys

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# LLM API Keys (at least one required)
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx

# Job APIs (optional, for broader search)
ADZUNA_APP_ID=xxx
ADZUNA_APP_KEY=xxx

# Inngest
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=xxx
```

### 4. Start Development

```bash
# Start the dev server
npm run dev

# In another terminal, start Inngest dev server
npm run inngest:dev
```

Open http://localhost:5173

### 5. (Optional) Run LiteLLM Proxy

For multi-provider LLM access with cost tracking:

```bash
# Start all services
docker-compose up -d

# Or just LiteLLM
docker run -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  ghcr.io/berriai/litellm:main-latest
```

Then set `LITELLM_PROXY_URL=http://localhost:4000` in your `.env`.

## Project Structure

```
howlerhire/
├── src/
│   ├── lib/
│   │   ├── components/ui/     # shadcn-svelte components
│   │   ├── server/
│   │   │   ├── database/      # Drizzle schema & types
│   │   │   ├── inngest/       # Durable workflows
│   │   │   ├── jobs/          # Job API integrations
│   │   │   └── llm/           # LLM client & generators
│   │   └── utils.ts
│   ├── routes/
│   │   ├── auth/              # Login, signup, OAuth
│   │   ├── dashboard/         # Main app UI
│   │   │   ├── jobs/          # Job listing & details
│   │   │   ├── profile/       # User profile
│   │   │   └── resumes/       # Resume management
│   │   └── api/               # API endpoints
│   └── app.css                # Tailwind styles
├── supabase/migrations/       # Database migrations
├── docker-compose.yml         # Local services
└── wrangler.toml              # Cloudflare config
```

## Workflows

### Daily Job Discovery (Cron: 6 AM UTC)

1. Fetch user profile and preferences
2. Search all job sources (Adzuna, Muse, Greenhouse)
3. Filter duplicates and rank by relevance
4. Save top 20 matches to database
5. Queue resume generation for each job

### Resume Generation

1. Load job details and user profile
2. Generate tailored resume via LLM
3. Generate cover letter via LLM
4. Save to database and notify user

## Deployment

### Cloudflare Pages

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npm run build
wrangler pages deploy .svelte-kit/cloudflare

# Set secrets
wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
wrangler pages secret put ANTHROPIC_API_KEY
# ... etc
```

### Environment Variables

Set these in Cloudflare dashboard > Pages > Settings > Environment variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (or other LLM keys)
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

## Cost Estimates

### Free Tier Usage

- **Supabase**: Free (500MB DB, 50K MAU)
- **Inngest**: Free (50K-100K executions/month)
- **Cloudflare**: Free (100K requests/day)
- **Job APIs**: Free (Adzuna, Muse, Greenhouse)

### LLM Costs (estimated per month)

- 20 jobs/day × 30 days = 600 jobs
- Resume + Cover letter per job ≈ $0.05-0.15
- **Total**: ~$30-90/month in LLM costs

## Adding More Job Sources

To add a new job API, create a new file in `src/lib/server/jobs/`:

```typescript
// src/lib/server/jobs/newapi.ts
import type { JobResult, JobSearchParams } from './types';

export async function searchNewApiJobs(params: JobSearchParams): Promise<JobResult[]> {
  // Implement search logic
  return [];
}
```

Then add it to the job discovery workflow in `src/lib/server/inngest/functions/job-discovery.ts`.

## TODO

- [x] Add Lever API integration (implemented in `src/lib/server/jobs/lever.ts`)
- [ ] Add Apify/Scrapingdog for broader coverage
- [ ] Implement embedding-based job matching (schema ready with pgvector)
- [x] Add resume upload and parsing (implemented via LLM extraction)
- [ ] Add email notifications
- [ ] Add analytics dashboard

## License

MIT
