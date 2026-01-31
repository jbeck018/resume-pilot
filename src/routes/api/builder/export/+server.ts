/**
 * Resume Export API Endpoint
 *
 * POST /api/builder/export
 * Exports resume content to PDF format using pdfmake
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

// Dynamic import for pdfmake since it doesn't have good ESM types
async function getPdfMake() {
	const pdfMakeModule = await import('pdfmake/build/pdfmake');
	return pdfMakeModule.default || pdfMakeModule;
}

const pdfFonts = {
	Roboto: {
		normal:
			'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf',
		bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf',
		italics:
			'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Italic.ttf',
		bolditalics:
			'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-MediumItalic.ttf'
	}
};

const ExperienceSchema = z.object({
	title: z.string(),
	company: z.string(),
	location: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	current: z.boolean().optional(),
	description: z.string().optional(),
	highlights: z.array(z.string()).optional()
});

const EducationSchema = z.object({
	institution: z.string(),
	degree: z.string(),
	field: z.string().optional(),
	graduationDate: z.string().optional(),
	gpa: z.string().optional()
});

const ExportRequestSchema = z.object({
	resume: z.object({
		name: z.string(),
		email: z.string().optional(),
		phone: z.string().optional(),
		location: z.string().optional(),
		linkedin: z.string().optional(),
		website: z.string().optional(),
		summary: z.string().optional(),
		experience: z.array(ExperienceSchema).optional(),
		education: z.array(EducationSchema).optional(),
		skills: z.array(z.string()).optional(),
		certifications: z.array(z.string()).optional()
	}),
	format: z.enum(['pdf', 'docx']).default('pdf'),
	style: z.enum(['classic', 'modern', 'minimal']).default('classic')
});

export const POST: RequestHandler = async ({ request, locals }) => {
	// Authentication required
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const validated = ExportRequestSchema.safeParse(body);

		if (!validated.success) {
			return json(
				{
					error: 'Invalid request',
					details: validated.error.issues
				},
				{ status: 400 }
			);
		}

		const { resume, style } = validated.data;

		// Generate PDF document definition
		const docDefinition = createPdfDefinition(resume, style);

		// Create PDF
		const pdfmake = await getPdfMake();
		const pdfDocGenerator = pdfmake.createPdf(docDefinition, undefined, pdfFonts);

		// Generate as base64
		const pdfBase64 = await new Promise<string>((resolve, reject) => {
			pdfDocGenerator.getBase64((data: string) => {
				if (data) {
					resolve(data);
				} else {
					reject(new Error('Failed to generate PDF'));
				}
			});
		});

		return json({
			success: true,
			pdf: pdfBase64,
			filename: `${resume.name.replace(/\s+/g, '_')}_Resume.pdf`
		});
	} catch (error) {
		console.error('Export API error:', error);
		return json(
			{
				error: 'Failed to export resume',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

type ResumeData = z.infer<typeof ExportRequestSchema>['resume'];
type StyleType = 'classic' | 'modern' | 'minimal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPdfDefinition(resume: ResumeData, style: StyleType): any {
	const styles = getStyleConfig(style);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const content: any[] = [];

	// Header with name and contact info
	content.push({
		text: resume.name,
		style: 'header'
	});

	// Contact info line
	const contactParts: string[] = [];
	if (resume.email) contactParts.push(resume.email);
	if (resume.phone) contactParts.push(resume.phone);
	if (resume.location) contactParts.push(resume.location);

	if (contactParts.length > 0) {
		content.push({
			text: contactParts.join(' | '),
			style: 'contact',
			margin: [0, 5, 0, 0]
		});
	}

	// Links line
	const linkParts: string[] = [];
	if (resume.linkedin) linkParts.push(resume.linkedin);
	if (resume.website) linkParts.push(resume.website);

	if (linkParts.length > 0) {
		content.push({
			text: linkParts.join(' | '),
			style: 'links',
			margin: [0, 2, 0, 10]
		});
	}

	// Summary
	if (resume.summary) {
		content.push({ text: 'Summary', style: 'sectionHeader' });
		content.push({
			text: resume.summary,
			style: 'bodyText',
			margin: [0, 5, 0, 10]
		});
	}

	// Experience
	if (resume.experience && resume.experience.length > 0) {
		content.push({ text: 'Experience', style: 'sectionHeader' });

		for (const exp of resume.experience) {
			content.push({
				columns: [
					{ text: exp.title, style: 'jobTitle', width: '*' },
					{
						text: formatDateRange(exp.startDate, exp.endDate, exp.current),
						style: 'dates',
						width: 'auto',
						alignment: 'right'
					}
				],
				margin: [0, 8, 0, 0]
			});

			content.push({
				columns: [
					{ text: exp.company, style: 'company', width: '*' },
					{ text: exp.location || '', style: 'location', width: 'auto', alignment: 'right' }
				],
				margin: [0, 2, 0, 0]
			});

			if (exp.description) {
				content.push({
					text: exp.description,
					style: 'bodyText',
					margin: [0, 5, 0, 0]
				});
			}

			if (exp.highlights && exp.highlights.length > 0) {
				content.push({
					ul: exp.highlights.map((h) => ({ text: h, style: 'bulletPoint' })),
					margin: [10, 5, 0, 5]
				});
			}
		}
	}

	// Education
	if (resume.education && resume.education.length > 0) {
		content.push({ text: 'Education', style: 'sectionHeader', margin: [0, 10, 0, 0] });

		for (const edu of resume.education) {
			content.push({
				columns: [
					{
						text: `${edu.degree}${edu.field ? ` in ${edu.field}` : ''}`,
						style: 'jobTitle',
						width: '*'
					},
					{ text: edu.graduationDate || '', style: 'dates', width: 'auto', alignment: 'right' }
				],
				margin: [0, 5, 0, 0]
			});

			content.push({
				text: edu.institution + (edu.gpa ? ` | GPA: ${edu.gpa}` : ''),
				style: 'company',
				margin: [0, 2, 0, 0]
			});
		}
	}

	// Skills
	if (resume.skills && resume.skills.length > 0) {
		content.push({ text: 'Skills', style: 'sectionHeader', margin: [0, 10, 0, 0] });
		content.push({
			text: resume.skills.join(' • '),
			style: 'bodyText',
			margin: [0, 5, 0, 0]
		});
	}

	// Certifications
	if (resume.certifications && resume.certifications.length > 0) {
		content.push({ text: 'Certifications', style: 'sectionHeader', margin: [0, 10, 0, 0] });
		content.push({
			ul: resume.certifications.map((c) => ({ text: c, style: 'bulletPoint' })),
			margin: [10, 5, 0, 0]
		});
	}

	return {
		content,
		styles: styles.styles,
		defaultStyle: styles.defaultStyle,
		pageSize: 'LETTER',
		pageMargins: [50, 50, 50, 50]
	};
}

function getStyleConfig(style: StyleType) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const baseStyles: Record<string, any> = {
		header: {
			fontSize: 24,
			bold: true,
			alignment: 'center',
			color: style === 'modern' ? '#2563eb' : '#333333'
		},
		contact: {
			fontSize: 10,
			alignment: 'center',
			color: '#666666'
		},
		links: {
			fontSize: 9,
			alignment: 'center',
			color: '#0066cc'
		},
		sectionHeader: {
			fontSize: style === 'minimal' ? 12 : 14,
			bold: true,
			color: style === 'modern' ? '#2563eb' : '#333333',
			margin: [0, 15, 0, 5]
		},
		jobTitle: {
			fontSize: 11,
			bold: true
		},
		company: {
			fontSize: 10,
			italics: true,
			color: '#444444'
		},
		location: {
			fontSize: 10,
			color: '#666666'
		},
		dates: {
			fontSize: 10,
			color: '#666666'
		},
		bodyText: {
			fontSize: 10,
			lineHeight: 1.3
		},
		bulletPoint: {
			fontSize: 10,
			lineHeight: 1.3
		}
	};

	const defaultStyle = {
		font: 'Roboto'
	};

	return {
		styles: baseStyles,
		defaultStyle
	};
}

function formatDateRange(startDate?: string, endDate?: string, current?: boolean): string {
	if (!startDate) return '';

	const start = formatDate(startDate);
	const end = current ? 'Present' : formatDate(endDate);

	return `${start} - ${end}`;
}

function formatDate(dateStr?: string): string {
	if (!dateStr) return '';

	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	} catch {
		return dateStr;
	}
}
