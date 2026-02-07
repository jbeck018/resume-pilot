// Job Discovery Workflow
// Searches multiple job sources and saves matching jobs to the database
// Sources: Greenhouse, Lever, RemoteOK, WeWorkRemotely, Jooble

import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env, JobDiscoveryParams, JobDiscoveryResult } from '../types';
import { createSupabaseClient } from '../utils/supabase';

interface JobListing {
	title: string;
	company: string;
	location: string | null;
	description: string;
	requirements: string[];
	sourceUrl: string;
	source: string;
	isRemote: boolean;
	salaryMin?: number;
	salaryMax?: number;
	salaryCurrency?: string;
}

export class JobDiscoveryWorkflow extends WorkflowEntrypoint<Env, JobDiscoveryParams> {
	async run(
		event: WorkflowEvent<JobDiscoveryParams>,
		step: WorkflowStep
	): Promise<JobDiscoveryResult> {
		const { userId, searchCriteria } = event.payload;

		try {
			// Step 1: Get user profile and search preferences
			const userProfile = await step.do('get-user-profile', async () => {
				const supabase = createSupabaseClient(this.env);
				const { data, error } = await supabase
					.from('profiles')
					.select('skills, preferred_roles, preferred_locations, remote_preference, min_salary')
					.eq('user_id', userId)
					.single();

				if (error) {
					throw new Error(`Failed to get profile: ${error.message}`);
				}
				return data;
			});

			// Build search criteria from profile + params
			const keywords = searchCriteria?.keywords || userProfile.preferred_roles || [];
			const location = searchCriteria?.location || userProfile.preferred_locations?.[0] || '';
			const remoteOnly = searchCriteria?.remote ?? userProfile.remote_preference === 'remote';

			// Step 2: Search RemoteOK (if remote preference)
			const remoteOkJobs = await step.do('search-remoteok', async () => {
				if (!remoteOnly && !keywords.some((k: string) => k.toLowerCase().includes('remote'))) {
					return [];
				}

				try {
					const response = await fetch('https://remoteok.com/api', {
						headers: { 'User-Agent': 'HowlerHire/1.0' }
					});

					if (!response.ok) return [];

					const jobs = (await response.json()) as Array<{
						slug: string;
						company: string;
						position: string;
						description: string;
						location: string;
						url: string;
						salary_min?: number;
						salary_max?: number;
						tags?: string[];
					}>;

					// Filter by keywords
					const keywordsLower = keywords.map((k: string) => k.toLowerCase());
					return jobs
						.filter(job => {
							if (!job.position) return false;
							const titleLower = job.position.toLowerCase();
							const descLower = (job.description || '').toLowerCase();
							return keywordsLower.some(
								(kw: string) => titleLower.includes(kw) || descLower.includes(kw)
							);
						})
						.slice(0, 20)
						.map(job => ({
							title: job.position,
							company: job.company || 'Unknown',
							location: job.location || 'Remote',
							description: job.description || '',
							requirements: job.tags || [],
							sourceUrl: job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
							source: 'remoteok',
							isRemote: true,
							salaryMin: job.salary_min,
							salaryMax: job.salary_max,
							salaryCurrency: 'USD'
						}));
				} catch (error) {
					console.error('RemoteOK search failed:', error);
					return [];
				}
			});

			// Step 3: Search WeWorkRemotely RSS
			const wwrJobs = await step.do('search-weworkremotely', async () => {
				if (!remoteOnly) return [];

				try {
					// WWR has RSS feeds by category
					const categories = ['programming', 'design', 'product', 'marketing'];
					const allJobs: JobListing[] = [];

					for (const category of categories.slice(0, 2)) {
						// Limit categories to reduce API calls
						const response = await fetch(
							`https://weworkremotely.com/categories/${category}.rss`,
							{ headers: { 'User-Agent': 'HowlerHire/1.0' } }
						);

						if (!response.ok) continue;

						const text = await response.text();

						// Simple RSS parsing (title and link extraction)
						const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];

						for (const item of items.slice(0, 10)) {
							const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
							const linkMatch = item.match(/<link>(.*?)<\/link>/);
							const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s);

							if (titleMatch && linkMatch) {
								// Parse title: "Company: Position"
								const [company, ...titleParts] = titleMatch[1].split(':');
								const title = titleParts.join(':').trim() || titleMatch[1];

								allJobs.push({
									title: title,
									company: company?.trim() || 'Unknown',
									location: 'Remote',
									description: descMatch?.[1]?.replace(/<[^>]*>/g, '') || '',
									requirements: [],
									sourceUrl: linkMatch[1],
									source: 'weworkremotely',
									isRemote: true
								});
							}
						}
					}

					// Filter by keywords
					const keywordsLower = keywords.map((k: string) => k.toLowerCase());
					return allJobs.filter(job => {
						const titleLower = job.title.toLowerCase();
						const descLower = job.description.toLowerCase();
						return keywordsLower.some(
							(kw: string) => titleLower.includes(kw) || descLower.includes(kw)
						);
					});
				} catch (error) {
					console.error('WeWorkRemotely search failed:', error);
					return [];
				}
			});

			// Step 4: Combine and deduplicate jobs
			const allJobs = await step.do('combine-jobs', async () => {
				const combined = [...remoteOkJobs, ...wwrJobs];

				// Deduplicate by title + company
				const seen = new Set<string>();
				return combined.filter(job => {
					const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				});
			});

			// Step 5: Calculate match scores and save to database
			const savedCount = await step.do('save-jobs', async () => {
				if (allJobs.length === 0) return 0;

				const supabase = createSupabaseClient(this.env);
				const userSkills = (userProfile.skills || []).map((s: string) => s.toLowerCase());
				let saved = 0;

				for (const job of allJobs) {
					// Calculate simple match score
					const jobText = `${job.title} ${job.description}`.toLowerCase();
					const matchedSkills = userSkills.filter((skill: string) => jobText.includes(skill));
					const matchScore = Math.round((matchedSkills.length / Math.max(userSkills.length, 1)) * 100);

					// Check if job already exists
					const { data: existing } = await supabase
						.from('jobs')
						.select('id')
						.eq('user_id', userId)
						.eq('source_url', job.sourceUrl)
						.single();

					if (existing) continue;

					// Insert new job
					const { error } = await supabase.from('jobs').insert({
						user_id: userId,
						title: job.title,
						company: job.company,
						location: job.location,
						description: job.description,
						requirements: job.requirements,
						source_url: job.sourceUrl,
						source: job.source,
						is_remote: job.isRemote,
						salary_min: job.salaryMin,
						salary_max: job.salaryMax,
						salary_currency: job.salaryCurrency || 'USD',
						match_score: matchScore,
						status: 'new',
						discovered_at: new Date().toISOString()
					});

					if (!error) saved++;
				}

				return saved;
			});

			return {
				success: true,
				jobsFound: savedCount,
				sourcesSearched: 2 // RemoteOK + WWR
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}
