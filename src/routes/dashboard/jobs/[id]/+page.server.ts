import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { inngest } from '$lib/server/inngest';
import { usageService, subscriptionService } from '$lib/server/subscription';
import type { Database } from '$lib/server/database/types';
import {
	calculateMatchBreakdown,
	analyzeATS,
	analyzeSkillsGap
} from '$lib/server/jobs/job-analysis';

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) {
		return {
			job: null,
			application: null,
			profile: null,
			usage: null,
			matchBreakdown: null,
			atsAnalysis: null,
			skillsGap: null
		};
	}

	type JobRow = Database['public']['Tables']['jobs']['Row'];
	type ApplicationRow = Database['public']['Tables']['job_applications']['Row'];
	type ProfileRow = Database['public']['Tables']['profiles']['Row'];

	const [jobResult, applicationResult, profileResult, usageCheck] = await Promise.all([
		supabase
			.from('jobs')
			.select('*')
			.eq('id', params.id)
			.eq('user_id', user.id)
			.single<JobRow>(),

		supabase
			.from('job_applications')
			.select('*')
			.eq('job_id', params.id)
			.eq('user_id', user.id)
			.single<ApplicationRow>(),

		supabase
			.from('profiles')
			.select('*')
			.eq('user_id', user.id)
			.single<ProfileRow>(),

		usageService.checkUsageLimit(user.id)
	]);

	// Compute analysis data if both job and profile exist
	let matchBreakdown = null;
	let atsAnalysis = null;
	let skillsGap = null;

	if (jobResult.data && profileResult.data) {
		matchBreakdown = calculateMatchBreakdown(jobResult.data, profileResult.data);
		atsAnalysis = analyzeATS(jobResult.data, profileResult.data);
		skillsGap = analyzeSkillsGap(jobResult.data, profileResult.data);
	}

	return {
		job: jobResult.data || null,
		application: applicationResult.data || null,
		profile: profileResult.data || null,
		matchBreakdown,
		atsAnalysis,
		skillsGap,
		usage: {
			canGenerate: usageCheck.canGenerate,
			generationsUsed: usageCheck.generationsUsed,
			generationLimit: usageCheck.generationLimit,
			remaining: usageCheck.remaining,
			isUnlimited: usageCheck.isUnlimited,
			tierName: usageCheck.tierName,
			resetsAt: usageCheck.resetsAt instanceof Date && !isNaN(usageCheck.resetsAt.getTime())
				? usageCheck.resetsAt.toISOString()
				: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
		}
	};
};

export const actions: Actions = {
	markApplied: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const { error } = await supabase
			.from('jobs')
			.update({
				status: 'applied',
				applied_at: new Date().toISOString()
			} as JobUpdate)
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	markNotRelevant: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const { error } = await supabase
			.from('jobs')
			.update({ status: 'not_relevant' } as JobUpdate)
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	markSaved: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const { error } = await supabase
			.from('jobs')
			.update({ status: 'saved' } as JobUpdate)
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	markInterview: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const { error } = await supabase
			.from('jobs')
			.update({ status: 'interview' } as JobUpdate)
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	markOffer: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const { error } = await supabase
			.from('jobs')
			.update({ status: 'offer' } as JobUpdate)
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	markRejected: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const { error } = await supabase
			.from('jobs')
			.update({ status: 'rejected' } as JobUpdate)
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	submitFeedback: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;
		const feedback = formData.get('feedback') as string;
		const reason = formData.get('reason') as string;

		type JobUpdate = Database['public']['Tables']['jobs']['Update'];
		const { error } = await supabase
			.from('jobs')
			.update({
				user_feedback: feedback,
				feedback_reason: reason || null
			} as JobUpdate)
			.eq('id', jobId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	regenerate: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const applicationId = formData.get('applicationId') as string;

		// Check usage limits before regenerating
		const usageCheck = await usageService.checkUsageLimit(user.id);
		if (!usageCheck.canGenerate) {
			return fail(429, {
				error: 'usage_limit_exceeded',
				message: `Weekly generation limit reached (${usageCheck.generationsUsed}/${usageCheck.generationLimit}). Upgrade your plan or wait until ${usageCheck.resetsAt.toLocaleDateString()}.`,
				remaining: usageCheck.remaining,
				limit: usageCheck.generationLimit,
				resetsAt: usageCheck.resetsAt.toISOString()
			});
		}

		// Get the application to find the job ID
		const { data: application, error: fetchError } = await supabase
			.from('job_applications')
			.select('job_id')
			.eq('id', applicationId)
			.eq('user_id', user.id)
			.single();

		if (fetchError || !application) {
			return fail(404, { error: 'Application not found' });
		}

		// Reset application status
		type ApplicationUpdate = Database['public']['Tables']['job_applications']['Update'];
		const { error: updateError } = await supabase
			.from('job_applications')
			.update({
				status: 'generating',
				error_message: null,
				tailored_resume: null,
				cover_letter: null
			})
			.eq('id', applicationId);

		if (updateError) {
			return fail(500, { error: updateError.message });
		}

		// Trigger regeneration
		await inngest.send({
			name: 'resume/generation.requested',
			data: {
				userId: user.id,
				jobId: application.job_id,
				applicationId
			}
		});

		return { success: true };
	},

	// Generate resume for a job (initial generation)
	generate: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const jobId = formData.get('jobId') as string;

		// Check usage limits before generating
		const usageCheck = await usageService.checkUsageLimit(user.id);
		if (!usageCheck.canGenerate) {
			return fail(429, {
				error: 'usage_limit_exceeded',
				message: `Weekly generation limit reached (${usageCheck.generationsUsed}/${usageCheck.generationLimit}). Upgrade your plan or wait until ${usageCheck.resetsAt.toLocaleDateString()}.`,
				remaining: usageCheck.remaining,
				limit: usageCheck.generationLimit,
				resetsAt: usageCheck.resetsAt.toISOString()
			});
		}

		// Check if an application already exists
		const { data: existingApp } = await supabase
			.from('job_applications')
			.select('id, status')
			.eq('job_id', jobId)
			.eq('user_id', user.id)
			.single<{ id: string; status: string }>();

		if (existingApp) {
			if (existingApp.status === 'ready') {
				return fail(400, { error: 'Application already generated' });
			}
			// If exists but not ready, trigger regeneration
			return fail(400, { error: 'Generation already in progress' });
		}

		// Create job application record
		type ApplicationInsert = Database['public']['Tables']['job_applications']['Insert'];
		const { data: application, error: createError } = await supabase
			.from('job_applications')
			.insert({
				user_id: user.id,
				job_id: jobId,
				status: 'generating'
			})
			.select('id')
			.single<{ id: string }>();

		if (createError || !application) {
			return fail(500, { error: 'Failed to create application' });
		}

		// Trigger generation
		await inngest.send({
			name: 'resume/generation.requested',
			data: {
				userId: user.id,
				jobId,
				applicationId: application.id
			}
		});

		return { success: true, applicationId: application.id };
	}
};
