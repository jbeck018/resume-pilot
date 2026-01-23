import type { ResumeStyle } from '../types';

/**
 * Creative Resume Style
 * Best for: Design, Marketing, Media, Creative Industries
 *
 * Bold visual design with creative colors, unique typography,
 * and emphasis on portfolio work and creative achievements.
 */
export const creativeStyle: ResumeStyle = {
	id: 'creative',
	name: 'Creative Professional',
	description: 'Bold, visually distinctive design for creative industries',
	longDescription:
		'A visually striking resume style that showcases creativity while maintaining professionalism. Features bold typography, strategic color usage, and prominent portfolio links. Ideal for designers, marketers, and creative professionals.',
	industries: ['design', 'marketing', 'media', 'creative'],
	experienceLevels: ['entry', 'mid', 'senior'],
	sections: [
		{
			id: 'contact',
			name: 'Brand Header',
			required: true,
			order: 1,
			formatInstructions:
				'Name as a personal brand statement. Include tagline/specialty. Social links and portfolio prominently featured.'
		},
		{
			id: 'portfolio',
			name: 'Portfolio & Links',
			required: true,
			order: 2,
			prominent: true,
			formatInstructions:
				'Behance, Dribbble, personal website, or other portfolio links. Brief description of what can be found there.'
		},
		{
			id: 'summary',
			name: 'Creative Profile',
			required: true,
			order: 3,
			formatInstructions:
				'Compelling narrative about your creative philosophy, specialties, and unique value proposition'
		},
		{
			id: 'projects',
			name: 'Featured Work',
			required: true,
			order: 4,
			prominent: true,
			maxItems: 4,
			formatInstructions:
				'Highlight 3-4 best projects. Include client/brand name, your role, impact/results, and link if available.'
		},
		{
			id: 'experience',
			name: 'Experience',
			required: true,
			order: 5,
			maxItems: 4,
			formatInstructions:
				'Focus on creative output, campaign results, brand impact. Use metrics like engagement, reach, conversion.'
		},
		{
			id: 'skills',
			name: 'Skills & Tools',
			required: true,
			order: 6,
			formatInstructions:
				'Creative skills (conceptual, strategic) and tools (Adobe Suite, Figma, etc.). Can show proficiency levels.'
		},
		{
			id: 'education',
			name: 'Education',
			required: false,
			order: 7,
			formatInstructions: 'Degree, relevant coursework, workshops, design bootcamps'
		},
		{
			id: 'awards',
			name: 'Awards & Recognition',
			required: false,
			order: 8,
			formatInstructions: 'Design awards, campaign recognition, publications, speaking engagements'
		}
	],
	typography: {
		bodyFont: 'montserrat',
		headingFont: 'montserrat',
		baseFontSize: 10,
		lineHeight: 1.5,
		headingSizes: {
			h1: 2.2,
			h2: 1.3,
			h3: 1.1
		},
		boldHeadings: true,
		uppercaseHeadings: false
	},
	colors: {
		primary: '#2d3436',
		secondary: '#636e72',
		accent: '#6c5ce7',
		background: '#ffffff',
		border: '#dfe6e9',
		coloredHeaders: true
	},
	layout: {
		type: 'single-column',
		margins: {
			top: 0.6,
			right: 0.7,
			bottom: 0.6,
			left: 0.7
		},
		sectionSpacing: 14,
		maxPages: 2,
		useHorizontalRules: false,
		bulletStyle: 'circle',
		dateFormat: 'short',
		contactLayout: 'centered'
	},
	atsOptimized: true,
	formatInstructions: `
Generate a creative professional resume following these guidelines:
- Lead with a compelling personal brand statement
- Prominently feature portfolio links early in the resume
- Tell the story of your creative journey
- Highlight specific campaign/project results with metrics (engagement, reach, conversions, awards)
- Show range of creative capabilities
- Include client names and brands worked with (if permitted)
- Emphasize both creative vision AND business results
- Use dynamic language that reflects creativity
- Balance visual appeal with ATS compatibility
- Include tools and software proficiency
- Feature awards and recognition prominently
`,
	previewImage: '/resume-styles/creative-preview.svg',
	tags: ['creative', 'design', 'portfolio', 'visual', 'marketing', 'bold'],
	premium: false
};
