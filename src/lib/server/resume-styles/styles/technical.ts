import type { ResumeStyle } from '../types';

/**
 * Technical Resume Style
 * Best for: Engineering, IT, Data Science, DevOps, Security
 *
 * Skills-forward design with prominent technical skills section,
 * GitHub/projects emphasis, and metrics-driven achievements.
 */
export const technicalStyle: ResumeStyle = {
	id: 'technical',
	name: 'Technical Engineer',
	description: 'Skills-prominent design for engineering and technical roles',
	longDescription:
		'A technically-focused resume style that puts skills and projects front and center. Optimized for engineers, data scientists, DevOps professionals, and technical roles where demonstrable technical competence is the primary evaluation criteria.',
	industries: ['engineering', 'it', 'cybersecurity', 'data', 'software'],
	experienceLevels: ['entry', 'mid', 'senior'],
	sections: [
		{
			id: 'contact',
			name: 'Contact & Profiles',
			required: true,
			order: 1,
			formatInstructions:
				'Name, email, phone, location. MUST include GitHub profile and LinkedIn. Optional: personal site, Stack Overflow.'
		},
		{
			id: 'skills',
			name: 'Technical Skills',
			required: true,
			order: 2,
			prominent: true,
			formatInstructions: `Organize by category:
- Languages: Python, Java, TypeScript, Go, Rust, etc.
- Frameworks: React, Django, Spring Boot, etc.
- Cloud & Infrastructure: AWS, GCP, Azure, Kubernetes, Docker, Terraform
- Databases: PostgreSQL, MongoDB, Redis, Elasticsearch
- Tools: Git, CI/CD, monitoring, etc.`
		},
		{
			id: 'experience',
			name: 'Professional Experience',
			required: true,
			order: 3,
			maxItems: 4,
			formatInstructions:
				'Focus on technical scope, system design decisions, performance metrics, scale. Include tech stack used. Quantify: latency, throughput, users, data volume.'
		},
		{
			id: 'projects',
			name: 'Projects',
			required: true,
			order: 4,
			prominent: true,
			maxItems: 4,
			formatInstructions:
				'Open source contributions, personal projects, hackathon projects. Include: problem solved, tech stack, link to repo/demo, impact/stars.'
		},
		{
			id: 'education',
			name: 'Education',
			required: true,
			order: 5,
			formatInstructions:
				'Degree, institution, year. Include relevant coursework for recent grads: algorithms, systems, ML, security.'
		},
		{
			id: 'certifications',
			name: 'Certifications',
			required: false,
			order: 6,
			formatInstructions:
				'Cloud: AWS SAA, GCP Professional, Azure. Security: CISSP, CEH. Other: Kubernetes CKA/CKAD'
		},
		{
			id: 'publications',
			name: 'Publications & Talks',
			required: false,
			order: 7,
			formatInstructions: 'Technical blog posts, conference talks, research papers'
		}
	],
	typography: {
		bodyFont: 'roboto',
		headingFont: 'roboto',
		baseFontSize: 10,
		lineHeight: 1.4,
		headingSizes: {
			h1: 1.7,
			h2: 1.15,
			h3: 1.0
		},
		boldHeadings: true,
		uppercaseHeadings: true
	},
	colors: {
		primary: '#1e293b',
		secondary: '#64748b',
		accent: '#0ea5e9',
		background: '#ffffff',
		border: '#e2e8f0',
		coloredHeaders: true
	},
	layout: {
		type: 'single-column',
		margins: {
			top: 0.5,
			right: 0.5,
			bottom: 0.5,
			left: 0.5
		},
		sectionSpacing: 10,
		maxPages: 1,
		useHorizontalRules: false,
		bulletStyle: 'disc',
		dateFormat: 'short',
		contactLayout: 'horizontal'
	},
	atsOptimized: true,
	formatInstructions: `
Generate a technical resume following these guidelines:
- Lead with comprehensive technical skills organized by category
- GitHub profile MUST be included - this is often the first thing checked
- Include relevant projects with links to repos or demos
- Quantify technical achievements: latency improvements, throughput, scale, uptime
- Use specific technical terminology and version numbers where relevant
- Highlight system design and architecture experience for senior roles
- Include open source contributions with stars/downloads if notable
- Focus on problem-solving and technical decision-making
- Keep to 1 page - technical hiring managers prefer density
- Use code-adjacent terminology naturally
- Include cloud certifications prominently
- Mention specific tools and technologies for each role
`,
	previewImage: '/resume-styles/technical-preview.svg',
	tags: ['technical', 'engineering', 'skills-first', 'github', 'projects', 'ats-friendly'],
	premium: false
};
