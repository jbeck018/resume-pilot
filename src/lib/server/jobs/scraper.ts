/**
 * Job URL Scraping and Text Extraction Module
 *
 * Provides functionality to:
 * 1. Scrape job URLs and extract structured job information
 * 2. Parse raw job description text using AI
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { getAnthropicProvider } from '$lib/server/llm';

/**
 * Extracted job information schema
 */
const JobInfoSchema = z.object({
	title: z.string().nullable().describe('Job title'),
	company: z.string().nullable().describe('Company name'),
	location: z.string().nullable().describe('Job location'),
	salary: z.string().nullable().describe('Salary range if mentioned'),
	description: z.string().describe('Full job description'),
	requirements: z.array(z.string()).describe('List of job requirements and qualifications'),
	responsibilities: z.array(z.string()).optional().describe('List of job responsibilities'),
	benefits: z.array(z.string()).optional().describe('List of benefits if mentioned'),
	employmentType: z.string().nullable().describe('Full-time, part-time, contract, etc.'),
	experienceLevel: z.string().nullable().describe('Entry, mid, senior level'),
	skills: z.array(z.string()).describe('Required and preferred skills'),
	isRemote: z.boolean().describe('Whether the job is remote')
});

export type ExtractedJobInfo = z.infer<typeof JobInfoSchema>;

/**
 * URL patterns for known job boards
 */
const JOB_BOARD_PATTERNS = {
	lever: /jobs\.lever\.co\/([^/]+)\/([a-f0-9-]+)/i,
	greenhouse: /boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i,
	linkedin: /linkedin\.com\/jobs\/view\/(\d+)/i,
	indeed: /indeed\.com\/viewjob/i,
	glassdoor: /glassdoor\.com\/job-listing/i,
	workday: /myworkdayjobs\.com/i,
	ashby: /jobs\.ashbyhq\.com\/([^/]+)\/([a-f0-9-]+)/i
};

/**
 * Scrape a job URL and extract job information
 *
 * Attempts to:
 * 1. Detect if it's a known job board (Lever, Greenhouse, etc.)
 * 2. Use API for known boards when possible
 * 3. Fall back to HTML scraping and AI extraction
 */
export async function scrapeJobUrl(url: string): Promise<ExtractedJobInfo | null> {
	try {
		// Detect job board type
		const leverMatch = url.match(JOB_BOARD_PATTERNS.lever);
		if (leverMatch) {
			return await scrapeLeverJob(leverMatch[1], leverMatch[2]);
		}

		const greenhouseMatch = url.match(JOB_BOARD_PATTERNS.greenhouse);
		if (greenhouseMatch) {
			return await scrapeGreenhouseJob(greenhouseMatch[1], greenhouseMatch[2]);
		}

		const ashbyMatch = url.match(JOB_BOARD_PATTERNS.ashby);
		if (ashbyMatch) {
			return await scrapeAshbyJob(ashbyMatch[1], ashbyMatch[2]);
		}

		// Fall back to generic HTML scraping
		return await scrapeGenericJobUrl(url);
	} catch (error) {
		console.error('Error scraping job URL:', error);
		return null;
	}
}

/**
 * Scrape a Lever job posting using their public API
 */
async function scrapeLeverJob(company: string, jobId: string): Promise<ExtractedJobInfo | null> {
	try {
		const response = await fetch(`https://api.lever.co/v0/postings/${company}/${jobId}`);
		if (!response.ok) return null;

		const job = await response.json();

		// Extract content from Lever's list format
		const listsContent =
			job.lists?.map((list: any) => `${list.text}:\n${list.content}`).join('\n\n') || '';
		const fullDescription = `${job.descriptionPlain || ''}\n\n${listsContent}`;

		return {
			title: job.text || null,
			company: job.categories?.department || company,
			location: job.categories?.location || null,
			salary: null,
			description: fullDescription.trim(),
			requirements: extractRequirementsFromText(fullDescription),
			responsibilities: extractResponsibilitiesFromText(fullDescription),
			benefits: [],
			employmentType: job.categories?.commitment || null,
			experienceLevel: null,
			skills: extractSkillsFromText(fullDescription),
			isRemote:
				fullDescription.toLowerCase().includes('remote') ||
				(job.categories?.location || '').toLowerCase().includes('remote')
		};
	} catch {
		return null;
	}
}

/**
 * Scrape a Greenhouse job posting using their public API
 */
async function scrapeGreenhouseJob(
	company: string,
	jobId: string
): Promise<ExtractedJobInfo | null> {
	try {
		const response = await fetch(
			`https://boards-api.greenhouse.io/v1/boards/${company}/jobs/${jobId}`
		);
		if (!response.ok) return null;

		const job = await response.json();

		// Greenhouse returns HTML content, extract plain text
		const description = stripHtml(job.content || '');

		return {
			title: job.title || null,
			company: company,
			location: job.location?.name || null,
			salary: null,
			description: description,
			requirements: extractRequirementsFromText(description),
			responsibilities: extractResponsibilitiesFromText(description),
			benefits: [],
			employmentType: null,
			experienceLevel: null,
			skills: extractSkillsFromText(description),
			isRemote:
				description.toLowerCase().includes('remote') ||
				(job.location?.name || '').toLowerCase().includes('remote')
		};
	} catch {
		return null;
	}
}

/**
 * Scrape an Ashby job posting
 */
async function scrapeAshbyJob(company: string, jobId: string): Promise<ExtractedJobInfo | null> {
	try {
		// Ashby doesn't have a public API, so we'll fetch the page and extract
		const response = await fetch(`https://jobs.ashbyhq.com/${company}/${jobId}`);
		if (!response.ok) return null;

		const html = await response.text();
		const text = stripHtml(html);

		// Use AI to extract structured info
		return await extractJobInfo(text);
	} catch {
		return null;
	}
}

/**
 * Generic URL scraping for unknown job boards
 */
async function scrapeGenericJobUrl(url: string): Promise<ExtractedJobInfo | null> {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			}
		});

		if (!response.ok) return null;

		const html = await response.text();
		const text = stripHtml(html);

		// If text is too short, likely blocked or invalid
		if (text.length < 200) {
			return null;
		}

		// Use AI to extract structured info from the page content
		return await extractJobInfo(text);
	} catch {
		return null;
	}
}

/**
 * Extract structured job information from raw text using AI
 *
 * This is the primary function for parsing job descriptions
 */
export async function extractJobInfo(text: string): Promise<ExtractedJobInfo | null> {
	if (!text || text.length < 50) {
		return null;
	}

	try {
		const anthropic = getAnthropicProvider();

		// Truncate if too long (keep first 15k chars)
		const truncatedText = text.length > 15000 ? text.slice(0, 15000) + '...' : text;

		const result = await generateObject({
			model: anthropic('claude-3-5-haiku-latest'),
			schema: JobInfoSchema,
			prompt: `Extract structured job information from the following job posting text.

Job Posting Text:
${truncatedText}

Instructions:
- Extract the job title, company name, and location if present
- List all requirements, qualifications, and skills mentioned
- Identify if this is a remote position
- Extract salary information if mentioned
- Determine experience level (entry/junior, mid, senior, lead, etc.)
- Be thorough in extracting skills - include both technical and soft skills`
		});

		return result.object;
	} catch (error) {
		console.error('Error extracting job info with AI:', error);

		// Fall back to basic extraction
		return {
			title: extractTitle(text),
			company: extractCompany(text),
			location: extractLocation(text),
			salary: extractSalary(text),
			description: text.slice(0, 5000),
			requirements: extractRequirementsFromText(text),
			responsibilities: extractResponsibilitiesFromText(text),
			benefits: [],
			employmentType: extractEmploymentType(text),
			experienceLevel: extractExperienceLevel(text),
			skills: extractSkillsFromText(text),
			isRemote: text.toLowerCase().includes('remote')
		};
	}
}

/**
 * Strip HTML tags and decode entities
 */
function stripHtml(html: string): string {
	return html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Basic text extraction helpers (fallback when AI is unavailable)
 */

function extractTitle(text: string): string | null {
	// Common patterns for job titles
	const patterns = [
		/(?:job title|position|role)[:\s]+([^\n]+)/i,
		/^([A-Z][a-z]+ (?:Engineer|Developer|Manager|Designer|Analyst|Specialist)[^\n]*)/m
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) return match[1].trim();
	}
	return null;
}

function extractCompany(text: string): string | null {
	const patterns = [/(?:company|employer|at)[:\s]+([^\n]+)/i, /(?:about|join)\s+([A-Z][^\n,]+)/i];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) return match[1].trim().slice(0, 100);
	}
	return null;
}

function extractLocation(text: string): string | null {
	const patterns = [
		/(?:location|based in|office)[:\s]+([^\n]+)/i,
		/(?:in|at)\s+((?:San Francisco|New York|Los Angeles|Chicago|Seattle|Austin|Boston|Denver|Remote)[^\n,]*)/i
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) return match[1].trim().slice(0, 100);
	}
	return null;
}

function extractSalary(text: string): string | null {
	const patterns = [
		/\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per year|annually|\/year|k|K))?/,
		/(?:salary|compensation)[:\s]+([^\n]+)/i
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match) return (match[1] || match[0]).trim();
	}
	return null;
}

function extractEmploymentType(text: string): string | null {
	const textLower = text.toLowerCase();
	if (textLower.includes('full-time') || textLower.includes('full time')) return 'Full-time';
	if (textLower.includes('part-time') || textLower.includes('part time')) return 'Part-time';
	if (textLower.includes('contract')) return 'Contract';
	if (textLower.includes('internship') || textLower.includes('intern')) return 'Internship';
	return null;
}

function extractExperienceLevel(text: string): string | null {
	const textLower = text.toLowerCase();
	if (textLower.includes('senior') || textLower.includes('sr.')) return 'Senior';
	if (textLower.includes('lead') || textLower.includes('principal')) return 'Lead';
	if (textLower.includes('junior') || textLower.includes('jr.')) return 'Junior';
	if (textLower.includes('entry level') || textLower.includes('entry-level')) return 'Entry';
	if (textLower.includes('mid-level') || textLower.includes('mid level')) return 'Mid';
	return null;
}

function extractRequirementsFromText(text: string): string[] {
	const requirements: string[] = [];

	// Look for bullet points after "Requirements" or "Qualifications"
	const reqSectionMatch = text.match(
		/(?:requirements?|qualifications?|what you(?:'ll)? need)[:\s]*\n?([\s\S]*?)(?:\n(?:benefits|responsibilities|about|what we offer)|$)/i
	);

	if (reqSectionMatch) {
		const bullets = reqSectionMatch[1].match(/[•\-\*]\s*([^\n]+)/g);
		if (bullets) {
			requirements.push(...bullets.map((b) => b.replace(/^[•\-\*]\s*/, '').trim()));
		}
	}

	// Also look for experience patterns
	const experiencePatterns = [
		/(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
		/experience\s+(?:with|in)\s+([^,.\n]+)/gi,
		/proficient\s+(?:with|in)\s+([^,.\n]+)/gi
	];

	for (const pattern of experiencePatterns) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			const req = match[0].trim();
			if (req && !requirements.includes(req)) {
				requirements.push(req);
			}
		}
	}

	return requirements.slice(0, 15);
}

function extractResponsibilitiesFromText(text: string): string[] {
	const responsibilities: string[] = [];

	const respSectionMatch = text.match(
		/(?:responsibilities?|what you(?:'ll)? do|your role)[:\s]*\n?([\s\S]*?)(?:\n(?:requirements|qualifications|benefits|about)|$)/i
	);

	if (respSectionMatch) {
		const bullets = respSectionMatch[1].match(/[•\-\*]\s*([^\n]+)/g);
		if (bullets) {
			responsibilities.push(...bullets.map((b) => b.replace(/^[•\-\*]\s*/, '').trim()));
		}
	}

	return responsibilities.slice(0, 10);
}

function extractSkillsFromText(text: string): string[] {
	const skills = new Set<string>();

	const skillPatterns = [
		// Programming languages
		/\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|Ruby|Go|Rust|PHP|Swift|Kotlin|Scala|R)\b/gi,
		// Frameworks
		/\b(React|Vue|Angular|Svelte|Next\.js|Nuxt|Express|Django|Flask|FastAPI|Spring|Laravel|Rails)\b/gi,
		// Databases
		/\b(PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|DynamoDB|Cassandra|SQLite|Oracle|SQL Server)\b/gi,
		// Cloud & DevOps
		/\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|GitLab|CircleCI|Terraform|Ansible)\b/gi,
		// Tools & Other
		/\b(Git|Node\.js|REST|GraphQL|API|CI\/CD|Agile|Scrum|Linux|Figma|Jira)\b/gi
	];

	for (const pattern of skillPatterns) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			skills.add(match[1]);
		}
	}

	return Array.from(skills).slice(0, 30);
}
