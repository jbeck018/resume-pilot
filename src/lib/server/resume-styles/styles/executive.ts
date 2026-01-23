import type { ResumeStyle } from '../types';

/**
 * Executive Resume Style
 * Best for: C-Suite, VP, Senior Leadership, Board Members
 *
 * Premium, sophisticated design with subtle accent colors,
 * emphasis on leadership achievements and strategic impact.
 */
export const executiveStyle: ResumeStyle = {
	id: 'executive',
	name: 'Executive Leadership',
	description: 'Sophisticated design for C-suite and senior leadership positions',
	longDescription:
		'A premium, distinguished resume style crafted for senior executives and leadership positions. Features refined typography, subtle navy/burgundy accents, and strategic emphasis on leadership achievements, P&L impact, and organizational transformation.',
	industries: ['executive', 'leadership', 'corporate', 'consulting'],
	experienceLevels: ['senior', 'executive'],
	sections: [
		{
			id: 'contact',
			name: 'Contact Information',
			required: true,
			order: 1,
			formatInstructions:
				'Name prominently at top with executive title. Contact details elegantly arranged. Include LinkedIn.'
		},
		{
			id: 'summary',
			name: 'Executive Profile',
			required: true,
			order: 2,
			prominent: true,
			formatInstructions:
				'4-5 sentences capturing leadership philosophy, scope of responsibility (P&L size, team size, global reach), and signature achievements.'
		},
		{
			id: 'achievements',
			name: 'Key Achievements',
			required: true,
			order: 3,
			prominent: true,
			maxItems: 5,
			formatInstructions:
				'Bullet points highlighting career-defining accomplishments with significant metrics (revenue growth, cost reduction, market expansion, M&A).'
		},
		{
			id: 'experience',
			name: 'Leadership Experience',
			required: true,
			order: 4,
			maxItems: 4,
			formatInstructions:
				'Focus on scope (revenue, headcount, geography), strategic initiatives, organizational transformation, and measurable business outcomes.'
		},
		{
			id: 'board_positions',
			name: 'Board & Advisory Roles',
			required: false,
			order: 5,
			formatInstructions:
				'Current and past board memberships, advisory roles, committee chairs. Include organization type and your role.'
		},
		{
			id: 'education',
			name: 'Education',
			required: true,
			order: 6,
			formatInstructions:
				'MBA and advanced degrees. Executive education programs (Harvard, Wharton, etc.). Include years.'
		},
		{
			id: 'certifications',
			name: 'Professional Development',
			required: false,
			order: 7,
			formatInstructions: 'Executive certifications, leadership programs, industry credentials'
		},
		{
			id: 'activities',
			name: 'Industry Leadership',
			required: false,
			order: 8,
			formatInstructions:
				'Industry associations, speaking engagements, publications, thought leadership'
		}
	],
	typography: {
		bodyFont: 'garamond',
		headingFont: 'garamond',
		baseFontSize: 11,
		lineHeight: 1.45,
		headingSizes: {
			h1: 2.0,
			h2: 1.25,
			h3: 1.1
		},
		boldHeadings: true,
		uppercaseHeadings: true
	},
	colors: {
		primary: '#1a1a2e',
		secondary: '#4a4a5a',
		accent: '#16213e',
		background: '#ffffff',
		border: '#c9c9c9',
		coloredHeaders: true
	},
	layout: {
		type: 'single-column',
		margins: {
			top: 0.75,
			right: 0.85,
			bottom: 0.75,
			left: 0.85
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
Generate an executive resume following these guidelines:
- Open with a powerful executive profile summarizing leadership scope and impact
- Lead with key achievements that demonstrate executive-level impact
- Quantify everything: revenue, P&L, headcount, market share, cost savings
- Use language appropriate for board and C-suite audiences
- Focus on strategic vision, organizational transformation, and business outcomes
- Include scope indicators: geography (global/regional), revenue responsibility, team size
- Highlight M&A, turnaround, growth, or transformation experience
- Show progression and increasing scope of responsibility
- Include board positions and advisory roles prominently
- Keep to 2 pages - executives warrant more space
- Avoid tactical details - focus on strategic impact
- Use executive vocabulary: drove, led, transformed, orchestrated, spearheaded
`,
	previewImage: '/resume-styles/executive-preview.svg',
	tags: ['executive', 'leadership', 'c-suite', 'premium', 'strategic', 'sophisticated'],
	premium: true
};
