// /api/export-jobs/[id] (Epic E6). PATCH updates job progress/status from the
// client-side batch renderer (staff/admin).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGlobalScope } from '$lib/server/hierarchy';
import { updateJob } from '$lib/server/exports';

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { status?: 'queued' | 'running' | 'done' | 'error'; done?: number; result_key?: string; error?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	await updateJob(env, params.id, body);
	return json({ ok: true });
};
