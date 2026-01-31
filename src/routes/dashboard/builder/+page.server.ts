import type { PageServerLoad } from './$types';
import { db } from '$lib/server/database';
import { profiles } from '$lib/server/database/schema';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		throw redirect(303, '/auth/login');
	}

	// Load user's profile for context
	const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);

	// Build a summary of the user's profile for the chat context
	let profileSummary = '';

	if (profile) {
		const skills = profile.skills || [];
		const experience = (profile.experience as any[]) || [];
		const education = (profile.education as any[]) || [];

		if (profile.fullName) {
			profileSummary += `Name: ${profile.fullName}\n`;
		}
		if (profile.headline) {
			profileSummary += `Headline: ${profile.headline}\n`;
		}
		if (skills.length > 0) {
			profileSummary += `Skills: ${skills.join(', ')}\n`;
		}
		if (experience.length > 0) {
			profileSummary += `Experience:\n`;
			for (const exp of experience.slice(0, 5)) {
				profileSummary += `- ${exp.title || 'Role'} at ${exp.company || 'Company'}`;
				if (exp.current) {
					profileSummary += ' (current)';
				}
				profileSummary += '\n';
			}
		}
		if (education.length > 0) {
			profileSummary += `Education:\n`;
			for (const edu of education.slice(0, 3)) {
				profileSummary += `- ${edu.degree || 'Degree'} at ${edu.institution || 'Institution'}\n`;
			}
		}
	}

	return {
		profileSummary: profileSummary.trim(),
		hasProfile: !!profile,
		profile: profile
			? {
					name: profile.fullName || '',
					email: profile.email || user.email || '',
					phone: '', // Not stored in profiles schema
					location: profile.location || '',
					linkedin: profile.linkedinUrl || '',
					website: profile.portfolioUrls?.[0] || '',
					skills: profile.skills || [],
					experience: (profile.experience as any[]) || [],
					education: (profile.education as any[]) || []
				}
			: null
	};
};
