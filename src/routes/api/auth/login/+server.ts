// POST /api/auth/login (Epic E2, AC-2.1.1 / AC-2.1.2 / AC-2.4.1).
// Validates email+password against D1, issues an HS256 JWT, sets it as an
// httpOnly session cookie, writes an audit entry, and updates last_login.
// Login logic ported from v1 els911-portal handleLogin.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { signJWT, verifyPassword, getJwtSecret } from '$lib/server/auth';
import { audit, SESSION_COOKIE } from '$lib/server/session';

const GENERIC_ERROR = 'Invalid email or password.';
const SESSION_TTL_SECONDS = 86400 * 7; // 7 days

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');

	let body: { email?: string; password?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}

	const email = (body.email || '').toLowerCase().trim();
	const password = body.password || '';
	if (!email || !password) error(400, 'Email and password are required.');

	const user = await env.DB.prepare(
		'SELECT * FROM users WHERE email = ? AND active = 1'
	)
		.bind(email)
		.first<{
			id: string;
			name: string;
			email: string;
			role: 'admin' | 'staff' | 'client';
			org: string | null;
			active: number;
			mfa_enabled: number;
			password_hash: string;
			salt: string;
		}>();

	if (!user) {
		await audit(env, null, 'access.denied', `login:${email}`, request);
		// Generic error, no session issued (AC-2.1.2).
		error(401, GENERIC_ERROR);
	}

	const valid = await verifyPassword(password, user.salt, user.password_hash);
	if (!valid) {
		await audit(env, user.id, 'access.denied', `user:${user.id}`, request);
		error(401, GENERIC_ERROR);
	}

	// MFA hook (AC-2.5.1): password-only users continue unchanged; an
	// mfa_enabled user would branch into a second step here. The flag is
	// surfaced so the flow can expose the step without breaking anyone.
	const mfaRequired = user.mfa_enabled === 1;

	const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
	const token = await signJWT(
		{ sub: user.id, role: user.role, email: user.email, exp },
		getJwtSecret(env)
	);

	await env.DB.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?')
		.bind(user.id)
		.run();
	await audit(env, user.id, 'auth.login', `user:${user.id}`, request);

	// httpOnly session cookie so the browser auto-sends it; the token is also
	// returned for non-browser API clients.
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: request.url.startsWith('https://'),
		maxAge: SESSION_TTL_SECONDS
	});

	const safeUser = {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		org: user.org,
		active: user.active,
		mfa_enabled: user.mfa_enabled
	};

	return json({ token, user: safeUser, mfaRequired });
};
