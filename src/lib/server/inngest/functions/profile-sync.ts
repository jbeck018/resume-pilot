import { inngest } from '../client';
import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

// Helper to create Supabase client - called lazily inside steps to reduce CPU overhead
// between step invocations in Cloudflare Workers (fixes error 1102)
function createSupabase() {
	return createServerClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
		cookies: {
			getAll: () => [],
			setAll: () => {}
		}
	});
}

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

// Profile sync workflow - fetches data from GitHub
export const syncProfileFromGitHub = inngest.createFunction(
	{
		id: 'sync-profile-github',
		name: 'Sync Profile from GitHub',
		retries: 2,
		concurrency: {
			limit: 5
		}
	},
	{ event: 'profile/sync.requested' },
	async ({ event, step }) => {
		const { userId, githubHandle } = event.data;

		if (!githubHandle) {
			return {
				success: false,
				reason: 'No GitHub handle provided'
			};
		}

		// NOTE: Supabase client is now created INSIDE each step to avoid
		// CPU overhead on every Inngest step invocation (fixes Cloudflare error 1102)

		// Step 1: Fetch GitHub user profile
		const githubData = await step.run('fetch-github-profile', async () => {
			const response = await fetch(`https://api.github.com/users/${githubHandle}`, {
				headers: {
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'Resume-Pilot-App'
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
		const repos = await step.run('fetch-github-repos', async () => {
			const response = await fetch(
				`https://api.github.com/users/${githubHandle}/repos?sort=pushed&per_page=30`,
				{
					headers: {
						Accept: 'application/vnd.github.v3+json',
						'User-Agent': 'Resume-Pilot-App'
					}
				}
			);

			if (!response.ok) {
				console.error('Failed to fetch repos, continuing without them');
				return [];
			}

			const allRepos = (await response.json()) as GitHubRepo[];
			// Filter out forks, keep original projects
			return allRepos.filter((repo) => !repo.fork);
		});

		// Step 3: Extract skills from repository languages and topics
		const extractedData = await step.run('extract-skills', async () => {
			// Extract languages
			const languageCount: Record<string, number> = {};
			const topicsSet = new Set<string>();

			for (const repo of repos) {
				if (repo.language) {
					languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
				}
				repo.topics?.forEach((topic) => topicsSet.add(topic));
			}

			// Sort languages by frequency
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
				mappedSkills.forEach((s) => skills.add(s));
			}

			// Add topics as skills (common dev topics)
			const relevantTopics = [
				'react',
				'vue',
				'angular',
				'svelte',
				'nodejs',
				'express',
				'fastapi',
				'django',
				'flask',
				'docker',
				'kubernetes',
				'aws',
				'gcp',
				'azure',
				'postgresql',
				'mongodb',
				'redis',
				'graphql',
				'rest-api',
				'machine-learning',
				'ai',
				'deep-learning',
				'data-science',
				'devops',
				'ci-cd',
				'testing'
			];

			topicsSet.forEach((topic) => {
				if (relevantTopics.includes(topic.toLowerCase())) {
					skills.add(topic.charAt(0).toUpperCase() + topic.slice(1));
				}
			});

			// Extract top projects for portfolio
			const topProjects = repos
				.sort((a, b) => b.stargazers_count - a.stargazers_count)
				.slice(0, 5)
				.map((repo) => ({
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

		// Step 4: Update profile with GitHub data (only if fields are empty)
		await step.run('update-profile-from-github', async () => {
			const supabase = createSupabase();
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

			const updates: {
				full_name?: string;
				summary?: string;
				skills?: string[];
				location?: string;
				portfolio_urls?: string[];
				updated_at: string;
			} = {
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

			// Merge skills (add GitHub skills to existing)
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

			// Add website to portfolio URLs if exists
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
			githubHandle,
			skillsExtracted: extractedData.skills.length,
			projectsFound: extractedData.projects.length,
			dataExtracted: {
				name: !!extractedData.name,
				bio: !!extractedData.bio,
				location: !!extractedData.location
			}
		};
	}
);
