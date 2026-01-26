import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Database, EmailPreferences } from '$lib/server/database/types';
import { updateProfileEmbeddingOnSave } from '$lib/server/embeddings';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) {
		return { profile: null };
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('user_id', user.id)
		.single<Database['public']['Tables']['profiles']['Row']>();

	// Check if profile has embedding
	const hasEmbedding = profile?.embedding && Array.isArray(profile.embedding) && profile.embedding.length === 1536;

	return {
		profile: profile || null,
		hasEmbedding
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();

		const fullName = formData.get('fullName') as string;
		const headline = formData.get('headline') as string;
		const summary = formData.get('summary') as string;
		const location = formData.get('location') as string;
		const linkedinUrl = formData.get('linkedinUrl') as string;
		const githubHandle = formData.get('githubHandle') as string;
		const skills = JSON.parse((formData.get('skills') as string) || '[]');
		const preferredRoles = JSON.parse((formData.get('preferredRoles') as string) || '[]');
		const preferredLocations = JSON.parse((formData.get('preferredLocations') as string) || '[]');
		const remotePreference = formData.get('remotePreference') as string;
		const minSalary = formData.get('minSalary')
			? parseInt(formData.get('minSalary') as string)
			: null;
		const maxSalary = formData.get('maxSalary')
			? parseInt(formData.get('maxSalary') as string)
			: null;
		const idealJobDescription = formData.get('idealJobDescription') as string | null;

		// Get existing experience data (not editable in this form but needed for embeddings)
		const { data: existingProfile } = await supabase
			.from('profiles')
			.select('experience')
			.eq('user_id', user.id)
			.single();

		const { error } = await supabase
			.from('profiles')
			.update({
				full_name: fullName,
				headline,
				summary,
				location,
				linkedin_url: linkedinUrl,
				github_handle: githubHandle,
				skills,
				preferred_roles: preferredRoles,
				preferred_locations: preferredLocations,
				remote_preference: remotePreference,
				min_salary: minSalary,
				max_salary: maxSalary,
				ideal_job_description: idealJobDescription,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		// Generate/update profile embedding in the background
		// This is non-blocking - profile save succeeds even if embedding fails
		updateProfileEmbeddingOnSave(user.id, {
			fullName,
			headline,
			summary,
			skills,
			preferredRoles,
			idealJobDescription,
			experience: existingProfile?.experience as Array<{
				title: string;
				company: string;
				description?: string;
				skills?: string[];
			}> | undefined
		}).catch((err) => {
			console.error('Failed to update profile embedding:', err);
		});

		return { success: true, embeddingUpdated: true };
	},

	updateEmailPreferences: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();

		const emailPreferences: EmailPreferences = {
			jobMatches: formData.get('jobMatches') === 'on',
			resumeReady: formData.get('resumeReady') === 'on',
			weeklySummary: formData.get('weeklySummary') === 'on',
			applicationUpdates: formData.get('applicationUpdates') === 'on',
			marketingEmails: formData.get('marketingEmails') === 'on'
		};

		const { error } = await supabase
			.from('profiles')
			.update({
				email_preferences: emailPreferences,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true, action: 'emailPreferences' };
	}
};
