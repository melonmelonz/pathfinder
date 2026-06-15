// Server hooks (Epic E2 - Identity, Roles & Access).
//
// For every request: resolve the session token (httpOnly cookie first, then an
// Authorization: Bearer header for API clients) into event.locals.user. Then
// guard protected route trees - unauthenticated users hitting /dashboard are
// redirected to /login.

import { json, redirect, type Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	userFromToken,
	bearerFromRequest
} from '$lib/server/session';

/** Route prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = ['/dashboard', '/districts', '/facilities', '/buildings'];

/**
 * Response-header Content-Security-Policy. Complements the document <meta> CSP
 * emitted by kit.csp (svelte.config.js): the meta policy hash-pins SvelteKit's
 * inline scripts for tight document enforcement, while this header policy is
 * permissive on script/style ('unsafe-inline') so it never blocks what the meta
 * policy already allows, and it carries frame-ancestors (which a <meta> CSP
 * cannot) and applies to every response, not just HTML documents.
 */
const CSP_HEADER = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self'",
	"connect-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
	"form-action 'self'"
].join('; ');

/** Apply security headers to every response. */
function applySecurityHeaders(headers: Headers, isHttps: boolean): void {
	headers.set('X-Frame-Options', 'DENY');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('Content-Security-Policy', CSP_HEADER);
	if (isHttps) {
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
}

/** Same-origin CORS gate for /api/* (configured origins only). */
function corsCheck(event: Parameters<Handle>[0]['event']): Response | null {
	const origin = event.request.headers.get('Origin');
	if (!origin) return null; // same-origin / non-browser request: no CORS needed.
	const self = event.url.origin;
	if (origin === self) return null; // same-origin XHR.
	// Cross-origin API access is not permitted (no third-party origins configured).
	return json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 });
}

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	event.locals.user = null;

	if (env?.DB) {
		const token =
			event.cookies.get(SESSION_COOKIE) || bearerFromRequest(event.request);
		event.locals.user = await userFromToken(token, env);
	}

	const path = event.url.pathname;

	// Lock /api/* to same-origin (or configured origins) before doing any work.
	if (path === '/api' || path.startsWith('/api/')) {
		const blocked = corsCheck(event);
		if (blocked) {
			applySecurityHeaders(blocked.headers, event.url.protocol === 'https:');
			return blocked;
		}
	}

	const isProtected = PROTECTED_PREFIXES.some(
		(p) => path === p || path.startsWith(p + '/')
	);
	if (isProtected && !event.locals.user) {
		redirect(303, `/login?redirectTo=${encodeURIComponent(path)}`);
	}

	const response = await resolve(event);
	applySecurityHeaders(response.headers, event.url.protocol === 'https:');
	return response;
};
