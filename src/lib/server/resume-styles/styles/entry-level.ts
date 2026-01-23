import type { ResumeStyle } from '../types';

/**
 * Entry-Level Resume Style
 * Best for: Students, Recent Graduates, Career Changers
 *
 * Clean, education-focused design that highlights academic
 * achievements, projects, and transferable skills.
 */
export const entryLevelStyle: ResumeStyle = {
	id: 'entry-level',
	name: 'Entry Level',
	description: 'Education-focused design for students and recent graduates',
	longDescription:
		'A fresh, clean resume style optimized for students, recent graduates, and early-career professionals. Places education first, highlights academic projects, coursework, and extracurricular activities to demonstrate potential when work experience is limited.',
	industries: ['entry', 'student', 'recent-grad'],
	experienceLevels: ['entry'],
	sections: [
		{
			id: 'contact',
			name: 'Contact Information',
			required: true,
			order: 1,
			formatInstructions:
				'Name, phone, professional email (not party123@...), LinkedIn, location (city, state is fine)'
		},
		{
			id: 'summary',
			name: 'Objective',
			required: false,
			order: 2,
			formatInstructions:
				'Brief 2-sentence objective stating the role you seek and what you bring. Optional - only if truly adds value.'
		},
		{
			id: 'education',
			name: 'Education',
			required: true,
			order: 3,
			prominent: true,
			formatInstructions:
				'Degree, major/minor, institution, expected/actual graduation date. Include GPA if 3.0+, honors, Dean\'s List. Study abroad if relevant.'
		},
		{
			id: 'coursework',
			name: 'Relevant Coursework',
			required: false,
			order: 4,
			formatInstructions: '6-10 relevant courses, especially for technical or specialized roles'
		},
		{
			id: 'projects',
			name: 'Academic & Personal Projects',
			required: true,
			order: 5,
			prominent: true,
			maxItems: 4,
			formatInstructions:
				'Class projects, capstone, thesis, personal projects. Include: project name, context (class/personal), your role, technologies used, outcome. Link to demos if available.'
		},
		{
			id: 'experience',
			name: 'Experience',
			required: true,
			order: 6,
			maxItems: 4,
			formatInstructions:
				'Internships, part-time jobs, co-ops, research positions. Focus on transferable skills: communication, teamwork, problem-solving, leadership. Any experience counts!'
		},
		{
			id: 'skills',
			name: 'Skills',
			required: true,
			order: 7,
			formatInstructions:
				'Technical skills (software, languages, tools) and soft skills. Be honest about proficiency levels.'
		},
		{
			id: 'activities',
			name: 'Activities & Leadership',
			required: false,
			order: 8,
			maxItems: 5,
			formatInstructions:
				'Student organizations, clubs, volunteer work, sports teams. Highlight leadership roles and achievements.'
		},
		{
			id: 'certifications',
			name: 'Certifications',
			required: false,
			order: 9,
			formatInstructions: 'Online courses, certifications, bootcamps, workshops'
		}
	],
	typography: {
		bodyFont: 'calibri',
		headingFont: 'calibri',
		baseFontSize: 11,
		lineHeight: 1.4,
		headingSizes: {
			h1: 1.8,
			h2: 1.2,
			h3: 1.0
		},
		boldHeadings: true,
		uppercaseHeadings: true
	},
	colors: {
		primary: '#1f2937',
		secondary: '#6b7280',
		accent: '#2563eb',
		background: '#ffffff',
		border: '#d1d5db',
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
		useHorizontalRules: true,
		bulletStyle: 'disc',
		dateFormat: 'month-year',
		contactLayout: 'horizontal'
	},
	atsOptimized: true,
	formatInstructions: `
Generate an entry-level resume following these guidelines:
- Lead with education since it's your strongest qualification
- Include GPA if 3.0 or above
- Feature academic projects prominently - treat them like work experience
- For each project, explain: what it was, your role, technologies used, outcome
- Transform any experience into professional language:
  - Retail job → customer service, problem-solving, cash handling
  - Group project → collaboration, deadline management
  - Club officer → leadership, event planning, budget management
- Use action verbs even for non-traditional experience
- Include relevant coursework for technical positions
- Extracurriculars show personality and leadership - include them!
- Keep to 1 page - this is crucial for entry-level
- Avoid objectives unless they add specific value
- Focus on potential and eagerness to learn
- Quantify when possible (even if small numbers)
`,
	previewImage: '/resume-styles/entry-level-preview.svg',
	tags: ['entry-level', 'student', 'graduate', 'education', 'clean', 'first-job'],
	premium: false
};
