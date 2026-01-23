import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { CookieSerializeOptions } from 'cookie';
import type { Database } from '$lib/server/database/types';

type CookieToSet = { name: string; value: string; options: CookieSerializeOptions };

const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet: CookieToSet[]) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	// Protect dashboard routes
	if (event.url.pathname.startsWith('/dashboard') && !session) {
		redirect(303, '/auth/login');
	}

	// Check if user needs onboarding
	if (session && !event.url.pathname.startsWith('/onboarding') && !event.url.pathname.startsWith('/auth/logout')) {
		const { data: profile } = await event.locals.supabase
			.from('profiles')
			.select('onboarding_completed')
			.eq('user_id', user!.id)
			.single<{ onboarding_completed: boolean }>();

		// Redirect to onboarding if not completed
		if (profile && !profile.onboarding_completed && !event.url.pathname.startsWith('/auth')) {
			redirect(303, '/onboarding');
		}
	}

	// Redirect logged in users away from auth pages
	if (event.url.pathname.startsWith('/auth') && session) {
		// Check if onboarding is complete
		const { data: profile } = await event.locals.supabase
			.from('profiles')
			.select('onboarding_completed')
			.eq('user_id', user!.id)
			.single<{ onboarding_completed: boolean }>();

		if (profile?.onboarding_completed) {
			redirect(303, '/dashboard');
		} else {
			redirect(303, '/onboarding');
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard);
