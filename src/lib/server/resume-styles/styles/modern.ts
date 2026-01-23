import type { ResumeStyle } from '../types';

/**
 * Modern Resume Style
 * Best for: Tech, Startups, Software Development
 *
 * Clean, contemporary design with sans-serif fonts,
 * subtle accent colors, and emphasis on skills and projects.
 */
export const modernStyle: ResumeStyle = {
	id: 'modern',
	name: 'Modern Tech',
	description: 'Clean, contemporary design for tech and startup environments',
	longDescription:
		'A sleek, modern resume style with clean sans-serif typography and strategic use of color accents. Optimized for tech companies and startups where skills and projects are valued alongside experience.',
	industries: ['tech', 'startup', 'software', 'data'],
	experienceLevels: ['entry', 'mid', 'senior'],
	sections: [
		{
			id: 'contact',
			name: 'Contact',
			required: true,
			order: 1,
			formatInstructions:
				'Name prominently displayed, followed by email, phone, LinkedIn, GitHub, and portfolio links on one line'
		},
		{
			id: 'summary',
			name: 'Summary',
			required: true,
			order: 2,
			formatInstructions:
				'2-3 sentences focusing on technical expertise, impact, and what you bring to the team'
		},
		{
			id: 'skills',
			name: 'Technical Skills',
			required: true,
			order: 3,
			prominent: true,
			formatInstructions:
				'Categorized by type: Languages, Frameworks, Tools, Cloud/Infrastructure, Databases, etc.'
		},
		{
			id: 'experience',
			name: 'Experience',
			required: true,
			order: 4,
			maxItems: 4,
			formatInstructions:
				'Focus on technical achievements, impact metrics, and technologies used. Include scale (users, transactions, data size) where relevant.'
		},
		{
			id: 'projects',
			name: 'Projects',
			required: false,
			order: 5,
			maxItems: 3,
			formatInstructions:
				'Include personal projects, open source contributions, or side projects. Link to GitHub/demo if available.'
		},
		{
			id: 'education',
			name: 'Education',
			required: true,
			order: 6,
			formatInstructions:
				'Degree and institution. Include relevant coursework or thesis only if recent graduate.'
		},
		{
			id: 'certifications',
			name: 'Certifications',
			required: false,
			order: 7,
			formatInstructions: 'Cloud certs (AWS, GCP, Azure), professional certifications'
		}
	],
	typography: {
		bodyFont: 'inter',
		headingFont: 'inter',
		baseFontSize: 10,
		lineHeight: 1.5,
		headingSizes: {
			h1: 1.8,
			h2: 1.2,
			h3: 1.05
		},
		boldHeadings: true,
		uppercaseHeadings: true
	},
	colors: {
		primary: '#1f2937',
		secondary: '#6b7280',
		accent: '#3b82f6',
		background: '#ffffff',
		border: '#e5e7eb',
		coloredHeaders: true
	},
	layout: {
		type: 'single-column',
		margins: {
			top: 0.5,
			right: 0.6,
			bottom: 0.5,
			left: 0.6
		},
		sectionSpacing: 12,
		maxPages: 1,
		useHorizontalRules: false,
		bulletStyle: 'disc',
		dateFormat: 'short',
		contactLayout: 'horizontal'
	},
	atsOptimized: true,
	formatInstructions: `
Generate a modern tech resume following these guidelines:
- Lead with technical skills prominently displayed
- Use concise, impactful language
- Emphasize measurable outcomes (performance improvements, cost savings, scale)
- Include relevant technologies used for each role/project
- Link to GitHub, portfolio, or live demos where applicable
- Keep to 1 page if possible (max 2 for senior roles)
- Use tech industry terminology appropriately
- Focus on problem-solving and innovation
- Highlight collaboration and communication alongside technical skills
- Structure skills by category: Languages, Frameworks, Tools, Cloud, etc.
`,
	previewImage: '/resume-styles/modern-preview.svg',
	tags: ['tech', 'startup', 'clean', 'minimal', 'ats-friendly', 'skills-focused'],
	premium: false
};
