import type { ResumeStyle } from '../types';

/**
 * Academic Resume Style (CV Format)
 * Best for: Research, Education, Academia, PhD positions
 *
 * Comprehensive curriculum vitae format with publications,
 * research, teaching, and academic service sections.
 */
export const academicStyle: ResumeStyle = {
	id: 'academic',
	name: 'Academic CV',
	description: 'Comprehensive CV format for research and academic positions',
	longDescription:
		'A traditional academic curriculum vitae format designed for researchers, professors, and academic positions. Features comprehensive sections for publications, research experience, teaching, and academic service. Length is typically 3+ pages as appropriate for academic CVs.',
	industries: ['academic', 'research', 'education'],
	experienceLevels: ['entry', 'mid', 'senior'],
	sections: [
		{
			id: 'contact',
			name: 'Contact Information',
			required: true,
			order: 1,
			formatInstructions:
				'Name, institutional affiliation, department, office address, email, phone. Include ORCID and Google Scholar if available.'
		},
		{
			id: 'education',
			name: 'Education',
			required: true,
			order: 2,
			prominent: true,
			formatInstructions:
				'All degrees in reverse chronological order. Include institution, degree, field, year, dissertation/thesis title, advisor name.'
		},
		{
			id: 'research',
			name: 'Research Interests',
			required: true,
			order: 3,
			formatInstructions: 'Brief paragraph or bullet points describing research areas and interests'
		},
		{
			id: 'experience',
			name: 'Academic Positions',
			required: true,
			order: 4,
			formatInstructions:
				'All academic appointments: faculty positions, postdocs, visiting positions. Include institution, title, department, dates.'
		},
		{
			id: 'publications',
			name: 'Publications',
			required: true,
			order: 5,
			prominent: true,
			formatInstructions:
				'Full citation format. Organize by type: Peer-Reviewed Journal Articles, Conference Papers, Book Chapters, Books, Working Papers. Include citation counts or impact factors if notable.',
			subsections: [
				'Peer-Reviewed Journal Articles',
				'Conference Papers',
				'Book Chapters',
				'Books',
				'Working Papers'
			]
		},
		{
			id: 'presentations',
			name: 'Presentations',
			required: false,
			order: 6,
			formatInstructions:
				'Conference presentations, invited talks, seminars. Include conference/venue name, location, date.',
			subsections: ['Invited Talks', 'Conference Presentations', 'Seminars']
		},
		{
			id: 'teaching',
			name: 'Teaching Experience',
			required: true,
			order: 7,
			formatInstructions:
				'Courses taught as instructor of record, TA positions. Include course name, number, level, enrollment, institution.',
			subsections: ['Instructor of Record', 'Teaching Assistant']
		},
		{
			id: 'awards',
			name: 'Grants, Honors & Awards',
			required: false,
			order: 8,
			formatInstructions: 'Research grants (include amounts), fellowships, honors, awards. Include year.',
			subsections: ['Research Grants', 'Fellowships', 'Awards & Honors']
		},
		{
			id: 'service',
			name: 'Academic Service',
			required: false,
			order: 9,
			formatInstructions:
				'Journal reviewing, conference organizing, committee service, departmental service.',
			subsections: ['Journal Reviewing', 'Conference Service', 'Departmental Service']
		},
		{
			id: 'skills',
			name: 'Skills & Methods',
			required: false,
			order: 10,
			formatInstructions:
				'Research methods, statistical software, programming languages, lab techniques, languages'
		},
		{
			id: 'references',
			name: 'References',
			required: false,
			order: 11,
			formatInstructions: 'Available upon request or list 3-4 references with contact information'
		}
	],
	typography: {
		bodyFont: 'times',
		headingFont: 'times',
		baseFontSize: 11,
		lineHeight: 1.4,
		headingSizes: {
			h1: 1.8,
			h2: 1.2,
			h3: 1.05
		},
		boldHeadings: true,
		uppercaseHeadings: true
	},
	colors: {
		primary: '#1a1a1a',
		secondary: '#4a4a4a',
		accent: '#1a1a1a',
		background: '#ffffff',
		border: '#999999',
		coloredHeaders: false
	},
	layout: {
		type: 'single-column',
		margins: {
			top: 1.0,
			right: 1.0,
			bottom: 1.0,
			left: 1.0
		},
		sectionSpacing: 18,
		maxPages: 10,
		useHorizontalRules: false,
		bulletStyle: 'none',
		dateFormat: 'full',
		contactLayout: 'vertical'
	},
	atsOptimized: true,
	formatInstructions: `
Generate an academic CV following these guidelines:
- Use formal academic conventions throughout
- List ALL publications in proper citation format (author names, title, journal, year, pages)
- Include DOI numbers for publications when available
- Organize publications by type: journal articles, conference papers, book chapters, etc.
- Include citation counts or h-index if notable
- List teaching experience with course numbers and enrollment
- Include grant amounts for funded research
- Service and reviewing should be comprehensive
- Dates should be specific (Month Year format)
- Academic CVs are expected to be comprehensive - length is less important than completeness
- Use standard academic terminology and formatting conventions
- Include advisor names and dissertation/thesis titles for degrees
- Note if publications are peer-reviewed, invited, or under review
`,
	previewImage: '/resume-styles/academic-preview.svg',
	tags: ['academic', 'cv', 'research', 'publications', 'comprehensive', 'education'],
	premium: false
};
