// /api/admin/users/[id] (Epic E13). PATCH enables/disables a user. Admin only.
// Disabling is reversible and audited; users are never hard-deleted here.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { setUserActive } from '$lib/server/admin';

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');
	if (params.id === locals.user.id) error(400, 'You cannot change your own active state.');

	let body: { active?: boolean };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (typeof body.active !== 'boolean') error(400, 'active boolean required.');
	await setUserActive(env, params.id, body.active);
	await audit(env, locals.user.id, body.active ? 'admin.user.enable' : 'admin.user.disable', `user:${params.id}`, request);
	return json({ ok: true });
};
