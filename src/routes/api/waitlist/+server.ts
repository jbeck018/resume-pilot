/**
 * Waitlist API
 *
 * POST /api/waitlist - Join the waitlist for pricing launch notifications
 */

import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { email, source = 'pricing' } = body;

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return json({ error: 'Invalid email address' }, { status: 400 });
		}

		// Normalize email
		const normalizedEmail = email.toLowerCase().trim();

		// Get user ID if logged in
		const { user } = await locals.safeGetSession();
		const userId = user?.id || null;

		// First check if already exists
		const { data: existing } = await locals.supabase
			.from('waitlist')
			.select('id')
			.eq('email', normalizedEmail)
			.eq('source', source)
			.single();

		if (existing) {
			return json({
				success: true,
				message: "You're already on the waitlist!"
			});
		}

		// Insert into waitlist
		const { error } = await locals.supabase.from('waitlist').insert({
			email: normalizedEmail,
			source,
			user_id: userId,
			metadata: {
				user_agent: request.headers.get('user-agent'),
				referrer: request.headers.get('referer')
			}
		});

		if (error) {
			// Handle duplicate gracefully (race condition)
			if (error.code === '23505') {
				return json({
					success: true,
					message: "You're already on the waitlist!"
				});
			}

			console.error('Error adding to waitlist:', error);
			return json({ error: 'Failed to join waitlist' }, { status: 500 });
		}

		return json({
			success: true,
			message: "Thanks for joining! We'll notify you when pricing is available."
		});
	} catch (error) {
		console.error('Error processing waitlist signup:', error);
		return json({ error: 'Failed to join waitlist' }, { status: 500 });
	}
};
