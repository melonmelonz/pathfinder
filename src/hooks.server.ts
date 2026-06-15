// Server hooks (Epic E2 - Identity, Roles & Access).
//
// For every request: resolve the session token (httpOnly cookie first, then an
// Authorization: Bearer header for API clients) into event.locals.user. Then
// guard protected route trees - unauthenticated users hitting /dashboard are
// redirected to /login.

import { redirect, type Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	userFromToken,
	bearerFromRequest
} from '$lib/server/session';

/** Route prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = ['/dashboard'];

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	event.locals.user = null;

	if (env?.DB) {
		const token =
			event.cookies.get(SESSION_COOKIE) || bearerFromRequest(event.request);
		event.locals.user = await userFromToken(token, env);
	}

	const path = event.url.pathname;
	const isProtected = PROTECTED_PREFIXES.some(
		(p) => path === p || path.startsWith(p + '/')
	);
	if (isProtected && !event.locals.user) {
		redirect(303, `/login?redirectTo=${encodeURIComponent(path)}`);
	}

	return resolve(event);
};
