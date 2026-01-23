# Component Usage Guide

## Quick Reference for New Components

### MatchScore Component

Display a circular match score with optional breakdown.

```svelte
<script>
  import { MatchScore } from '$lib/components';
</script>

<MatchScore
  score={85}
  breakdown={{
    skillsMatch: 90,
    experienceMatch: 85,
    educationMatch: 80
  }}
  showBreakdown={true}
  size="md"
/>
```

**Props**:
- `score` (number, required): Match percentage (0-100)
- `breakdown` (object, optional): Detailed score breakdown
  - `skillsMatch` (number): Skills match percentage
  - `experienceMatch` (number): Experience match percentage
  - `educationMatch` (number): Education match percentage
- `showBreakdown` (boolean, default: false): Show expandable breakdown
- `size` ('sm' | 'md' | 'lg', default: 'md'): Component size

**Color Coding**:
- Green: 70-100 (Good match)
- Orange: 50-69 (Moderate match)
- Red: 0-49 (Poor match)

---

### ATSScore Component

Display ATS compatibility score with keyword analysis.

```svelte
<script>
  import { ATSScore } from '$lib/components';
</script>

<ATSScore
  score={75}
  keywordsMatched={['JavaScript', 'React', 'TypeScript']}
  keywordsMissing={['GraphQL', 'Docker']}
  suggestions={[
    'Add more action verbs to your resume',
    'Include quantified achievements'
  ]}
  size="md"
/>
```

**Props**:
- `score` (number, required): ATS score (0-100)
- `keywordsMatched` (string[], default: []): Matched keywords
- `keywordsMissing` (string[], default: []): Missing keywords
- `suggestions` (string[], default: []): Improvement tips
- `size` ('sm' | 'md' | 'lg', default: 'md'): Component size

**Features**:
- Shows up to 10 keywords with "+X more" badge
- Color-coded keyword badges (green/red)
- Expandable suggestions list

---

### SkillsGap Component

Analyze and display skill alignment with job requirements.

```svelte
<script>
  import { SkillsGap } from '$lib/components';
</script>

<SkillsGap
  matchedSkills={['JavaScript', 'React', 'TypeScript']}
  missingRequired={['GraphQL', 'Docker']}
  missingPreferred={['Kubernetes', 'AWS']}
  showLearningResources={true}
/>
```

**Props**:
- `matchedSkills` (string[], default: []): Skills you have
- `missingRequired` (string[], default: []): Required skills missing
- `missingPreferred` (string[], default: []): Preferred skills missing
- `showLearningResources` (boolean, default: false): Show learning tips

**Visual Indicators**:
- Green checkmark: Matched skills
- Red X: Missing required skills
- Orange warning: Missing preferred skills

---

### UsageIndicator Component

Display subscription usage with progress bars for job matches and resume generations.

```svelte
<script>
  import { UsageIndicator } from '$lib/components';
</script>

<UsageIndicator
  usage={{
    job_matches_count: 3,
    job_matches_limit: 5,
    resume_generations_count: 2,
    resume_generations_limit: 5,
    week_start_date: '2024-01-15'
  }}
/>
```

**Props**:
- `usage` (UsageData | null, required): Usage statistics object
  - `job_matches_count` (number): Jobs matched this week
  - `job_matches_limit` (number): Weekly match limit
  - `resume_generations_count` (number): Resumes generated this week
  - `resume_generations_limit` (number): Weekly generation limit
  - `week_start_date` (string): Start of current tracking week

**Features**:
- Visual progress bars for each limit
- Color-coded indicators (green < 80%, orange 80-100%, red at limit)
- Shows remaining count for each resource
- Auto-calculates week end date
- Displays upgrade prompt when limits reached

---

### EmailTemplates Component

Generate and copy professional email templates for job applications.

```svelte
<script>
  import { EmailTemplates } from '$lib/components';
</script>

<EmailTemplates
  candidateName="John Doe"
  jobTitle="Senior Developer"
  companyName="TechCorp"
  recruiterName="Jane Smith"
  applicationDate={new Date('2024-01-10')}
/>
```

**Props**:
- `candidateName` (string, required): Your full name
- `jobTitle` (string, required): Position applied for
- `companyName` (string, required): Company name
- `recruiterName` (string, optional): Recruiter/hiring manager name
- `applicationDate` (Date, optional): When you applied

**Template Categories**:
1. **Application Stage**: Follow-up, Request Update, Withdraw
2. **Interview Stage**: Thank You (interview/phone screen), Follow-up
3. **Offer Stage**: Accept Offer, Decline Offer
4. **Networking**: Introduction, Referral Request

**Features**:
- One-click copy for subject line or body
- Open directly in email client (mailto:)
- Timing recommendations for when to send
- Pro tips for each template type
- Highlights [bracketed text] that needs personalization

---

## Application Tracking Dashboard

### Usage

Navigate to `/dashboard/applications` to access the tracking dashboard.

**Features**:
1. **List View**: Traditional list of applications with details
2. **Kanban View**: Board-style view grouped by status
3. **Search**: Filter by company name or job title
4. **Filter**: Filter by application status
5. **Stats**: Real-time statistics by status

### Status Options

Applications can have the following statuses:
- `saved`: Saved for later review
- `applied`: Application submitted
- `interview`: Interview scheduled
- `offer`: Offer received
- `rejected`: Application rejected
- `pending`: Awaiting review

### Updating Status

Use the job detail page to update application status:

```svelte
<form method="POST" action="?/markApplied">
  <input type="hidden" name="jobId" value={job.id} />
  <Button type="submit">Mark as Applied</Button>
</form>
```

**Available Actions**:
- `?/markSaved`
- `?/markApplied`
- `?/markInterview`
- `?/markOffer`
- `?/markRejected`
- `?/markNotRelevant`

---

## Database Schema

### New Fields in `jobs` Table

```sql
-- Application tracking
interview_date TIMESTAMPTZ
offer_date TIMESTAMPTZ
rejection_date TIMESTAMPTZ
notes TEXT

-- ATS scoring
ats_score INTEGER
keywords_matched JSONB
keywords_missing JSONB

-- Skills analysis
matched_skills JSONB
missing_required_skills JSONB
missing_preferred_skills JSONB

-- Match breakdown
match_score_breakdown JSONB
```

### Example Data Structure

```typescript
// match_score_breakdown
{
  skillsMatch: 85,
  experienceMatch: 75,
  educationMatch: 90
}

// keywords_matched
["JavaScript", "React", "TypeScript", "Node.js"]

// keywords_missing
["GraphQL", "Docker", "Kubernetes"]

// matched_skills
["JavaScript", "React", "TypeScript"]

// missing_required_skills
["GraphQL", "Docker"]

// missing_preferred_skills
["Kubernetes", "AWS", "CI/CD"]
```

---

## Integration Examples

### Job Detail Page

```svelte
<script>
  import { MatchScore, ATSScore, SkillsGap } from '$lib/components';

  let { data } = $props();

  const matchScoreBreakdown = {
    skillsMatch: 90,
    experienceMatch: 85,
    educationMatch: 80
  };
</script>

<div class="grid gap-6 md:grid-cols-3">
  <Card>
    <CardHeader>
      <CardTitle>Match Score</CardTitle>
    </CardHeader>
    <CardContent>
      <MatchScore
        score={data.job.match_score}
        breakdown={matchScoreBreakdown}
        showBreakdown={true}
      />
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>ATS Score</CardTitle>
    </CardHeader>
    <CardContent>
      <ATSScore
        score={data.job.ats_score}
        keywordsMatched={data.job.keywords_matched}
        keywordsMissing={data.job.keywords_missing}
      />
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>Skills Gap</CardTitle>
    </CardHeader>
    <CardContent>
      <SkillsGap
        matchedSkills={data.job.matched_skills}
        missingRequired={data.job.missing_required_skills}
        missingPreferred={data.job.missing_preferred_skills}
      />
    </CardContent>
  </Card>
</div>
```

### Dashboard Summary

```svelte
<div class="grid gap-4 md:grid-cols-4">
  <Card>
    <CardContent class="pt-6">
      <div class="text-center">
        <div class="text-2xl font-bold text-blue-600">
          {stats.applied}
        </div>
        <p class="text-xs text-muted-foreground">Applied</p>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardContent class="pt-6">
      <div class="text-center">
        <div class="text-2xl font-bold text-purple-600">
          {stats.interviews}
        </div>
        <p class="text-xs text-muted-foreground">Interviews</p>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardContent class="pt-6">
      <div class="text-center">
        <div class="text-2xl font-bold text-green-600">
          {stats.offers}
        </div>
        <p class="text-xs text-muted-foreground">Offers</p>
      </div>
    </CardContent>
  </Card>
</div>
```

---

## Styling Guidelines

### Color Palette

```css
/* Success / Good Match (70%+) */
text-green-600 bg-green-50 border-green-600

/* Warning / Moderate (50-70%) */
text-orange-600 bg-orange-50 border-orange-600

/* Error / Poor Match (<50%) */
text-red-600 bg-red-50 border-red-600

/* Info / Neutral */
text-blue-600 bg-blue-50 border-blue-600

/* Secondary / Muted */
text-muted-foreground bg-muted border-muted
```

### Typography

```css
/* Large scores */
text-4xl font-bold

/* Medium scores */
text-2xl font-bold

/* Small scores */
text-lg font-bold

/* Labels */
text-xs font-medium text-muted-foreground
```

---

## Performance Tips

1. **Lazy Load Components**: Only load components when needed
   ```svelte
   {#if showDetails}
     <MatchScore score={score} />
   {/if}
   ```

2. **Memoize Calculations**: Use $derived for expensive calculations
   ```svelte
   const matchPercentage = $derived(
     Math.round((matched / total) * 100)
   );
   ```

3. **Optimize Queries**: Use database indexes for date fields
   ```sql
   CREATE INDEX idx_jobs_interview_date
   ON jobs(interview_date)
   WHERE interview_date IS NOT NULL;
   ```

4. **Batch Updates**: Update multiple fields in single query
   ```typescript
   await supabase
     .from('jobs')
     .update({
       status: 'interview',
       interview_date: new Date().toISOString()
     })
     .eq('id', jobId);
   ```

---

## Accessibility Checklist

- ✅ Use semantic HTML (`<button>`, `<nav>`, etc.)
- ✅ Provide alt text for images
- ✅ Ensure color contrast ratios >4.5:1
- ✅ Support keyboard navigation (Tab, Enter, Escape)
- ✅ Add ARIA labels where needed
- ✅ Test with screen readers
- ✅ Provide focus indicators
- ✅ Use proper heading hierarchy

---

## Troubleshooting

### Component not rendering
- Check that props are passed correctly
- Verify TypeScript types match
- Ensure data is not null/undefined

### Styles not applying
- Check Tailwind CSS is configured
- Verify dark mode classes if using mode-watcher
- Check for conflicting CSS

### Database errors
- Run migrations: `supabase db push`
- Check column names match schema
- Verify user permissions

### Navigation not working
- Check route exists in `src/routes/`
- Verify server-side load function returns data
- Check authentication middleware
