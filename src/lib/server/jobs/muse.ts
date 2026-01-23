import type { JobResult, JobSearchParams } from './types';

const MUSE_BASE_URL = 'https://www.themuse.com/api/public/jobs';

interface MuseJob {
	id: number;
	name: string;
	type: string;
	publication_date: string;
	short_name: string;
	model_type: string;
	contents: string;
	refs: {
		landing_page: string;
	};
	company: {
		id: number;
		short_name: string;
		name: string;
	};
	locations: Array<{ name: string }>;
	levels: Array<{ name: string; short_name: string }>;
	categories: Array<{ name: string }>;
}

interface MuseResponse {
	results: MuseJob[];
	page: number;
	page_count: number;
	total: number;
}

export async function searchMuseJobs(params: JobSearchParams): Promise<JobResult[]> {
	const jobs: JobResult[] = [];

	try {
		// Build category filter from roles
		// The Muse uses specific category names
		const categoryMap: Record<string, string> = {
			engineer: 'Engineering',
			developer: 'Engineering',
			software: 'Engineering',
			design: 'Design',
			product: 'Product',
			marketing: 'Marketing',
			sales: 'Sales',
			data: 'Data Science',
			finance: 'Finance',
			hr: 'HR',
			operations: 'Operations'
		};

		let categoryFilter = '';
		for (const role of params.roles) {
			const roleLower = role.toLowerCase();
			for (const [key, value] of Object.entries(categoryMap)) {
				if (roleLower.includes(key)) {
					categoryFilter = `&category=${encodeURIComponent(value)}`;
					break;
				}
			}
			if (categoryFilter) break;
		}

		// Build location filter
		let locationFilter = '';
		if (params.locations.length > 0) {
			locationFilter = `&location=${encodeURIComponent(params.locations[0])}`;
		}

		// Add remote filter if preferred
		if (params.remotePreference === 'remote') {
			locationFilter += '&location=Flexible%20%2F%20Remote';
		}

		const url = `${MUSE_BASE_URL}?page=1${categoryFilter}${locationFilter}`;

		const response = await fetch(url);

		if (!response.ok) {
			console.error(`The Muse API error: ${response.status}`);
			return [];
		}

		const data: MuseResponse = await response.json();

		for (const job of data.results.slice(0, 20)) {
			// Determine experience level
			let experienceLevel = 'mid';
			if (job.levels.some((l) => l.short_name === 'entry')) {
				experienceLevel = 'entry';
			} else if (job.levels.some((l) => l.short_name === 'senior')) {
				experienceLevel = 'senior';
			}

			// Check if remote
			const isRemote =
				job.locations.some((l) => l.name.toLowerCase().includes('remote')) ||
				job.locations.some((l) => l.name.toLowerCase().includes('flexible'));

			jobs.push({
				externalId: job.id.toString(),
				source: 'muse',
				sourceUrl: job.refs.landing_page,
				title: job.name,
				company: job.company.name,
				location: job.locations.map((l) => l.name).join(', '),
				isRemote,
				description: job.contents,
				employmentType: job.type || 'full-time',
				experienceLevel,
				postedAt: job.publication_date
			});
		}
	} catch (error) {
		console.error('Error searching The Muse:', error);
	}

	return jobs;
}
