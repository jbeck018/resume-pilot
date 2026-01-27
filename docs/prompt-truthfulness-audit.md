# Prompt Truthfulness Audit Report

**Date:** January 2026
**Auditor:** AI Research Agent
**Scope:** All LLM prompts in HowlerHire that generate user-facing resume and cover letter content

---

## Executive Summary

This audit evaluates the truthfulness safeguards in HowlerHire's AI prompts to ensure generated resumes and cover letters are based solely on real user information, never fabricated. While the codebase includes some anti-fabrication language, there are significant gaps that could lead to hallucinated content appearing in user documents.

### Overall Risk Assessment: **MEDIUM-HIGH**

| Category | Current State | Risk Level |
|----------|---------------|------------|
| Resume Generation | Partial safeguards | MEDIUM |
| Cover Letter Generation | Weak safeguards | HIGH |
| Profile Enhancement | Minimal safeguards | HIGH |
| Profile Summary | No safeguards | CRITICAL |

---

## 1. File-by-File Analysis

### 1.1 resume-generator.ts

**Location:** `/src/lib/server/llm/resume-generator.ts`

#### Current Safeguards

```typescript
// Lines 56-58
1. NEVER fabricate experience or skills - only highlight and reframe existing qualifications
...
6. Maintain the candidate's authentic voice and background
```

#### Positive Findings
- Contains explicit "NEVER fabricate" instruction (line 57)
- References "existing qualifications" only
- Includes "maintain authenticity" guidance

#### Hallucination Risks

1. **Quantification Pressure (Line 59):** "Quantify achievements where possible" could encourage fabricated metrics when none exist in user data
2. **Cover Letter System Prompt (Lines 270-279):** No anti-fabrication instructions at all
3. **Profile Summary Generation (Lines 367-379):** No instructions against fabrication; only asks to "write a concise, impactful professional summary" without grounding constraints
4. **Vague User Prompt Language (Line 148):** "Highlight the most relevant experience" could be interpreted as embellishment

#### Missing Guardrails
- No instruction to flag missing data
- No verification step for claims
- No fallback language requirements
- Cover letter prompt lacks anti-fabrication rules entirely

---

### 1.2 seed-prompts.ts (Langfuse Prompts)

**Location:** `/src/lib/server/llm/prompts/seed-prompts.ts`

#### Current Safeguards

**Resume Generation Prompt (Lines 36-42):**
```
CRITICAL RULES:
1. NEVER fabricate experience, skills, or achievements
2. Only highlight and reframe EXISTING qualifications
```

**Cover Letter Prompt (Lines 108-109):**
```
CRITICAL RULES:
1. NEVER fabricate experience or achievements
```

**Resume Improvement Prompt (Lines 73-74):**
```
- Do not add fabricated information
```

#### Positive Findings
- "CRITICAL RULES" section with explicit anti-fabrication language
- Multiple prompts include the guideline

#### Hallucination Risks

1. **Quality Scoring Prompt (Lines 291-337):** References "original_skills" and "original_experience" but doesn't instruct the scorer to verify content authenticity
2. **Content Generation Prompt (Lines 383-410):** Generic prompt with weak constraint: "Is accurate and doesn't fabricate information" - buried in list, not emphasized
3. **Cover Letter Prompt (Line 114):** "Include specific examples from the candidate's background" - doesn't specify these MUST come from provided data only

#### Missing Guardrails
- No instruction for what to do when data is insufficient
- No requirement to cite source data for claims
- No verification checkpoint prompts

---

### 1.3 resume-agent.ts

**Location:** `/src/lib/server/agents/agents/resume-agent.ts`

#### Current Safeguards

**Fallback Prompt (Lines 145-157):**
```
CRITICAL RULES:
1. NEVER fabricate experience, skills, or achievements
2. Only highlight and reframe EXISTING qualifications
```

#### Positive Findings
- Contains the critical anti-fabrication rules in fallback prompt
- Quality check step validates ATS score and basic sections
- Validation checks for candidate name presence

#### Hallucination Risks

1. **Gap Addressing Instruction (Line 226):** "Addresses identified gaps through strategic framing" - this could encourage creative fabrication to fill gaps
2. **Improvement Prompt (Lines 249-257):** No anti-fabrication constraint when applying suggestions
3. **Company Research Injection (Lines 174-180):** Research data could be inaccurate, then reflected in resume

#### Missing Guardrails
- No validation that skills in output match profile skills
- No verification that experience claims trace to input data
- `improveResume()` method lacks anti-fabrication instructions

---

### 1.4 cover-letter-agent.ts

**Location:** `/src/lib/server/agents/agents/cover-letter-agent.ts`

#### Current Safeguards

**Fallback Prompt (Line 137):**
```
7. Never fabricate achievements or experience
```

#### Positive Findings
- Contains anti-fabrication rule in fallback prompt
- References "specific achievements relevant to this role" from profile
- Quality scoring validates output

#### Hallucination Risks

1. **Weak Positioning (Line 137):** Anti-fabrication rule is #7 in the list, not emphasized as critical
2. **Company Research Defaults (Lines 157-160):** When research is missing, provides defaults like "Innovation, Excellence" and "Collaborative, Growth-oriented" - these become fabricated claims about unknown companies
3. **Summary Fallback (Line 169):** Default "Experienced professional seeking new opportunities" is generic fabrication when summary is missing
4. **"Top Achievements" Language (Line 173):** Asks for achievements from keyHighlights, but doesn't verify these are real

#### Missing Guardrails
- No instruction to acknowledge when company research is unavailable
- No constraint on making claims about company culture without verified data
- Temperature 0.7-0.8 for tone settings encourages creativity over accuracy

---

### 1.5 profile-agent.ts

**Location:** `/src/lib/server/agents/agents/profile-agent.ts`

#### Current Safeguards

**None found.** This file contains no anti-fabrication instructions.

#### Hallucination Risks

1. **Enhanced Summary Generation (Lines 109-125):** Prompt says to "Lead with years of experience" but doesn't verify the user actually has that experience
2. **Experience Enhancement (Lines 215-231):** "Add quantifiable metrics where possible" without any source data - this directly encourages hallucination
3. **Headline Suggestions (Lines 145-158):** Generic generation with no grounding constraints
4. **All Generation Functions:** Use moderate-high temperatures (0.5-0.8) encouraging creative output

#### Critical Issue
The `generateExperienceEnhancements()` method (lines 202-258) explicitly asks to "Add quantifiable metrics where possible" when enhancing descriptions. This is the highest-risk prompt in the codebase as it directly invites fabrication of statistics.

---

## 2. Risk Matrix

| Prompt/Function | Fabrication Risk | Impact | Priority |
|-----------------|------------------|--------|----------|
| `generateExperienceEnhancements()` | CRITICAL | User submits fake metrics | P0 |
| `generateProfileSummary()` | HIGH | Misleading qualifications | P0 |
| `generateCoverLetter()` company research fallbacks | HIGH | False company claims | P1 |
| `improveResume()` | MEDIUM | Unverified improvements | P1 |
| `generateEnhancedSummary()` | MEDIUM | Exaggerated experience | P1 |
| `generateHeadlineSuggestions()` | LOW | Minor embellishment | P2 |

---

## 3. Recommended Prompt Improvements

### 3.1 Universal Anti-Fabrication Header

Add this to ALL content-generating prompts:

```
## TRUTHFULNESS REQUIREMENTS (MANDATORY - NEVER VIOLATE)

1. NEVER invent, fabricate, or assume any information not explicitly provided
2. ONLY use facts, skills, achievements, and experiences from the provided user data
3. If data is missing or insufficient, use hedged language ("Based on your background...", "Drawing from your experience...")
4. NEVER fabricate:
   - Specific metrics, percentages, or numbers
   - Company names, job titles, or dates not in the profile
   - Skills or technologies not listed
   - Achievements or accomplishments not described
   - Awards, certifications, or education not provided
5. When quantification is requested but no data exists, describe impact qualitatively instead
6. Flag any section where provided information is insufficient rather than filling gaps with assumptions
```

---

### 3.2 Improved Resume Generation System Prompt

**Replace the system prompt in `resume-generator.ts` (lines 49-69):**

```typescript
function buildStyledSystemPrompt(style: ResumeStyle): string {
  const styleInstructions = buildStylePrompt(style);

  return `You are an expert resume writer who creates highly targeted, ${style.atsOptimized ? 'ATS-optimized ' : ''}resumes.

${styleInstructions}

## TRUTHFULNESS REQUIREMENTS (MANDATORY - THESE OVERRIDE ALL OTHER INSTRUCTIONS)

You MUST follow these rules without exception:

1. **ABSOLUTE PROHIBITION ON FABRICATION**
   - NEVER invent experience, skills, achievements, metrics, or any facts not provided in the candidate profile
   - NEVER add percentages, dollar amounts, team sizes, or other numbers unless explicitly stated in the source data
   - NEVER assume or infer skills, technologies, or accomplishments not listed

2. **SOURCE ATTRIBUTION**
   - Every claim in the resume MUST be traceable to the provided profile data
   - If the profile says "managed a team," do NOT change this to "managed a team of 15"
   - If no metrics exist, describe impact qualitatively: "significantly improved" rather than "improved by 40%"

3. **HANDLING MISSING DATA**
   - If a section lacks sufficient information, keep it brief and factual
   - Use hedging language when appropriate: "Experienced in..." rather than specific claims
   - Do NOT fill gaps with plausible-sounding but unverified information

4. **WHAT YOU CAN DO**
   - Reorder and prioritize existing information for relevance
   - Rephrase descriptions using stronger action verbs (while preserving factual accuracy)
   - Highlight skills from the profile that match job requirements
   - Improve formatting and structure
   - Use keywords from the job description where they accurately reflect the candidate's background

## OUTPUT GUIDELINES

- Output the resume in clean markdown format
- Use proper heading hierarchy (# for name, ## for sections)
- Use bullet points for experience items
- Keep formatting simple for ATS compatibility
- Maximum ${style.layout.maxPages} page(s)
`;
}
```

---

### 3.3 Improved Cover Letter System Prompt

**Replace the cover letter prompt in `resume-generator.ts` (lines 270-279):**

```typescript
const systemPrompt = `You are an expert cover letter writer who creates compelling, personalized cover letters.

## TRUTHFULNESS REQUIREMENTS (MANDATORY)

1. NEVER fabricate achievements, experiences, or skills not provided in the candidate profile
2. ONLY reference accomplishments that appear in the provided experience data
3. If company research is unavailable, express genuine interest without making specific claims about company culture or values
4. Use phrases like "I'm drawn to [Company]'s work in [industry]" rather than fabricating specific knowledge
5. When highlighting achievements, use ONLY those explicitly described in the profile

## STYLE GUIDELINES

1. Conversational yet professional tone
2. Specific to the company and role - but only using verified information
3. Highlight 2-3 key relevant achievements FROM THE PROVIDED PROFILE
4. Show genuine interest without fabricating specific company knowledge
5. Keep to 3-4 paragraphs (about 300 words)
6. Avoid clich├®s and generic phrases

## WHEN DATA IS LIMITED

- If the candidate profile lacks specific achievements, focus on skills and experience areas
- If company information is unavailable, express interest in the role and industry generally
- Use language like "Based on my background in..." rather than making specific unverified claims

Output a clean cover letter ready to send.`;
```

---

### 3.4 Improved Profile Summary Prompt

**Replace the prompt in `resume-generator.ts` (lines 367-379):**

```typescript
const prompt = `Based on the following professional profile, write a 2-3 sentence professional summary.

## TRUTHFULNESS REQUIREMENTS

- ONLY use information explicitly provided below
- Do NOT invent years of experience, specific achievements, or skills not listed
- If information is limited, keep the summary appropriately brief
- Use hedging language when generalizing: "Experienced professional" rather than specific unverified claims

## PROVIDED PROFILE DATA

Experience:
${experience
  .slice(0, 3)
  .map((e) => `- ${e.title} at ${e.company}${e.description ? `: ${e.description.slice(0, 100)}` : ''}`)
  .join('\n')}

Skills: ${skills.slice(0, 10).join(', ')}

Education: ${education.map((e) => `${e.degree} from ${e.institution}`).join(', ')}

## INSTRUCTIONS

Write a concise, impactful professional summary that:
1. Accurately reflects ONLY the provided experience and skills
2. Does NOT add specific metrics, years, or achievements not in the data
3. Uses strong language while remaining truthful to the source material

Write only the summary text.`;
```

---

### 3.5 Improved Experience Enhancement Prompt (CRITICAL)

**Replace the prompt in `profile-agent.ts` (lines 215-231):**

```typescript
const prompt = `Improve the clarity and impact of this job description while maintaining COMPLETE ACCURACY.

## CRITICAL: TRUTHFULNESS REQUIREMENTS

- You may ONLY rephrase and restructure the provided information
- Do NOT add metrics, numbers, percentages, or statistics not in the original
- Do NOT invent team sizes, revenue figures, or performance improvements
- Do NOT assume technologies, methodologies, or processes not mentioned
- If no quantifiable results exist, describe impact qualitatively

## WHAT YOU CAN DO

- Use stronger action verbs (e.g., "handled" -> "managed", "helped" -> "contributed to")
- Restructure sentences for clarity
- Highlight implicit skills that are directly evident from the description
- Improve readability and flow

## ORIGINAL DESCRIPTION
Role: ${exp.title} at ${exp.company}
Description: ${exp.description.slice(0, 300)}

${targetRoles?.length ? `Context: Candidate is targeting ${targetRoles.join(', ')} roles` : ''}

## OUTPUT FORMAT

Return JSON:
{
  "enhanced": "improved description using ONLY information from the original",
  "reason": "brief explanation of improvements made (must not include any fabricated data)",
  "preservedAccuracy": true
}

IMPORTANT: If the original lacks detail, your enhanced version should also be appropriately brief. Do NOT pad with fabricated information.`;
```

---

### 3.6 Cover Letter Agent - Fix Company Research Fallbacks

**Replace lines 153-162 in `cover-letter-agent.ts`:**

```typescript
${companyResearch ? `
# Company Research
**About ${companyResearch.name}:**
${companyResearch.description || '[Company description not available]'}

**Industry:** ${companyResearch.industry || '[Industry information not available]'}
${companyResearch.values?.length ? `**Company Values:** ${companyResearch.values.join(', ')}` : ''}
${companyResearch.culture?.length ? `**Culture:** ${companyResearch.culture.join(', ')}` : ''}
${companyResearch.recentNews?.length ? `**Recent News:** ${companyResearch.recentNews[0]}` : ''}

NOTE: Only reference company values/culture if specific data is provided above. Do not fabricate company information.
` : `
# Company Research
Company research is not available. Express genuine interest in the role and company without making specific claims about company culture, values, or initiatives.
`}
```

**Also replace line 169:**

```typescript
${profile.summary || '[Summary not provided - focus on the experience listed below]'}
```

---

### 3.7 Seed Prompts - Add Verification Instructions

**Add to the quality-scoring prompt in `seed-prompts.ts` (after line 311):**

```typescript
"fabricationCheck": {
  "hasUnverifiedMetrics": <boolean>,
  "hasUnverifiedSkills": <boolean>,
  "suspiciousClaims": ["claim that may not be in original data"],
  "verificationNotes": "explanation of any concerns"
}
```

**Update the system prompt (lines 295-312) to include:**

```
CRITICAL VERIFICATION TASK:
In addition to quality scoring, you MUST check for potential fabrication:
1. Compare skills mentioned in the content against ORIGINAL PROFILE SKILLS
2. Check if any specific metrics (%, $, numbers) appear that aren't in ORIGINAL EXPERIENCE
3. Flag any achievements or accomplishments that may have been invented
4. Note any claims that cannot be traced to the provided source data

Include a "fabricationCheck" object in your response.
```

---

## 4. Implementation Checklist

### Immediate Actions (P0)

- [ ] Add universal anti-fabrication header to all content generation prompts
- [ ] Fix `generateExperienceEnhancements()` in `profile-agent.ts` - remove "add quantifiable metrics" instruction
- [ ] Add truthfulness requirements to `generateProfileSummary()` in `resume-generator.ts`
- [ ] Remove default fallback values in `cover-letter-agent.ts` that fabricate company information

### Short-term Actions (P1)

- [ ] Update cover letter system prompt with anti-fabrication rules
- [ ] Add fabrication check to quality scoring prompt
- [ ] Implement validation in `improveResume()` function
- [ ] Lower temperature settings for factual content (0.3-0.5 max)
- [ ] Add source data verification in agent validation methods

### Medium-term Actions (P2)

- [ ] Implement post-generation verification step comparing output claims to input data
- [ ] Add user-facing disclaimer about AI-generated content
- [ ] Create audit logging for generated content to enable review
- [ ] Add "confidence score" for each generated section based on available source data
- [ ] Implement skill/experience matching validation before final output

### Testing Recommendations

- [ ] Create test cases with minimal profile data to verify graceful degradation
- [ ] Test with profiles missing key sections (no summary, no metrics in experience)
- [ ] Verify no fabricated metrics appear when source data lacks numbers
- [ ] Check company research fallback behavior
- [ ] Validate that enhanced content traces back to source material

---

## 5. Additional Recommendations

### 5.1 Temperature Settings

Reduce temperature across all content generation:

| Content Type | Current | Recommended |
|--------------|---------|-------------|
| Resume | 0.5 | 0.3-0.4 |
| Cover Letter | 0.7 | 0.4-0.5 |
| Profile Summary | 0.6 | 0.3-0.4 |
| Experience Enhancement | 0.5 | 0.2-0.3 |
| Headlines | 0.8 | 0.5-0.6 |

### 5.2 User Disclosure

Add a visible disclaimer on generated documents:

> "This [resume/cover letter] was generated using AI based on the information you provided. Please review carefully and verify all details are accurate before submitting to employers."

### 5.3 Verification Pipeline

Consider implementing a two-pass system:
1. **Generation Pass:** Create the content
2. **Verification Pass:** Use a separate LLM call to compare generated content against source data and flag discrepancies

---

## Appendix: Full Improved Prompt Templates

### A. Complete Resume System Prompt

```
You are an expert resume writer creating a targeted, ATS-optimized resume.

## TRUTHFULNESS REQUIREMENTS (MANDATORY - OVERRIDE ALL OTHER INSTRUCTIONS)

1. ABSOLUTE PROHIBITION ON FABRICATION
   - NEVER invent experience, skills, achievements, metrics, or facts not in the profile
   - NEVER add percentages, dollar amounts, team sizes, or numbers unless explicitly provided
   - NEVER assume skills, technologies, or accomplishments not listed

2. SOURCE ATTRIBUTION
   - Every claim MUST trace to provided profile data
   - If profile says "managed a team," do NOT change to "managed a team of 15"
   - Without metrics, describe impact qualitatively: "significantly improved" not "improved by 40%"

3. HANDLING MISSING DATA
   - If sections lack information, keep them brief and factual
   - Use hedging: "Experienced in..." rather than specific unverified claims
   - Do NOT fill gaps with plausible-sounding but unverified information

4. PERMITTED ACTIONS
   - Reorder/prioritize existing information for relevance
   - Rephrase with stronger action verbs (preserving factual accuracy)
   - Highlight profile skills matching job requirements
   - Improve formatting and structure
   - Use job keywords where they accurately reflect the candidate

## OUTPUT FORMAT
- Clean markdown
- Proper heading hierarchy (# name, ## sections)
- Bullet points for experience
- ATS-compatible simple formatting
```

### B. Complete Cover Letter System Prompt

```
You are an expert cover letter writer creating a compelling, personalized letter.

## TRUTHFULNESS REQUIREMENTS (MANDATORY)

1. NEVER fabricate achievements, experiences, or skills not in the candidate profile
2. ONLY reference accomplishments from provided experience data
3. Without company research, express interest without specific culture/value claims
4. Use "I'm drawn to [Company]'s work in [industry]" rather than fabricating knowledge
5. Highlight achievements ONLY from the provided profile

## WHEN DATA IS LIMITED
- Without specific achievements, focus on skills and experience areas
- Without company info, express interest in role/industry generally
- Use "Based on my background in..." not specific unverified claims

## STYLE GUIDELINES
1. Conversational yet professional
2. Company/role specific using only verified information
3. 2-3 key achievements FROM THE PROVIDED PROFILE
4. Genuine interest without fabricated company knowledge
5. 3-4 paragraphs (~300 words)
6. Avoid cliches and generic phrases

Output a clean, ready-to-send cover letter.
```

---

**End of Audit Report**
