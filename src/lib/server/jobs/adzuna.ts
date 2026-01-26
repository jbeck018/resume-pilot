import type { JobResult, JobSearchParams } from './types';
import { env } from '$env/dynamic/private';

const ADZUNA_APP_ID = env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = env.ADZUNA_APP_KEY;
const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

interface AdzunaJob {
	id: string;
	title: string;
	description: string;
	company: { display_name: string };
	location: { display_name: string; area: string[] };
	redirect_url: string;
	created: string;
	salary_min?: number;
	salary_max?: number;
	contract_type?: string;
	category?: { tag: string; label: string };
}

interface AdzunaResponse {
	results: AdzunaJob[];
	count: number;
}

export async function searchAdzunaJobs(params: JobSearchParams): Promise<JobResult[]> {
	if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
		return [];
	}

	const jobs: JobResult[] = [];

	// Build search query from roles and skills
	const searchTerms = [...params.roles, ...params.skills.slice(0, 5)].join(' ');
	if (!searchTerms) return [];

	// Search in US market (can be expanded to other countries)
	const countries = ['us'];

	for (const country of countries) {
		try {
			// Build location filter
			const locationQuery =
				params.locations.length > 0 ? `&where=${encodeURIComponent(params.locations[0])}` : '';

			const url = `${ADZUNA_BASE_URL}/${country}/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=20&what=${encodeURIComponent(searchTerms)}${locationQuery}&content-type=application/json`;

			const response = await fetch(url);

			if (!response.ok) {
				console.error(`Adzuna API error: ${response.status}`);
				continue;
			}

			const data: AdzunaResponse = await response.json();

			for (const job of data.results) {
				jobs.push({
					externalId: job.id,
					source: 'adzuna',
					sourceUrl: job.redirect_url,
					title: job.title,
					company: job.company.display_name,
					location: job.location.display_name,
					isRemote: job.title.toLowerCase().includes('remote') ||
					          job.description.toLowerCase().includes('remote'),
					description: job.description,
					salaryMin: job.salary_min,
					salaryMax: job.salary_max,
					salaryCurrency: 'USD',
					employmentType: job.contract_type || 'full-time',
					postedAt: job.created
				});
			}
		} catch (error) {
			console.error(`Error searching Adzuna (${country}):`, error);
		}
	}

	return jobs;
}
