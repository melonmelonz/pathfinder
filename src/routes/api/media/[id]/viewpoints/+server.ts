// /api/media/[id]/viewpoints (Epic E8). GET returns named camera bookmarks;
// PUT replaces them (batch). Scoped via getMedia inside the DAL.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { listViewpoints, saveViewpointsBatch } from '$lib/server/scans3d';

export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const viewpoints = await listViewpoints(env, locals.user, params.id);
	if (viewpoints === null) error(404, 'Media not found.');
	return json({ viewpoints });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const visible = await listViewpoints(env, locals.user, params.id);
	if (visible === null) error(404, 'Media not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { viewpoints?: unknown };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!Array.isArray(body.viewpoints)) error(400, 'viewpoints array required.');
	await saveViewpointsBatch(env, params.id, body.viewpoints as never[]);
	await audit(env, locals.user.id, 'scan3d.viewpoints.save', `media:${params.id}`, request);
	return json({ ok: true, count: (body.viewpoints as unknown[]).length });
};
