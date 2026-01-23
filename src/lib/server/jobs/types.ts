export type JobSource = 'adzuna' | 'muse' | 'greenhouse' | 'lever';

export interface JobSearchParams {
	roles: string[];
	locations: string[];
	skills: string[];
	remotePreference?: string;
	salaryMin?: number;
	salaryMax?: number;
}

export interface JobResult {
	externalId: string;
	source: JobSource;
	sourceUrl: string;
	title: string;
	company: string;
	companyLogo?: string;
	location?: string;
	isRemote: boolean;
	description?: string;
	requirements?: string[];
	salaryMin?: number;
	salaryMax?: number;
	salaryCurrency?: string;
	employmentType?: string;
	experienceLevel?: string;
	postedAt?: string;
	matchScore?: number;
}
