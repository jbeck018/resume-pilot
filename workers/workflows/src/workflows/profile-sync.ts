// Profile Sync Workflow
// Syncs user profile data from GitHub
// Extracts skills from repositories and project data

import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env, ProfileSyncParams, ProfileSyncResult } from '../types';
import { createSupabaseClient } from '../utils/supabase';

interface GitHubUser {
	login: string;
	name: string | null;
	bio: string | null;
	location: string | null;
	blog: string | null;
	html_url: string;
	public_repos: number;
}

interface GitHubRepo {
	name: string;
	description: string | null;
	html_url: string;
	language: string | null;
	stargazers_count: number;
	fork: boolean;
	topics: string[];
}

export class ProfileSyncWorkflow extends WorkflowEntrypoint<Env, ProfileSyncParams> {
	async run(
		event: WorkflowEvent<ProfileSyncParams>,
		step: WorkflowStep
	): Promise<ProfileSyncResult> {
		const { userId, githubHandle } = event.payload;

		if (!githubHandle) {
			return {
				success: false,
				error: 'No GitHub handle provided'
			};
		}

		try {
			// Step 1: Fetch GitHub user profile
			const githubData = await step.do('fetch-github-profile', async () => {
				const response = await fetch(`https://api.github.com/users/${githubHandle}`, {
					headers: {
						Accept: 'application/vnd.github.v3+json',
						'User-Agent': 'HowlerHire-App'
					}
				});

				if (!response.ok) {
					if (response.status === 404) {
						throw new Error(`GitHub user not found: ${githubHandle}`);
					}
					throw new Error(`Failed to fetch GitHub profile: ${response.status}`);
				}

				return (await response.json()) as GitHubUser;
			});

			// Step 2: Fetch GitHub repositories
			const repos = await step.do('fetch-github-repos', async () => {
				const response = await fetch(
					`https://api.github.com/users/${githubHandle}/repos?sort=pushed&per_page=30`,
					{
						headers: {
							Accept: 'application/vnd.github.v3+json',
							'User-Agent': 'HowlerHire-App'
						}
					}
				);

				if (!response.ok) {
					console.error('Failed to fetch repos, continuing without them');
					return [];
				}

				const allRepos = (await response.json()) as GitHubRepo[];
				// Filter out forks
				return allRepos.filter(repo => !repo.fork);
			});

			// Step 3: Extract skills from languages and topics
			const extractedData = await step.do('extract-skills', async () => {
				// Language frequency count
				const languageCount: Record<string, number> = {};
				const topicsSet = new Set<string>();

				for (const repo of repos) {
					if (repo.language) {
						languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
					}
					repo.topics?.forEach(topic => topicsSet.add(topic));
				}

				// Top languages by frequency
				const topLanguages = Object.entries(languageCount)
					.sort((a, b) => b[1] - a[1])
					.map(([lang]) => lang)
					.slice(0, 10);

				// Map languages to skills
				const languageToSkill: Record<string, string[]> = {
					TypeScript: ['TypeScript', 'JavaScript'],
					JavaScript: ['JavaScript'],
					Python: ['Python'],
					Java: ['Java'],
					Go: ['Go', 'Golang'],
					Rust: ['Rust'],
					'C++': ['C++'],
					C: ['C'],
					'C#': ['C#', '.NET'],
					Ruby: ['Ruby'],
					PHP: ['PHP'],
					Swift: ['Swift', 'iOS'],
					Kotlin: ['Kotlin', 'Android'],
					Dart: ['Dart', 'Flutter'],
					Shell: ['Shell Scripting', 'Bash'],
					HTML: ['HTML', 'Web Development'],
					CSS: ['CSS'],
					SCSS: ['SCSS', 'CSS'],
					Vue: ['Vue.js'],
					Svelte: ['Svelte']
				};

				const skills = new Set<string>();
				for (const lang of topLanguages) {
					const mappedSkills = languageToSkill[lang] || [lang];
					mappedSkills.forEach(s => skills.add(s));
				}

				// Add relevant topics as skills
				const relevantTopics = [
					'react', 'vue', 'angular', 'svelte', 'nodejs', 'express',
					'fastapi', 'django', 'flask', 'docker', 'kubernetes',
					'aws', 'gcp', 'azure', 'postgresql', 'mongodb', 'redis',
					'graphql', 'rest-api', 'machine-learning', 'ai',
					'deep-learning', 'data-science', 'devops', 'ci-cd', 'testing'
				];

				topicsSet.forEach(topic => {
					if (relevantTopics.includes(topic.toLowerCase())) {
						skills.add(topic.charAt(0).toUpperCase() + topic.slice(1));
					}
				});

				// Top projects for portfolio
				const topProjects = repos
					.sort((a, b) => b.stargazers_count - a.stargazers_count)
					.slice(0, 5)
					.map(repo => ({
						name: repo.name,
						description: repo.description || '',
						url: repo.html_url,
						language: repo.language
					}));

				return {
					skills: Array.from(skills),
					projects: topProjects,
					location: githubData.location,
					bio: githubData.bio,
					name: githubData.name,
					websiteUrl: githubData.blog
				};
			});

			// Step 4: Update profile with GitHub data
			await step.do('update-profile', async () => {
				const supabase = createSupabaseClient(this.env);

				// Get current profile
				const { data: profile, error: profileError } = await supabase
					.from('profiles')
					.select('full_name, summary, skills, location, portfolio_urls')
					.eq('user_id', userId)
					.single();

				if (profileError) {
					console.error('Failed to get profile:', profileError);
					return;
				}

				const updates: Record<string, unknown> = {
					updated_at: new Date().toISOString()
				};

				// Update name if not set
				if (!profile.full_name && extractedData.name) {
					updates.full_name = extractedData.name;
				}

				// Update summary/bio if not set
				if (!profile.summary && extractedData.bio) {
					updates.summary = extractedData.bio;
				}

				// Merge skills
				if (extractedData.skills.length > 0) {
					const existingSkills = profile.skills || [];
					const mergedSkills = Array.from(new Set([...existingSkills, ...extractedData.skills]));
					if (mergedSkills.length > existingSkills.length) {
						updates.skills = mergedSkills;
					}
				}

				// Update location if not set
				if (!profile.location && extractedData.location) {
					updates.location = extractedData.location;
				}

				// Add website to portfolio URLs
				if (extractedData.websiteUrl) {
					const existingUrls = profile.portfolio_urls || [];
					if (!existingUrls.includes(extractedData.websiteUrl)) {
						updates.portfolio_urls = [...existingUrls, extractedData.websiteUrl];
					}
				}

				// Only update if we have changes
				if (Object.keys(updates).length > 1) {
					const { error: updateError } = await supabase
						.from('profiles')
						.update(updates)
						.eq('user_id', userId);

					if (updateError) {
						console.error('Failed to update profile:', updateError);
					}
				}
			});

			return {
				success: true,
				skillsExtracted: extractedData.skills.length,
				projectsFound: extractedData.projects.length
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}
