import type { ResumeStyle } from '../types';

/**
 * Federal Resume Style
 * Best for: Government, USAJOBS, Federal positions, Military transition
 *
 * Strict government format with detailed job information,
 * hours per week, supervisor contact, and comprehensive duties.
 */
export const federalStyle: ResumeStyle = {
	id: 'federal',
	name: 'Federal Government',
	description: 'USAJOBS-compliant format for government positions',
	longDescription:
		'A USAJOBS-compliant resume format specifically designed for federal government positions. Includes all required elements: hours per week, supervisor information, salary, and detailed duties. Follows federal resume best practices and OPM guidelines.',
	industries: ['government', 'federal', 'military'],
	experienceLevels: ['entry', 'mid', 'senior'],
	sections: [
		{
			id: 'contact',
			name: 'Contact Information',
			required: true,
			order: 1,
			formatInstructions:
				'Full name, mailing address, phone (day and evening), email. Include citizenship status and veteran preference if applicable.'
		},
		{
			id: 'job_info',
			name: 'Job Information',
			required: true,
			order: 2,
			formatInstructions:
				'Announcement number, title of job, grade(s) applying for. This section references the specific position.'
		},
		{
			id: 'summary',
			name: 'Professional Summary',
			required: true,
			order: 3,
			formatInstructions:
				'Objective statement tailored to the specific position, highlighting qualifications that match the job requirements.'
		},
		{
			id: 'experience',
			name: 'Work Experience',
			required: true,
			order: 4,
			prominent: true,
			formatInstructions: `For EACH position, include ALL of the following:
- Job title (and series/grade if federal)
- Employer name and address
- Supervisor name and phone (indicate if may be contacted)
- Dates employed (MM/YYYY - MM/YYYY)
- Hours per week
- Salary
- Detailed duties and accomplishments (be comprehensive, use keywords from job announcement)`
		},
		{
			id: 'education',
			name: 'Education',
			required: true,
			order: 5,
			formatInstructions:
				'Institution name and address, degree, major, year graduated. Include GPA if above 3.0 or within 2 years of graduation. List relevant coursework for entry-level.'
		},
		{
			id: 'skills',
			name: 'Knowledge, Skills & Abilities (KSAs)',
			required: true,
			order: 6,
			prominent: true,
			formatInstructions:
				'Address each KSA from the job announcement with specific examples. Use CCAR format: Context, Challenge, Action, Result.'
		},
		{
			id: 'certifications',
			name: 'Certifications & Licenses',
			required: false,
			order: 7,
			formatInstructions: 'License/certification name, issuing agency, date obtained, expiration date'
		},
		{
			id: 'awards',
			name: 'Awards & Recognitions',
			required: false,
			order: 8,
			formatInstructions: 'Award name, granting organization, date, brief description of why received'
		},
		{
			id: 'languages',
			name: 'Language Skills',
			required: false,
			order: 9,
			formatInstructions: 'Language, proficiency level (speaking, reading, writing)'
		},
		{
			id: 'references',
			name: 'References',
			required: false,
			order: 10,
			formatInstructions: '3-5 professional references with name, title, organization, phone, email'
		}
	],
	typography: {
		bodyFont: 'arial',
		headingFont: 'arial',
		baseFontSize: 11,
		lineHeight: 1.3,
		headingSizes: {
			h1: 1.6,
			h2: 1.2,
			h3: 1.0
		},
		boldHeadings: true,
		uppercaseHeadings: true
	},
	colors: {
		primary: '#000000',
		secondary: '#333333',
		accent: '#000000',
		background: '#ffffff',
		border: '#000000',
		coloredHeaders: false
	},
	layout: {
		type: 'single-column',
		margins: {
			top: 0.5,
			right: 0.5,
			bottom: 0.5,
			left: 0.5
		},
		sectionSpacing: 12,
		maxPages: 5,
		useHorizontalRules: false,
		bulletStyle: 'disc',
		dateFormat: 'full',
		contactLayout: 'vertical'
	},
	atsOptimized: true,
	formatInstructions: `
Generate a federal resume following STRICT USAJOBS guidelines:

REQUIRED for each work experience:
- Job title
- Employer name with full address
- Supervisor: [Name], [Phone], [May/May not contact]
- Start date - End date (MM/YYYY format)
- Hours per week: [XX]
- Salary: $[amount] per [hour/year]
- Series/Grade (if federal): [series]-[grade]

DUTIES section for each position should:
- Be 5-10 detailed bullet points
- Use action verbs at the start of each
- Include specific examples with quantifiable results
- Mirror language from the job announcement
- Address specialized experience requirements

KSAs/Competencies:
- Address each required KSA from the job announcement
- Use CCAR format (Context, Challenge, Action, Result)
- Provide specific examples with measurable outcomes

General requirements:
- Federal resumes are typically 2-5 pages - be comprehensive
- Include ALL required fields - omissions can disqualify
- Use keywords from the job announcement throughout
- Plain text format - no graphics or fancy formatting
- Dates must be in MM/YYYY format
- Include citizenship status
- Note veteran's preference if applicable
`,
	previewImage: '/resume-styles/federal-preview.svg',
	tags: ['federal', 'government', 'usajobs', 'comprehensive', 'compliance', 'military'],
	premium: false
};
