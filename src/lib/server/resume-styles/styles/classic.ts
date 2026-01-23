import type { ResumeStyle } from '../types';

/**
 * Classic Resume Style
 * Best for: Corporate, Finance, Legal, Consulting
 *
 * Traditional, conservative design with serif fonts and
 * neutral colors. Single-column layout with clear hierarchy.
 */
export const classicStyle: ResumeStyle = {
	id: 'classic',
	name: 'Classic Professional',
	description: 'Traditional design for corporate and conservative industries',
	longDescription:
		'A timeless, professional resume style featuring serif typography and a clean single-column layout. Perfect for corporate environments, financial institutions, law firms, and consulting agencies where traditional presentation is valued.',
	industries: ['corporate', 'finance', 'legal', 'consulting'],
	experienceLevels: ['mid', 'senior', 'executive'],
	sections: [
		{
			id: 'contact',
			name: 'Contact Information',
			required: true,
			order: 1,
			formatInstructions: 'Name centered at top, contact details on one line below'
		},
		{
			id: 'summary',
			name: 'Professional Summary',
			required: true,
			order: 2,
			formatInstructions: '3-4 sentences highlighting expertise and value proposition'
		},
		{
			id: 'experience',
			name: 'Professional Experience',
			required: true,
			order: 3,
			prominent: true,
			maxItems: 5,
			formatInstructions:
				'Reverse chronological. Company, title, dates. 3-5 bullet points per role with quantified achievements.'
		},
		{
			id: 'education',
			name: 'Education',
			required: true,
			order: 4,
			formatInstructions: 'Degree, institution, graduation year. Include honors if notable.'
		},
		{
			id: 'skills',
			name: 'Skills',
			required: false,
			order: 5,
			formatInstructions: 'Comma-separated list, grouped by category if extensive'
		},
		{
			id: 'certifications',
			name: 'Certifications & Licenses',
			required: false,
			order: 6,
			formatInstructions: 'Name, issuing organization, year obtained'
		}
	],
	typography: {
		bodyFont: 'georgia',
		headingFont: 'georgia',
		baseFontSize: 11,
		lineHeight: 1.4,
		headingSizes: {
			h1: 2.0,
			h2: 1.3,
			h3: 1.1
		},
		boldHeadings: true,
		uppercaseHeadings: false
	},
	colors: {
		primary: '#1a1a1a',
		secondary: '#4a4a4a',
		accent: '#2c3e50',
		background: '#ffffff',
		border: '#cccccc',
		coloredHeaders: false
	},
	layout: {
		type: 'single-column',
		margins: {
			top: 0.75,
			right: 0.75,
			bottom: 0.75,
			left: 0.75
		},
		sectionSpacing: 16,
		maxPages: 2,
		useHorizontalRules: true,
		bulletStyle: 'disc',
		dateFormat: 'month-year',
		contactLayout: 'centered'
	},
	atsOptimized: true,
	formatInstructions: `
Generate a classic, professional resume following these guidelines:
- Use formal, professional language throughout
- Keep sentences concise and impactful
- Start bullet points with strong action verbs
- Quantify achievements wherever possible (%, $, numbers)
- Maintain consistent tense (past for previous roles, present for current)
- Avoid personal pronouns (I, me, my)
- Use industry-standard terminology
- Keep to 1-2 pages maximum
- Ensure ATS compatibility with standard section headers
- No graphics, tables, or columns
`,
	previewImage: '/resume-styles/classic-preview.svg',
	tags: ['traditional', 'corporate', 'conservative', 'ats-friendly', 'professional'],
	premium: false
};
