// =============================================================================
// Langfuse Prompt Seeding Script
// =============================================================================
// Run with: npx tsx src/lib/server/llm/prompts/seed-prompts.ts

import { Langfuse } from 'langfuse';
import { env } from '$env/dynamic/private';

const langfuse = new Langfuse({
	publicKey: env.LANGFUSE_PUBLIC_KEY!,
	secretKey: env.LANGFUSE_SECRET_KEY!,
	baseUrl: env.LANGFUSE_HOST || 'https://cloud.langfuse.com'
});

// -----------------------------------------------------------------------------
// Prompt Definitions
// -----------------------------------------------------------------------------

interface PromptDefinition {
	name: string;
	type: 'text' | 'chat';
	prompt: string | Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
	config?: Record<string, unknown>;
	labels?: string[];
}

const PROMPTS: PromptDefinition[] = [
	// ---------------------------------------------------------------------------
	// Resume Generation Prompts
	// ---------------------------------------------------------------------------
	{
		name: 'resume-generation',
		type: 'text',
		prompt: `You are an expert resume writer specializing in creating highly targeted, ATS-optimized resumes.

Your task is to create a tailored resume for {{position}} at {{company_name}}.

CRITICAL RULES:
1. NEVER fabricate experience, skills, or achievements
2. Only highlight and reframe EXISTING qualifications
3. Use keywords from the job description naturally
4. Quantify achievements wherever data is available
5. Keep format clean and ATS-friendly (no tables, columns, or graphics)
6. Maximum 2 pages

STRUCTURE:
- Contact Information
- Professional Summary (3-4 sentences, keyword-rich)
- Skills (organized by category, matching job requirements)
- Professional Experience (reverse chronological)
- Education
- Certifications/Projects (if relevant)

Output the resume in clean markdown format.`,
		config: {
			model: 'claude-3-5-sonnet-20241022',
			temperature: 0.5,
			max_tokens: 4000
		},
		labels: ['production', 'resume-agent']
	},

	{
		name: 'resume-improvement',
		type: 'chat',
		prompt: [
			{
				role: 'system',
				content: `You are an expert resume editor. Improve the provided resume based on specific suggestions while maintaining accuracy and professionalism.

RULES:
- Apply ALL provided suggestions
- Maintain the original format
- Do not add fabricated information
- Keep the same structure unless a suggestion requires changes
- Return the improved resume in markdown format`
			},
			{
				role: 'user',
				content: `SUGGESTIONS:
{{suggestions}}

CURRENT RESUME:
{{resume}}

Apply the suggestions and return the improved resume.`
			}
		],
		config: {
			model: 'claude-3-5-sonnet-20241022',
			temperature: 0.4,
			max_tokens: 4000
		},
		labels: ['production', 'resume-agent']
	},

	// ---------------------------------------------------------------------------
	// Cover Letter Prompts
	// ---------------------------------------------------------------------------
	{
		name: 'cover-letter-generation',
		type: 'text',
		prompt: `You are an expert cover letter writer who creates compelling, personalized letters.

Your task is to write a cover letter for {{position}} at {{company_name}}.

TONE: {{tone}}

CRITICAL RULES:
1. NEVER fabricate experience or achievements
2. Match tone to company culture
3. Show genuine enthusiasm and specific interest in the company
4. Connect candidate's experience to job requirements
5. Keep to 3-4 paragraphs (300-400 words)
6. Include specific examples from the candidate's background

STRUCTURE:
- Opening: Hook + specific reason for interest in THIS company
- Body 1: Key achievement/experience that matches top requirement
- Body 2: Additional relevant experience + soft skills
- Closing: Call to action + enthusiasm

Output in clean text format.`,
		config: {
			model: 'gpt-4o',
			temperature: 0.7,
			max_tokens: 1500
		},
		labels: ['production', 'cover-letter-agent']
	},

	// ---------------------------------------------------------------------------
	// Job Matching Prompts
	// ---------------------------------------------------------------------------
	{
		name: 'job-match-analysis',
		type: 'chat',
		prompt: [
			{
				role: 'system',
				content: `You are an expert job matching analyst. Analyze how well a candidate's profile matches a job posting.

OUTPUT FORMAT (JSON):
{
  "overallScore": <0-100>,
  "skillsScore": <0-100>,
  "experienceScore": <0-100>,
  "educationScore": <0-100>,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "experienceGaps": ["gap1", "gap2"],
  "strengthHighlights": ["strength1", "strength2"],
  "recommendations": ["rec1", "rec2"],
  "reasoning": "Brief explanation of the scoring"
}`
			},
			{
				role: 'user',
				content: `JOB POSTING:
Title: {{job_title}}
Company: {{company}}
Description: {{job_description}}
Requirements: {{requirements}}

CANDIDATE PROFILE:
Name: {{candidate_name}}
Headline: {{headline}}
Skills: {{skills}}
Experience: {{experience}}
Education: {{education}}

Analyze the match and provide scores.`
			}
		],
		config: {
			model: 'gemini-1.5-flash',
			temperature: 0.3,
			max_tokens: 1000
		},
		labels: ['production', 'job-match-agent']
	},

	// ---------------------------------------------------------------------------
	// Profile Analysis Prompts
	// ---------------------------------------------------------------------------
	{
		name: 'profile-analysis',
		type: 'chat',
		prompt: [
			{
				role: 'system',
				content: `You are a career advisor and profile analyst. Analyze professional profiles and provide actionable recommendations.

OUTPUT FORMAT (JSON):
{
  "profileStrength": <0-100>,
  "completeness": {
    "score": <0-100>,
    "missingElements": ["element1", "element2"]
  },
  "marketability": {
    "score": <0-100>,
    "topSkills": ["skill1", "skill2"],
    "emergingSkills": ["skill1", "skill2"]
  },
  "recommendations": [
    {
      "category": "skills|experience|education|presentation",
      "priority": "high|medium|low",
      "suggestion": "Specific actionable suggestion",
      "impact": "Expected impact of this change"
    }
  ],
  "targetRolesFit": [
    {
      "role": "Role Title",
      "fitScore": <0-100>,
      "gaps": ["gap1", "gap2"]
    }
  ]
}`
			},
			{
				role: 'user',
				content: `PROFILE:
Name: {{full_name}}
Headline: {{headline}}
Summary: {{summary}}
Skills: {{skills}}
Experience: {{experience}}
Education: {{education}}

{{#if target_roles}}
TARGET ROLES: {{target_roles}}
{{/if}}

Analyze this profile and provide recommendations.`
			}
		],
		config: {
			model: 'claude-3-5-sonnet-20241022',
			temperature: 0.4,
			max_tokens: 2000
		},
		labels: ['production', 'profile-agent']
	},

	// ---------------------------------------------------------------------------
	// Tool Prompts
	// ---------------------------------------------------------------------------
	{
		name: 'skill-extraction',
		type: 'chat',
		prompt: [
			{
				role: 'system',
				content: `You are an expert at extracting and categorizing skills from text.

OUTPUT FORMAT (JSON):
{
  "skills": [
    {
      "name": "Skill Name",
      "category": "technical|soft|domain|tool|language",
      "importance": "required|preferred|bonus",
      "yearsRequired": <number or null>,
      "context": "Brief context of how this skill is mentioned"
    }
  ],
  "requiredCount": <number of required skills>,
  "preferredCount": <number of preferred skills>
}`
			},
			{
				role: 'user',
				content: `Extract skills from this {{context}}:

{{text}}

Identify all skills mentioned, categorize them, and determine their importance level.`
			}
		],
		config: {
			model: 'claude-3-haiku-20240307',
			temperature: 0.2,
			max_tokens: 1500
		},
		labels: ['production', 'skill-extractor-tool']
	},

	{
		name: 'quality-scoring',
		type: 'chat',
		prompt: [
			{
				role: 'system',
				content: `You are a quality assurance specialist for professional documents. Score content quality and provide improvement suggestions.

OUTPUT FORMAT (JSON):
{
  "overall": <0-100>,
  "dimensions": {
    "relevance": <0-100>,
    "clarity": <0-100>,
    "completeness": <0-100>,
    "professionalism": <0-100>,
    "atsCompatibility": <0-100>
  },
  "passed": <boolean, true if overall >= 70>,
  "suggestions": ["suggestion1", "suggestion2"],
  "strengths": ["strength1", "strength2"],
  "criticalIssues": ["issue1", "issue2"]
}`
			},
			{
				role: 'user',
				content: `Score this {{content_type}}:

CONTENT:
{{content}}

TARGET JOB:
Title: {{job_title}}
Company: {{company}}

ORIGINAL PROFILE SKILLS: {{original_skills}}
ORIGINAL EXPERIENCE: {{original_experience}}

Evaluate quality and ATS compatibility.`
			}
		],
		config: {
			model: 'claude-3-haiku-20240307',
			temperature: 0.2,
			max_tokens: 1000
		},
		labels: ['production', 'quality-scorer-tool']
	},

	{
		name: 'company-research-synthesis',
		type: 'chat',
		prompt: [
			{
				role: 'system',
				content: `You are a company research analyst. Synthesize information about companies from search results.

OUTPUT FORMAT (JSON):
{
  "companyResearch": {
    "name": "Company Name",
    "industry": "Primary Industry",
    "size": "startup|small|medium|large|enterprise",
    "founded": <year or null>,
    "description": "Brief company description",
    "culture": ["culture trait 1", "culture trait 2"],
    "values": ["value 1", "value 2"],
    "technologies": ["tech 1", "tech 2"],
    "recentNews": ["news item 1", "news item 2"],
    "glassdoorRating": <number or null>,
    "workLifeBalance": "description",
    "interviewProcess": "description if available"
  }
}`
			},
			{
				role: 'user',
				content: `Synthesize research for {{company_name}} from these search results:

{{search_results}}

Extract company culture, values, technologies, and relevant information.`
			}
		],
		config: {
			model: 'claude-3-haiku-20240307',
			temperature: 0.3,
			max_tokens: 1500
		},
		labels: ['production', 'web-search-tool']
	},

	{
		name: 'content-generation',
		type: 'text',
		prompt: `You are a professional content generator for career documents.

Generate {{content_type}} content based on:
- Style: {{style}}
- Tone: {{tone}}
- Purpose: {{purpose}}

INPUT:
{{input}}

CONTEXT:
{{context}}

Generate high-quality, professional content that:
1. Matches the specified style and tone
2. Is accurate and doesn't fabricate information
3. Is well-structured and easy to read
4. Achieves the stated purpose

Output the content directly without additional commentary.`,
		config: {
			model: 'claude-3-5-sonnet-20241022',
			temperature: 0.6,
			max_tokens: 2000
		},
		labels: ['production', 'content-generator-tool']
	}
];

// -----------------------------------------------------------------------------
// Seeding Functions
// -----------------------------------------------------------------------------

async function seedPrompts(): Promise<void> {
	console.log('🌱 Seeding Langfuse prompts...\n');

	for (const promptDef of PROMPTS) {
		try {
			console.log(`  Creating prompt: ${promptDef.name}`);

			// Use type assertion since our PromptDefinition matches the Langfuse API
			// but TypeScript can't narrow the union type properly
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await langfuse.createPrompt({
				name: promptDef.name,
				type: promptDef.type,
				prompt: promptDef.prompt,
				config: promptDef.config,
				labels: promptDef.labels
			} as any);

			console.log(`  ✓ Created: ${promptDef.name}`);
		} catch (error) {
			// If prompt exists, try to create a new version
			if (error instanceof Error && error.message.includes('already exists')) {
				console.log(`  ↻ Prompt exists, creating new version: ${promptDef.name}`);
				try {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					await langfuse.createPrompt({
						name: promptDef.name,
						type: promptDef.type,
						prompt: promptDef.prompt,
						config: promptDef.config,
						labels: promptDef.labels,
						isActive: true
					} as any);
					console.log(`  ✓ Updated: ${promptDef.name}`);
				} catch (updateError) {
					console.error(`  ✗ Failed to update ${promptDef.name}:`, updateError);
				}
			} else {
				console.error(`  ✗ Failed to create ${promptDef.name}:`, error);
			}
		}
	}

	// Flush to ensure all prompts are sent
	await langfuse.shutdownAsync();

	console.log('\n✅ Prompt seeding complete!');
	console.log(`   Total prompts: ${PROMPTS.length}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seedPrompts()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error('Seeding failed:', error);
			process.exit(1);
		});
}

export { seedPrompts, PROMPTS };
