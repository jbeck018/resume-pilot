# Onboarding Flow Implementation

## Overview

The onboarding flow is a 4-step wizard that collects essential information from new users before they can access the main dashboard.

## Features

### Step 1: Resume Upload
- File upload with drag-and-drop support
- Validation for PDF and DOCX files (max 5MB)
- Files are stored in Supabase Storage bucket `resumes`
- Resume records are created in the `resumes` table

### Step 2: Profile Links (Optional)
- LinkedIn profile URL
- GitHub profile URL
- Additional portfolio URLs (Dribbble, Behance, personal sites, etc.)
- All fields are optional but recommended for better job matching

### Step 3: Ideal Job Description (Required)
- Text area for users to describe their ideal job
- Minimum 50 characters required
- Example provided to guide users
- Should include: role, company size, industry, remote preference, salary, technologies

### Step 4: Confirmation
- Summary of completed steps
- Free tier benefits overview
- Complete onboarding and redirect to dashboard

## Database Changes

### Migration Files

1. **0002_add_onboarding_fields.sql**
   - Adds `onboarding_completed` boolean flag
   - Adds `ideal_job_description` text field
   - Adds `portfolio_urls` jsonb array

2. **0003_create_resume_storage.sql**
   - Creates Supabase Storage bucket for resumes
   - Sets up RLS policies for file access

3. **0004_add_usage_tracking.sql** (Note: May conflict with existing schema)
   - Adds usage tracking for free tier limits
   - Tracks job matches and resume generations per week
   - Includes helper functions for week calculations

### Updated Types

The `profiles` table Row/Insert/Update types now include:
- `onboarding_completed: boolean`
- `ideal_job_description: string | null`
- `portfolio_urls: string[]`

## Routes

### `/onboarding`

**Server Load Function** (`+page.server.ts`)
- Checks if user is authenticated
- Redirects to dashboard if onboarding already completed
- Prevents access to auth pages during onboarding

**Server Actions**:
1. `uploadResume` - Handles file upload to Supabase Storage
2. `updateProfiles` - Saves LinkedIn, GitHub, and portfolio URLs
3. `updateIdealJob` - Saves ideal job description
4. `complete` - Validates completion and marks onboarding as done

**Client Component** (`+page.svelte`)
- Multi-step wizard with progress indicator
- Form validation and error handling
- Responsive design with Tailwind CSS
- Uses existing shadcn-svelte components

## Authentication Flow Updates

### hooks.server.ts

Added onboarding check in `authGuard`:
- After authentication, checks if `onboarding_completed` is false
- Redirects authenticated users to `/onboarding` if not completed
- Redirects from auth pages to `/onboarding` instead of `/dashboard` for new users

## Components

### UsageIndicator.svelte

Location: `/src/lib/components/UsageIndicator.svelte`

Displays free tier usage limits:
- Job matches (5 per week)
- Resume generations (5 per week)
- Progress bars with color coding
- Weekly reset information
- Upgrade prompts when limits reached

## Dashboard Integration

The dashboard now includes:
- Usage indicator widget showing weekly limits
- Updated grid layout to accommodate usage widget
- Usage data fetched in `+page.server.ts` load function

## Free Tier Limits

Default limits for free tier:
- **5 job matches per week**
- **5 resume generations per week**

Limits reset every Monday at midnight.

## Testing Checklist

- [ ] New user signup redirects to onboarding
- [ ] Resume upload validates file type and size
- [ ] Step navigation works forward and backward
- [ ] Form validation shows appropriate errors
- [ ] Profile links are saved correctly
- [ ] Ideal job description requires 50+ characters
- [ ] Completion validates all required fields
- [ ] Successful completion redirects to dashboard
- [ ] Usage tracking initializes for new users
- [ ] Dashboard shows usage indicators correctly

## Future Enhancements

1. **Resume Parsing**
   - Extract structured data from uploaded resumes
   - Auto-populate profile fields with parsed data
   - Use LLM to extract skills, experience, education

2. **Profile Enrichment**
   - Fetch LinkedIn profile data (with OAuth)
   - Fetch GitHub repositories and activity
   - Auto-suggest skills based on resume content

3. **Progressive Disclosure**
   - Show optional steps based on user needs
   - Skip steps for users importing from LinkedIn
   - Smart defaults based on industry

4. **Onboarding Analytics**
   - Track completion rates per step
   - Identify drop-off points
   - A/B test different flows

## File Structure

```
/src/routes/onboarding/
  +page.svelte          # Multi-step wizard UI
  +page.server.ts       # Server actions and load

/src/lib/components/
  UsageIndicator.svelte # Free tier usage widget

/supabase/migrations/
  0002_add_onboarding_fields.sql
  0003_create_resume_storage.sql
  0004_add_usage_tracking.sql

/docs/
  ONBOARDING_IMPLEMENTATION.md  # This file
```

## Environment Variables

No new environment variables required. Uses existing:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

## Dependencies

All dependencies are already in the project:
- `@supabase/ssr` - For Supabase client
- `@supabase/supabase-js` - For storage operations
- `lucide-svelte` - For icons
- Existing shadcn-svelte components
