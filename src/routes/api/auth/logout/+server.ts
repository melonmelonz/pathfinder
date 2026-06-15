// POST /api/auth/logout (Epic E2, AC-2.4.1). Clears the session cookie and
// writes an audit entry for the logout event.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit, SESSION_COOKIE } from '$lib/server/session';

export const POST: RequestHandler = async ({ platform, cookies, locals, request }) => {
	const env = platform?.env;
	if (env?.DB && locals.user) {
		await audit(env, locals.user.id, 'auth.logout', `user:${locals.user.id}`, request);
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
