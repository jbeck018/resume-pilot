/**
 * Learning Resources Service
 * Maps skills to curated learning resources from top platforms
 * Key competitive differentiator - helps users close skill gaps
 */

export interface LearningResource {
	title: string;
	platform: 'Coursera' | 'Udemy' | 'LinkedIn Learning' | 'Pluralsight' | 'freeCodeCamp' | 'YouTube' | 'Documentation';
	url: string;
	type: 'course' | 'tutorial' | 'certification' | 'docs';
	free: boolean;
	duration?: string;
	level?: 'beginner' | 'intermediate' | 'advanced';
}

export interface SkillResources {
	skill: string;
	resources: LearningResource[];
}

// Skill category mappings for better resource matching
const SKILL_CATEGORIES: Record<string, string[]> = {
	'programming-languages': [
		'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin'
	],
	'frontend': [
		'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'html', 'css', 'sass', 'tailwind', 'bootstrap'
	],
	'backend': [
		'node.js', 'express', 'fastapi', 'django', 'flask', 'spring', 'asp.net', 'rails', 'laravel'
	],
	'databases': [
		'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'firebase'
	],
	'cloud': [
		'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'serverless'
	],
	'data-science': [
		'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'data analysis'
	],
	'devops': [
		'ci/cd', 'jenkins', 'github actions', 'gitlab ci', 'ansible', 'linux', 'bash'
	],
	'design': [
		'figma', 'sketch', 'adobe xd', 'ui/ux', 'user research', 'prototyping'
	],
	'soft-skills': [
		'leadership', 'communication', 'project management', 'agile', 'scrum', 'team management'
	]
};

// Curated learning resources by skill
const SKILL_RESOURCES: Record<string, LearningResource[]> = {
	// Programming Languages
	'javascript': [
		{ title: 'JavaScript: Understanding the Weird Parts', platform: 'Udemy', url: 'https://www.udemy.com/course/understand-javascript/', type: 'course', free: false, duration: '12 hours', level: 'intermediate' },
		{ title: 'JavaScript Algorithms and Data Structures', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/', type: 'certification', free: true, duration: '300 hours', level: 'beginner' },
		{ title: 'MDN JavaScript Guide', platform: 'Documentation', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', type: 'docs', free: true }
	],
	'typescript': [
		{ title: 'Understanding TypeScript', platform: 'Udemy', url: 'https://www.udemy.com/course/understanding-typescript/', type: 'course', free: false, duration: '15 hours', level: 'intermediate' },
		{ title: 'TypeScript Documentation', platform: 'Documentation', url: 'https://www.typescriptlang.org/docs/', type: 'docs', free: true },
		{ title: 'TypeScript Full Course', platform: 'YouTube', url: 'https://www.youtube.com/watch?v=BwuLxPH8IDs', type: 'tutorial', free: true, duration: '5 hours', level: 'beginner' }
	],
	'python': [
		{ title: 'Python for Everybody Specialization', platform: 'Coursera', url: 'https://www.coursera.org/specializations/python', type: 'certification', free: false, duration: '8 months', level: 'beginner' },
		{ title: 'Scientific Computing with Python', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', type: 'certification', free: true, duration: '300 hours', level: 'beginner' },
		{ title: 'Python Documentation', platform: 'Documentation', url: 'https://docs.python.org/3/tutorial/', type: 'docs', free: true }
	],
	'java': [
		{ title: 'Java Programming Masterclass', platform: 'Udemy', url: 'https://www.udemy.com/course/java-the-complete-java-developer-course/', type: 'course', free: false, duration: '80 hours', level: 'beginner' },
		{ title: 'Java Programming and Software Engineering', platform: 'Coursera', url: 'https://www.coursera.org/specializations/java-programming', type: 'certification', free: false, duration: '5 months', level: 'beginner' }
	],
	'go': [
		{ title: 'Go: The Complete Developer Guide', platform: 'Udemy', url: 'https://www.udemy.com/course/go-the-complete-developers-guide/', type: 'course', free: false, duration: '9 hours', level: 'beginner' },
		{ title: 'A Tour of Go', platform: 'Documentation', url: 'https://go.dev/tour/', type: 'tutorial', free: true, level: 'beginner' }
	],
	'rust': [
		{ title: 'The Rust Programming Language', platform: 'Documentation', url: 'https://doc.rust-lang.org/book/', type: 'docs', free: true },
		{ title: 'Rust Programming Course', platform: 'YouTube', url: 'https://www.youtube.com/watch?v=MsocPEZBd-M', type: 'tutorial', free: true, duration: '14 hours', level: 'beginner' }
	],

	// Frontend
	'react': [
		{ title: 'React - The Complete Guide', platform: 'Udemy', url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux/', type: 'course', free: false, duration: '65 hours', level: 'beginner' },
		{ title: 'React Documentation', platform: 'Documentation', url: 'https://react.dev/learn', type: 'docs', free: true },
		{ title: 'Full Stack Open', platform: 'freeCodeCamp', url: 'https://fullstackopen.com/en/', type: 'course', free: true, duration: '200 hours', level: 'intermediate' }
	],
	'vue': [
		{ title: 'Vue - The Complete Guide', platform: 'Udemy', url: 'https://www.udemy.com/course/vuejs-2-the-complete-guide/', type: 'course', free: false, duration: '32 hours', level: 'beginner' },
		{ title: 'Vue.js Documentation', platform: 'Documentation', url: 'https://vuejs.org/guide/introduction.html', type: 'docs', free: true }
	],
	'angular': [
		{ title: 'Angular - The Complete Guide', platform: 'Udemy', url: 'https://www.udemy.com/course/the-complete-guide-to-angular-2/', type: 'course', free: false, duration: '37 hours', level: 'beginner' },
		{ title: 'Angular Documentation', platform: 'Documentation', url: 'https://angular.io/docs', type: 'docs', free: true }
	],
	'svelte': [
		{ title: 'Svelte Tutorial', platform: 'Documentation', url: 'https://learn.svelte.dev/', type: 'tutorial', free: true, level: 'beginner' },
		{ title: 'SvelteKit Documentation', platform: 'Documentation', url: 'https://kit.svelte.dev/docs', type: 'docs', free: true }
	],
	'tailwind': [
		{ title: 'Tailwind CSS Documentation', platform: 'Documentation', url: 'https://tailwindcss.com/docs', type: 'docs', free: true },
		{ title: 'Tailwind CSS From Scratch', platform: 'Udemy', url: 'https://www.udemy.com/course/tailwind-from-scratch/', type: 'course', free: false, duration: '12 hours', level: 'beginner' }
	],

	// Backend
	'node.js': [
		{ title: 'Node.js, Express, MongoDB & More', platform: 'Udemy', url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/', type: 'course', free: false, duration: '42 hours', level: 'intermediate' },
		{ title: 'Node.js Documentation', platform: 'Documentation', url: 'https://nodejs.org/en/docs/', type: 'docs', free: true },
		{ title: 'Back End Development and APIs', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/back-end-development-and-apis/', type: 'certification', free: true, duration: '300 hours', level: 'beginner' }
	],
	'express': [
		{ title: 'Express.js Documentation', platform: 'Documentation', url: 'https://expressjs.com/', type: 'docs', free: true },
		{ title: 'Node.js, Express, MongoDB & More', platform: 'Udemy', url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/', type: 'course', free: false, duration: '42 hours', level: 'intermediate' }
	],
	'django': [
		{ title: 'Django for Everybody', platform: 'Coursera', url: 'https://www.coursera.org/specializations/django', type: 'certification', free: false, duration: '3 months', level: 'intermediate' },
		{ title: 'Django Documentation', platform: 'Documentation', url: 'https://docs.djangoproject.com/', type: 'docs', free: true }
	],
	'fastapi': [
		{ title: 'FastAPI Documentation', platform: 'Documentation', url: 'https://fastapi.tiangolo.com/', type: 'docs', free: true },
		{ title: 'FastAPI Full Course', platform: 'YouTube', url: 'https://www.youtube.com/watch?v=0sOvCWFmrtA', type: 'tutorial', free: true, duration: '6 hours', level: 'beginner' }
	],

	// Databases
	'sql': [
		{ title: 'The Complete SQL Bootcamp', platform: 'Udemy', url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/', type: 'course', free: false, duration: '9 hours', level: 'beginner' },
		{ title: 'Relational Database', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/relational-database/', type: 'certification', free: true, duration: '300 hours', level: 'beginner' }
	],
	'postgresql': [
		{ title: 'PostgreSQL Tutorial', platform: 'Documentation', url: 'https://www.postgresql.org/docs/current/tutorial.html', type: 'docs', free: true },
		{ title: 'SQL and PostgreSQL: The Complete Developer Guide', platform: 'Udemy', url: 'https://www.udemy.com/course/sql-and-postgresql/', type: 'course', free: false, duration: '22 hours', level: 'intermediate' }
	],
	'mongodb': [
		{ title: 'MongoDB University', platform: 'Documentation', url: 'https://university.mongodb.com/', type: 'certification', free: true },
		{ title: 'MongoDB - The Complete Developer Guide', platform: 'Udemy', url: 'https://www.udemy.com/course/mongodb-the-complete-developers-guide/', type: 'course', free: false, duration: '17 hours', level: 'intermediate' }
	],
	'redis': [
		{ title: 'Redis University', platform: 'Documentation', url: 'https://university.redis.com/', type: 'certification', free: true },
		{ title: 'Redis Documentation', platform: 'Documentation', url: 'https://redis.io/docs/', type: 'docs', free: true }
	],

	// Cloud
	'aws': [
		{ title: 'AWS Certified Cloud Practitioner', platform: 'Coursera', url: 'https://www.coursera.org/professional-certificates/aws-cloud-practitioner', type: 'certification', free: false, duration: '4 months', level: 'beginner' },
		{ title: 'AWS Cloud Practitioner Essentials', platform: 'Documentation', url: 'https://aws.amazon.com/training/digital/aws-cloud-practitioner-essentials/', type: 'course', free: true, duration: '6 hours', level: 'beginner' }
	],
	'azure': [
		{ title: 'Azure Fundamentals', platform: 'Documentation', url: 'https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/', type: 'certification', free: true, level: 'beginner' },
		{ title: 'AZ-900 Azure Fundamentals', platform: 'Udemy', url: 'https://www.udemy.com/course/az900-azure/', type: 'course', free: false, duration: '11 hours', level: 'beginner' }
	],
	'gcp': [
		{ title: 'Google Cloud Fundamentals', platform: 'Coursera', url: 'https://www.coursera.org/learn/gcp-fundamentals', type: 'course', free: false, duration: '15 hours', level: 'beginner' },
		{ title: 'Google Cloud Skills Boost', platform: 'Documentation', url: 'https://www.cloudskillsboost.google/', type: 'tutorial', free: true }
	],
	'docker': [
		{ title: 'Docker Mastery', platform: 'Udemy', url: 'https://www.udemy.com/course/docker-mastery/', type: 'course', free: false, duration: '20 hours', level: 'intermediate' },
		{ title: 'Docker Documentation', platform: 'Documentation', url: 'https://docs.docker.com/get-started/', type: 'docs', free: true }
	],
	'kubernetes': [
		{ title: 'Kubernetes for Developers', platform: 'Coursera', url: 'https://www.coursera.org/learn/kubernetes-for-developers', type: 'course', free: false, duration: '20 hours', level: 'intermediate' },
		{ title: 'Kubernetes Documentation', platform: 'Documentation', url: 'https://kubernetes.io/docs/tutorials/', type: 'docs', free: true }
	],
	'terraform': [
		{ title: 'HashiCorp Terraform Associate', platform: 'Documentation', url: 'https://developer.hashicorp.com/terraform/tutorials', type: 'certification', free: true },
		{ title: 'Terraform Course', platform: 'YouTube', url: 'https://www.youtube.com/watch?v=SLB_c_ayRMo', type: 'tutorial', free: true, duration: '3 hours', level: 'beginner' }
	],

	// Data Science & ML
	'machine learning': [
		{ title: 'Machine Learning Specialization', platform: 'Coursera', url: 'https://www.coursera.org/specializations/machine-learning-introduction', type: 'certification', free: false, duration: '3 months', level: 'beginner' },
		{ title: 'Machine Learning with Python', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/machine-learning-with-python/', type: 'certification', free: true, duration: '300 hours', level: 'intermediate' }
	],
	'deep learning': [
		{ title: 'Deep Learning Specialization', platform: 'Coursera', url: 'https://www.coursera.org/specializations/deep-learning', type: 'certification', free: false, duration: '5 months', level: 'intermediate' },
		{ title: 'Practical Deep Learning', platform: 'Documentation', url: 'https://course.fast.ai/', type: 'course', free: true, duration: '30 hours', level: 'intermediate' }
	],
	'tensorflow': [
		{ title: 'TensorFlow Developer Certificate', platform: 'Coursera', url: 'https://www.coursera.org/professional-certificates/tensorflow-in-practice', type: 'certification', free: false, duration: '4 months', level: 'intermediate' },
		{ title: 'TensorFlow Documentation', platform: 'Documentation', url: 'https://www.tensorflow.org/tutorials', type: 'docs', free: true }
	],
	'pytorch': [
		{ title: 'PyTorch for Deep Learning', platform: 'Udemy', url: 'https://www.udemy.com/course/pytorch-for-deep-learning-with-python-bootcamp/', type: 'course', free: false, duration: '17 hours', level: 'intermediate' },
		{ title: 'PyTorch Tutorials', platform: 'Documentation', url: 'https://pytorch.org/tutorials/', type: 'docs', free: true }
	],
	'pandas': [
		{ title: 'Data Analysis with Python', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org/learn/data-analysis-with-python/', type: 'certification', free: true, duration: '300 hours', level: 'beginner' },
		{ title: 'Pandas Documentation', platform: 'Documentation', url: 'https://pandas.pydata.org/docs/getting_started/index.html', type: 'docs', free: true }
	],

	// DevOps
	'ci/cd': [
		{ title: 'DevOps with GitLab CI', platform: 'Udemy', url: 'https://www.udemy.com/course/gitlab-ci-pipelines-ci-cd-and-devops-for-beginners/', type: 'course', free: false, duration: '7 hours', level: 'beginner' },
		{ title: 'GitHub Actions Documentation', platform: 'Documentation', url: 'https://docs.github.com/en/actions', type: 'docs', free: true }
	],
	'github actions': [
		{ title: 'GitHub Actions Documentation', platform: 'Documentation', url: 'https://docs.github.com/en/actions/learn-github-actions', type: 'docs', free: true },
		{ title: 'GitHub Actions - The Complete Guide', platform: 'Udemy', url: 'https://www.udemy.com/course/github-actions-the-complete-guide/', type: 'course', free: false, duration: '10 hours', level: 'beginner' }
	],
	'linux': [
		{ title: 'Linux Command Line Basics', platform: 'Udemy', url: 'https://www.udemy.com/course/linux-mastery/', type: 'course', free: false, duration: '12 hours', level: 'beginner' },
		{ title: 'Linux Journey', platform: 'Documentation', url: 'https://linuxjourney.com/', type: 'tutorial', free: true, level: 'beginner' }
	],

	// Design
	'figma': [
		{ title: 'Figma Tutorial', platform: 'YouTube', url: 'https://www.youtube.com/watch?v=FTFaQWZBqQ8', type: 'tutorial', free: true, duration: '3 hours', level: 'beginner' },
		{ title: 'Figma Help Center', platform: 'Documentation', url: 'https://help.figma.com/', type: 'docs', free: true }
	],
	'ui/ux': [
		{ title: 'Google UX Design Professional Certificate', platform: 'Coursera', url: 'https://www.coursera.org/professional-certificates/google-ux-design', type: 'certification', free: false, duration: '6 months', level: 'beginner' },
		{ title: 'UI/UX Design Specialization', platform: 'Coursera', url: 'https://www.coursera.org/specializations/ui-ux-design', type: 'certification', free: false, duration: '4 months', level: 'beginner' }
	],

	// Soft Skills & Management
	'project management': [
		{ title: 'Google Project Management Certificate', platform: 'Coursera', url: 'https://www.coursera.org/professional-certificates/google-project-management', type: 'certification', free: false, duration: '6 months', level: 'beginner' },
		{ title: 'PMP Certification Prep', platform: 'LinkedIn Learning', url: 'https://www.linkedin.com/learning/paths/prepare-for-the-pmp-certification-exam', type: 'certification', free: false, duration: '20 hours', level: 'intermediate' }
	],
	'agile': [
		{ title: 'Agile with Atlassian Jira', platform: 'Coursera', url: 'https://www.coursera.org/learn/agile-atlassian-jira', type: 'course', free: false, duration: '12 hours', level: 'beginner' },
		{ title: 'Agile Manifesto', platform: 'Documentation', url: 'https://agilemanifesto.org/', type: 'docs', free: true }
	],
	'scrum': [
		{ title: 'Scrum Master Certification', platform: 'Coursera', url: 'https://www.coursera.org/learn/scrum-master-certification', type: 'certification', free: false, duration: '15 hours', level: 'beginner' },
		{ title: 'Scrum Guide', platform: 'Documentation', url: 'https://scrumguides.org/', type: 'docs', free: true }
	],
	'leadership': [
		{ title: 'Leadership and Management', platform: 'LinkedIn Learning', url: 'https://www.linkedin.com/learning/topics/leadership-and-management', type: 'course', free: false, level: 'intermediate' },
		{ title: 'Leading People and Teams Specialization', platform: 'Coursera', url: 'https://www.coursera.org/specializations/leading-teams', type: 'certification', free: false, duration: '5 months', level: 'intermediate' }
	]
};

/**
 * Get learning resources for a specific skill
 */
export function getResourcesForSkill(skill: string): SkillResources | null {
	const normalizedSkill = skill.toLowerCase().trim();

	// Direct match
	if (SKILL_RESOURCES[normalizedSkill]) {
		return {
			skill,
			resources: SKILL_RESOURCES[normalizedSkill]
		};
	}

	// Partial match (e.g., "React.js" matches "react")
	for (const [key, resources] of Object.entries(SKILL_RESOURCES)) {
		if (normalizedSkill.includes(key) || key.includes(normalizedSkill)) {
			return {
				skill,
				resources
			};
		}
	}

	// Try to find by category and return generic resources
	for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
		if (skills.some(s => normalizedSkill.includes(s) || s.includes(normalizedSkill))) {
			// Return first available resource from same category
			for (const catSkill of skills) {
				if (SKILL_RESOURCES[catSkill]) {
					return {
						skill,
						resources: SKILL_RESOURCES[catSkill].slice(0, 2)
					};
				}
			}
		}
	}

	return null;
}

/**
 * Get learning resources for multiple skills
 */
export function getResourcesForSkills(skills: string[]): SkillResources[] {
	const results: SkillResources[] = [];
	const seen = new Set<string>();

	for (const skill of skills) {
		const normalizedSkill = skill.toLowerCase().trim();
		if (seen.has(normalizedSkill)) continue;
		seen.add(normalizedSkill);

		const resources = getResourcesForSkill(skill);
		if (resources) {
			results.push(resources);
		}
	}

	return results;
}

/**
 * Get top free resources for a set of skills
 */
export function getTopFreeResources(skills: string[], limit: number = 5): LearningResource[] {
	const allResources: LearningResource[] = [];

	for (const skill of skills) {
		const skillResources = getResourcesForSkill(skill);
		if (skillResources) {
			const freeResources = skillResources.resources.filter(r => r.free);
			allResources.push(...freeResources);
		}
	}

	// Dedupe by URL
	const seen = new Set<string>();
	const unique = allResources.filter(r => {
		if (seen.has(r.url)) return false;
		seen.add(r.url);
		return true;
	});

	return unique.slice(0, limit);
}

/**
 * Get certification paths for career advancement
 */
export function getCertificationPaths(skills: string[]): LearningResource[] {
	const certifications: LearningResource[] = [];

	for (const skill of skills) {
		const skillResources = getResourcesForSkill(skill);
		if (skillResources) {
			const certs = skillResources.resources.filter(r => r.type === 'certification');
			certifications.push(...certs);
		}
	}

	// Dedupe by URL
	const seen = new Set<string>();
	return certifications.filter(r => {
		if (seen.has(r.url)) return false;
		seen.add(r.url);
		return true;
	});
}
