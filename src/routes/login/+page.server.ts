// Login form action (Epic E2, AC-2.1.1 / AC-2.1.2 / AC-2.4.1).
//
// Progressive-enhancement login: works with or without client JS (no hydration
// race). Validates email+password against D1, issues an HS256 JWT, sets it as
// an httpOnly session cookie, audits the event, updates last_login, then
// redirects to the scoped dashboard. Crypto/login logic ported from v1.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { signJWT, verifyPassword, getJwtSecret } from '$lib/server/auth';
import { audit, SESSION_COOKIE } from '$lib/server/session';

const GENERIC_ERROR = 'Invalid email or password.';
const SESSION_TTL_SECONDS = 86400 * 7; // 7 days

interface UserRow {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'staff' | 'client';
	org: string | null;
	active: number;
	mfa_enabled: number;
	password_hash: string;
	salt: string;
}

export const actions: Actions = {
	default: async ({ request, platform, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') || '').toLowerCase().trim();
		const password = String(form.get('password') || '');

		const env = platform?.env;
		if (!env?.DB) return fail(500, { error: 'Database binding unavailable.', email });

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND active = 1')
			.bind(email)
			.first<UserRow>();

		if (!user) {
			await audit(env, null, 'access.denied', `login:${email}`, request);
			return fail(401, { error: GENERIC_ERROR, email });
		}

		const valid = await verifyPassword(password, user.salt, user.password_hash);
		if (!valid) {
			await audit(env, user.id, 'access.denied', `user:${user.id}`, request);
			return fail(401, { error: GENERIC_ERROR, email });
		}

		const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
		const token = await signJWT(
			{ sub: user.id, role: user.role, email: user.email, exp },
			getJwtSecret(env)
		);

		await env.DB.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?')
			.bind(user.id)
			.run();
		await audit(env, user.id, 'auth.login', `user:${user.id}`, request);

		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: SESSION_TTL_SECONDS
		});

		const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';
		redirect(303, redirectTo);
	}
};
