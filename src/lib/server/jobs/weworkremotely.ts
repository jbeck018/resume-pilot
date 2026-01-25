import { XMLParser } from 'fast-xml-parser';
import type { JobResult, JobSearchParams } from './types';

// RSS feed URLs for different job categories
const WWR_FEEDS = {
	all: 'https://weworkremotely.com/remote-jobs.rss',
	programming: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
	design: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
	devops: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
	management: 'https://weworkremotely.com/categories/remote-management-exec-jobs.rss',
	marketing: 'https://weworkremotely.com/categories/remote-marketing-jobs.rss',
	sales: 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss'
} as const;

type WWRCategory = keyof typeof WWR_FEEDS;

interface RSSItem {
	title: string;
	link: string;
	guid: string;
	pubDate: string;
	description?: string;
	'content:encoded'?: string;
}

interface RSSChannel {
	item: RSSItem | RSSItem[];
}

interface RSSFeed {
	rss: {
		channel: RSSChannel;
	};
}

// Map common role keywords to WWR categories
const ROLE_TO_CATEGORY: Record<string, WWRCategory> = {
	// Programming
	engineer: 'programming',
	developer: 'programming',
	software: 'programming',
	frontend: 'programming',
	backend: 'programming',
	fullstack: 'programming',
	'full-stack': 'programming',
	'full stack': 'programming',
	programmer: 'programming',
	coding: 'programming',
	web: 'programming',
	mobile: 'programming',
	ios: 'programming',
	android: 'programming',
	react: 'programming',
	node: 'programming',
	python: 'programming',
	java: 'programming',
	rust: 'programming',
	go: 'programming',
	typescript: 'programming',

	// Design
	design: 'design',
	designer: 'design',
	ux: 'design',
	ui: 'design',
	'ui/ux': 'design',
	graphic: 'design',
	'product design': 'design',
	visual: 'design',

	// DevOps
	devops: 'devops',
	sysadmin: 'devops',
	'system admin': 'devops',
	infrastructure: 'devops',
	sre: 'devops',
	'site reliability': 'devops',
	cloud: 'devops',
	aws: 'devops',
	kubernetes: 'devops',
	docker: 'devops',

	// Management
	manager: 'management',
	management: 'management',
	director: 'management',
	executive: 'management',
	vp: 'management',
	'vice president': 'management',
	cto: 'management',
	ceo: 'management',
	lead: 'management',
	head: 'management',

	// Marketing
	marketing: 'marketing',
	marketer: 'marketing',
	seo: 'marketing',
	content: 'marketing',
	'social media': 'marketing',
	growth: 'marketing',
	brand: 'marketing',

	// Sales/Support
	sales: 'sales',
	support: 'sales',
	customer: 'sales',
	'customer success': 'sales',
	'customer service': 'sales',
	account: 'sales'
};

/**
 * Parse the WWR title format "Company Name: Job Title" into separate parts
 */
function parseTitle(title: string): { company: string; jobTitle: string } {
	// WWR titles are often in the format "Company Name: Job Title"
	const colonIndex = title.indexOf(':');
	if (colonIndex > 0 && colonIndex < title.length - 1) {
		return {
			company: title.substring(0, colonIndex).trim(),
			jobTitle: title.substring(colonIndex + 1).trim()
		};
	}
	// Fallback: return the whole title as job title, company as unknown
	return {
		company: 'Unknown Company',
		jobTitle: title.trim()
	};
}

/**
 * Strip HTML tags from content and clean up whitespace
 */
function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, ' ')
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
 * Determine which category feeds to fetch based on user's roles
 */
function getCategoriesForRoles(roles: string[]): WWRCategory[] {
	const categories = new Set<WWRCategory>();

	for (const role of roles) {
		const roleLower = role.toLowerCase();
		for (const [keyword, category] of Object.entries(ROLE_TO_CATEGORY)) {
			if (roleLower.includes(keyword)) {
				categories.add(category);
				break;
			}
		}
	}

	// If no specific categories matched, fetch from all jobs
	if (categories.size === 0) {
		categories.add('all');
	}

	return Array.from(categories);
}

/**
 * Fetch and parse a single RSS feed
 */
async function fetchRSSFeed(url: string): Promise<RSSItem[]> {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'ResumePilot/1.0 (job-discovery)',
				Accept: 'application/rss+xml, application/xml, text/xml'
			}
		});

		if (!response.ok) {
			console.error(`WWR RSS fetch error: ${response.status} for ${url}`);
			return [];
		}

		const xmlText = await response.text();

		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			textNodeName: '#text',
			cdataPropName: '__cdata',
			parseTagValue: true,
			trimValues: true
		});

		const result = parser.parse(xmlText) as RSSFeed;

		if (!result.rss?.channel?.item) {
			return [];
		}

		// Handle both single item and array of items
		const items = result.rss.channel.item;
		return Array.isArray(items) ? items : [items];
	} catch (error) {
		console.error(`Error fetching WWR RSS feed (${url}):`, error);
		return [];
	}
}

/**
 * Convert an RSS item to a JobResult
 */
function rssItemToJobResult(item: RSSItem, category: WWRCategory): JobResult {
	const { company, jobTitle } = parseTitle(item.title);

	// Get description - prefer content:encoded as it has full HTML description
	const rawDescription = item['content:encoded'] || item.description || '';
	const description = stripHtml(rawDescription);

	// Use guid or link as external ID
	const externalId = item.guid || item.link;

	return {
		externalId,
		source: 'weworkremotely',
		sourceUrl: item.link,
		title: jobTitle,
		company,
		location: 'Remote',
		isRemote: true, // All WWR jobs are remote
		description,
		employmentType: 'full-time', // WWR is primarily full-time positions
		postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined
	};
}

/**
 * Search WeWorkRemotely for jobs matching the given parameters
 */
export async function searchWeWorkRemotelyJobs(params: JobSearchParams): Promise<JobResult[]> {
	const jobs: JobResult[] = [];
	const seenIds = new Set<string>();

	try {
		// Determine which categories to fetch based on user's roles
		const categories = getCategoriesForRoles(params.roles);

		// Fetch all relevant category feeds in parallel
		const feedPromises = categories.map(async (category) => {
			const feedUrl = WWR_FEEDS[category];
			const items = await fetchRSSFeed(feedUrl);
			return { category, items };
		});

		const feedResults = await Promise.all(feedPromises);

		// Process all items from all feeds
		for (const { category, items } of feedResults) {
			for (const item of items) {
				const externalId = item.guid || item.link;

				// Skip duplicates (same job might appear in multiple category feeds)
				if (seenIds.has(externalId)) {
					continue;
				}
				seenIds.add(externalId);

				const jobResult = rssItemToJobResult(item, category);

				// Optional: Filter by skills if provided
				if (params.skills.length > 0) {
					const descLower = (jobResult.description || '').toLowerCase();
					const titleLower = jobResult.title.toLowerCase();
					const hasMatchingSkill = params.skills.some(
						(skill) =>
							descLower.includes(skill.toLowerCase()) || titleLower.includes(skill.toLowerCase())
					);
					if (!hasMatchingSkill) {
						continue;
					}
				}

				jobs.push(jobResult);
			}
		}
	} catch (error) {
		console.error('Error searching WeWorkRemotely:', error);
	}

	// Limit results to avoid overwhelming the user
	return jobs.slice(0, 50);
}
