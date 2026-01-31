/**
 * Job URL Scraping API Endpoint
 *
 * POST /api/builder/scrape
 * Accepts a job URL and scrapes job details using existing scrapers
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { scrapeJobUrl, extractJobInfo } from '$lib/server/jobs/scraper';

const ScrapeRequestSchema = z.object({
	url: z.string().url('Invalid URL format'),
	// Allow raw text as fallback
	text: z.string().optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	// Authentication required
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const validated = ScrapeRequestSchema.safeParse(body);

		if (!validated.success) {
			return json(
				{
					error: 'Invalid input',
					details: validated.error.issues
				},
				{ status: 400 }
			);
		}

		const { url, text } = validated.data;

		let jobInfo;

		if (text) {
			// Parse provided text directly
			jobInfo = await extractJobInfo(text);
		} else {
			// Scrape the URL
			jobInfo = await scrapeJobUrl(url);
		}

		if (!jobInfo) {
			return json(
				{
					error: 'Could not extract job information from the provided URL',
					suggestion: 'Try pasting the job description directly'
				},
				{ status: 422 }
			);
		}

		return json({
			success: true,
			job: {
				title: jobInfo.title || 'Unknown Position',
				company: jobInfo.company || 'Unknown Company',
				description: jobInfo.description || '',
				requirements: jobInfo.requirements || [],
				location: jobInfo.location,
				salary: jobInfo.salary,
				sourceUrl: url
			}
		});
	} catch (error) {
		console.error('Job scrape error:', error);
		return json(
			{
				error: 'Failed to scrape job posting',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
