import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Database } from '$lib/server/database/types';
import { workflows } from '$lib/server/workflows/client';

type ResumeRow = Database['public']['Tables']['resumes']['Row'];

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) {
		return { resumes: [], profile: null };
	}

	// Fetch user's profile to get profile_id for creating resumes
	const { data: profile } = await supabase
		.from('profiles')
		.select('id')
		.eq('user_id', user.id)
		.single();

	// Fetch all resumes for the user
	const { data: resumes, error } = await supabase
		.from('resumes')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error fetching resumes:', error);
		return { resumes: [], profile };
	}

	return {
		resumes: (resumes as ResumeRow[]) || [],
		profile
	};
};

export const actions: Actions = {
	upload: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const name = (formData.get('name') as string) || 'My Resume';

		if (!file || file.size === 0) {
			return fail(400, { error: 'Please select a file to upload' });
		}

		// Validate file type
		const allowedTypes = [
			'application/pdf',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		];
		if (!allowedTypes.includes(file.type)) {
			return fail(400, { error: 'Only PDF and DOCX files are allowed' });
		}

		// Validate file size (max 10MB)
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			return fail(400, { error: 'File size must be less than 10MB' });
		}

		// Get user's profile
		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (profileError || !profile) {
			return fail(400, { error: 'Profile not found. Please complete your profile first.' });
		}

		// Generate unique file path
		const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
		const fileType = fileExtension === 'docx' ? 'docx' : 'pdf';
		const timestamp = Date.now();
		const filePath = `${user.id}/${timestamp}-${file.name}`;

		// Upload file to Supabase Storage
		const { error: uploadError } = await supabase.storage
			.from('resumes')
			.upload(filePath, file, {
				contentType: file.type,
				upsert: false
			});

		if (uploadError) {
			console.error('Upload error:', uploadError);
			return fail(500, { error: 'Failed to upload file. Please try again.' });
		}

		// Get public URL for the file
		const {
			data: { publicUrl }
		} = supabase.storage.from('resumes').getPublicUrl(filePath);

		// Check if this is the first resume (make it default)
		const { count } = await supabase
			.from('resumes')
			.select('id', { count: 'exact' })
			.eq('user_id', user.id);

		const isDefault = count === 0;

		// Create resume record in database
		const { data: resume, error: dbError } = await supabase
			.from('resumes')
			.insert({
				user_id: user.id,
				profile_id: profile.id,
				name,
				is_default: isDefault,
				original_file_url: publicUrl,
				original_file_name: file.name,
				original_file_type: fileType
			})
			.select()
			.single();

		if (dbError) {
			console.error('Database error:', dbError);
			// Clean up uploaded file
			await supabase.storage.from('resumes').remove([filePath]);
			return fail(500, { error: 'Failed to save resume. Please try again.' });
		}

		// Trigger parsing workflow
		try {
			await workflows.send({
				name: 'resume/parsing.requested',
				data: {
					userId: user.id,
					resumeId: resume.id,
					fileUrl: publicUrl,
					fileType: fileType as 'pdf' | 'docx'
				}
			});
		} catch (workflowError) {
			console.error('Workflow error:', workflowError);
			// Don't fail the upload, parsing will be retried later
		}

		return { success: true, resumeId: resume.id };
	},

	setDefault: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const resumeId = formData.get('resumeId') as string;

		if (!resumeId) {
			return fail(400, { error: 'Resume ID is required' });
		}

		// Verify resume belongs to user
		const { data: resume, error: fetchError } = await supabase
			.from('resumes')
			.select('id')
			.eq('id', resumeId)
			.eq('user_id', user.id)
			.single();

		if (fetchError || !resume) {
			return fail(404, { error: 'Resume not found' });
		}

		// Remove default from all other resumes
		await supabase
			.from('resumes')
			.update({ is_default: false, updated_at: new Date().toISOString() })
			.eq('user_id', user.id);

		// Set new default
		const { error: updateError } = await supabase
			.from('resumes')
			.update({ is_default: true, updated_at: new Date().toISOString() })
			.eq('id', resumeId);

		if (updateError) {
			return fail(500, { error: 'Failed to set default resume' });
		}

		return { success: true };
	},

	rename: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const resumeId = formData.get('resumeId') as string;
		const name = formData.get('name') as string;

		if (!resumeId || !name) {
			return fail(400, { error: 'Resume ID and name are required' });
		}

		// Verify resume belongs to user and update
		const { error } = await supabase
			.from('resumes')
			.update({ name, updated_at: new Date().toISOString() })
			.eq('id', resumeId)
			.eq('user_id', user.id);

		if (error) {
			return fail(500, { error: 'Failed to rename resume' });
		}

		return { success: true };
	},

	delete: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const resumeId = formData.get('resumeId') as string;

		if (!resumeId) {
			return fail(400, { error: 'Resume ID is required' });
		}

		// Get resume to delete file from storage
		const { data: resume, error: fetchError } = await supabase
			.from('resumes')
			.select('original_file_url, is_default')
			.eq('id', resumeId)
			.eq('user_id', user.id)
			.single();

		if (fetchError || !resume) {
			return fail(404, { error: 'Resume not found' });
		}

		// Delete from database first
		const { error: deleteError } = await supabase
			.from('resumes')
			.delete()
			.eq('id', resumeId)
			.eq('user_id', user.id);

		if (deleteError) {
			return fail(500, { error: 'Failed to delete resume' });
		}

		// Delete file from storage
		if (resume.original_file_url) {
			const urlParts = resume.original_file_url.split('/resumes/');
			if (urlParts.length === 2) {
				const filePath = urlParts[1];
				await supabase.storage.from('resumes').remove([filePath]);
			}
		}

		// If this was the default resume, set another one as default
		if (resume.is_default) {
			const { data: firstResume } = await supabase
				.from('resumes')
				.select('id')
				.eq('user_id', user.id)
				.order('created_at', { ascending: false })
				.limit(1)
				.single();

			if (firstResume) {
				await supabase
					.from('resumes')
					.update({ is_default: true, updated_at: new Date().toISOString() })
					.eq('id', firstResume.id);
			}
		}

		return { success: true };
	},

	reparse: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const resumeId = formData.get('resumeId') as string;

		if (!resumeId) {
			return fail(400, { error: 'Resume ID is required' });
		}

		// Get resume details
		const { data: resume, error: fetchError } = await supabase
			.from('resumes')
			.select('id, original_file_url, original_file_type')
			.eq('id', resumeId)
			.eq('user_id', user.id)
			.single();

		if (fetchError || !resume) {
			return fail(404, { error: 'Resume not found' });
		}

		if (!resume.original_file_url || !resume.original_file_type) {
			return fail(400, { error: 'No file associated with this resume' });
		}

		// Trigger parsing workflow
		try {
			await workflows.send({
				name: 'resume/parsing.requested',
				data: {
					userId: user.id,
					resumeId: resume.id,
					fileUrl: resume.original_file_url,
					fileType: resume.original_file_type as 'pdf' | 'docx'
				}
			});
		} catch (workflowError) {
			console.error('Workflow error:', workflowError);
			return fail(500, { error: 'Failed to trigger parsing. Please try again.' });
		}

		return { success: true, message: 'Parsing started' };
	}
};
