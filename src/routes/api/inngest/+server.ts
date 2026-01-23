import { serve } from 'inngest/sveltekit';
import {
	inngest,
	dailyJobDiscovery,
	scheduleDailyDiscovery,
	generateResumeForJob,
	parseResumeFile,
	sendWeeklySummaries
} from '$lib/server/inngest';

// Serve the Inngest API endpoint
const handler = serve({
	client: inngest,
	functions: [
		dailyJobDiscovery,
		scheduleDailyDiscovery,
		generateResumeForJob,
		parseResumeFile,
		sendWeeklySummaries
	]
});

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
