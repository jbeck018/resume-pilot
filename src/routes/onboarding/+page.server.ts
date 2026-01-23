import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Database } from '$lib/server/database/types';
import { inngest } from '$lib/server/inngest';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) {
		redirect(303, '/auth/login');
	}

	// Check if user has already completed onboarding
	const { data: profile } = await supabase
		.from('profiles')
		.select('onboarding_completed')
		.eq('user_id', user.id)
		.single<{ onboarding_completed: boolean }>();

	if (profile?.onboarding_completed) {
		redirect(303, '/dashboard');
	}

	return {
		user
	};
};

export const actions: Actions = {
	// Step 1: Upload resume
	uploadResume: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const file = formData.get('resume') as File;

		if (!file || file.size === 0) {
			return fail(400, { error: 'Please select a resume file' });
		}

		// Validate file type
		const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
		if (!allowedTypes.includes(file.type)) {
			return fail(400, { error: 'Only PDF and DOCX files are allowed' });
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB in bytes
		if (file.size > maxSize) {
			return fail(400, { error: 'File size must be less than 5MB' });
		}

		try {
			// Get user's profile
			const { data: profile } = await supabase
				.from('profiles')
				.select('id')
				.eq('user_id', user.id)
				.single<{ id: string }>();

			if (!profile) {
				return fail(500, { error: 'Profile not found' });
			}

			// Upload file to Supabase Storage
			const fileName = `${user.id}/${Date.now()}_${file.name}`;
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from('resumes')
				.upload(fileName, file, {
					contentType: file.type,
					upsert: false
				});

			if (uploadError) {
				console.error('Upload error:', uploadError);
				return fail(500, { error: 'Failed to upload resume' });
			}

			// Get public URL
			const { data: { publicUrl } } = supabase.storage
				.from('resumes')
				.getPublicUrl(fileName);

			// Create resume record
			type ResumeInsert = Database['public']['Tables']['resumes']['Insert'];
			const { data: resumeData, error: insertError } = await supabase
				.from('resumes')
				.insert({
					user_id: user.id,
					profile_id: profile.id,
					name: file.name,
					is_default: true,
					original_file_url: publicUrl,
					original_file_name: file.name,
					original_file_type: file.type.includes('pdf') ? 'pdf' : 'docx'
				})
				.select('id')
				.single();

			if (insertError) {
				console.error('Database error:', insertError);
				return fail(500, { error: 'Failed to save resume' });
			}

			// Trigger background resume parsing job
			try {
				await inngest.send({
					name: 'resume/parsing.requested',
					data: {
						userId: user.id,
						resumeId: resumeData.id,
						fileUrl: publicUrl,
						fileType: file.type.includes('pdf') ? 'pdf' : 'docx'
					}
				});
			} catch (error) {
				console.error('Failed to trigger resume parsing:', error);
				// Don't fail the upload if parsing trigger fails
				// The resume is saved, parsing can be retried later
			}

			return { success: true, step: 1 };
		} catch (error) {
			console.error('Unexpected error:', error);
			return fail(500, { error: 'An unexpected error occurred' });
		}
	},

	// Step 2: Add profile links
	updateProfiles: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const linkedinUrl = formData.get('linkedinUrl') as string;
		const githubUrl = formData.get('githubUrl') as string;
		const portfolioUrls = formData.get('portfolioUrls') as string;

		const portfolioArray = portfolioUrls
			? portfolioUrls.split('\n').filter(url => url.trim())
			: [];

		type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
		const { error } = await supabase
			.from('profiles')
			.update({
				linkedin_url: linkedinUrl || null,
				github_handle: githubUrl ? githubUrl.replace(/https?:\/\/(www\.)?github\.com\//i, '') : null,
				portfolio_urls: portfolioArray,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id);

		if (error) {
			console.error('Profile update error:', error);
			return fail(500, { error: 'Failed to update profile' });
		}

		return { success: true, step: 2 };
	},

	// Step 3: Add ideal job description
	updateIdealJob: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const idealJobDescription = formData.get('idealJobDescription') as string;

		if (!idealJobDescription || idealJobDescription.trim().length < 50) {
			return fail(400, { error: 'Please provide a detailed description (at least 50 characters)' });
		}

		type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
		const { error } = await supabase
			.from('profiles')
			.update({
				ideal_job_description: idealJobDescription,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id);

		if (error) {
			console.error('Profile update error:', error);
			return fail(500, { error: 'Failed to update ideal job description' });
		}

		return { success: true, step: 3 };
	},

	// Step 4: Complete onboarding
	complete: async ({ locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		// Verify that resume was uploaded
		const { data: resumes } = await supabase
			.from('resumes')
			.select('id')
			.eq('user_id', user.id)
			.limit(1);

		if (!resumes || resumes.length === 0) {
			return fail(400, { error: 'Please upload a resume first' });
		}

		// Verify ideal job description exists
		const { data: profile } = await supabase
			.from('profiles')
			.select('ideal_job_description')
			.eq('user_id', user.id)
			.single<{ ideal_job_description: string | null }>();

		if (!profile?.ideal_job_description) {
			return fail(400, { error: 'Please provide your ideal job description' });
		}

		// Mark onboarding as complete
		type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
		const { error } = await supabase
			.from('profiles')
			.update({
				onboarding_completed: true,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id);

		if (error) {
			console.error('Onboarding completion error:', error);
			return fail(500, { error: 'Failed to complete onboarding' });
		}

		redirect(303, '/dashboard');
	}
};
