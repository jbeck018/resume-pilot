import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { workflows } from '$lib/server/workflows/client';

// Manual trigger for job discovery (for testing)
export const POST: RequestHandler = async ({ locals: { user } }) => {
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		await workflows.send({
			name: 'jobs/discovery.requested',
			data: { userId: user.id }
		});

		return json({ success: true, message: 'Job discovery triggered' });
	} catch (error) {
		console.error('Failed to trigger job discovery:', error);
		return json({ error: 'Failed to trigger job discovery' }, { status: 500 });
	}
};
