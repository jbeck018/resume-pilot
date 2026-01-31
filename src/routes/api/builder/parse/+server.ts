/**
 * Job Text Parsing API Endpoint
 *
 * POST /api/builder/parse
 * Parses raw job description text into structured job info
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { extractJobInfo } from '$lib/server/jobs/scraper';

const ParseRequestSchema = z.object({
	text: z.string().min(50, 'Job description too short').max(50000, 'Job description too long')
});

export const POST: RequestHandler = async ({ request, locals }) => {
	// Authentication required
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const validated = ParseRequestSchema.safeParse(body);

		if (!validated.success) {
			return json(
				{
					error: 'Invalid input',
					details: validated.error.issues
				},
				{ status: 400 }
			);
		}

		const { text } = validated.data;
		const jobInfo = await extractJobInfo(text);

		if (!jobInfo) {
			return json(
				{
					error: 'Could not extract job information from the provided text'
				},
				{ status: 422 }
			);
		}

		return json({
			success: true,
			job: {
				title: jobInfo.title || 'Unknown Position',
				company: jobInfo.company || 'Unknown Company',
				description: jobInfo.description || text,
				requirements: jobInfo.requirements || [],
				location: jobInfo.location,
				salary: jobInfo.salary
			}
		});
	} catch (error) {
		console.error('Job parse error:', error);
		return json(
			{
				error: 'Failed to parse job description',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
