// /api/share/[token] (Epic E9). DELETE revokes a share link (AC-9.5.2). Only
// the issuer (staff/admin) may revoke.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';
import { revokeShareLink } from '$lib/server/collab';

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');
	await revokeShareLink(env, params.token);
	return json({ ok: true });
};
