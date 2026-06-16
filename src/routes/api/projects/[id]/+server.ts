// /api/projects/[id] (Epic E4). PATCH performs a guarded status transition
// (draft -> in_review -> approved -> archived, along legal edges only).
// Staff/admin only; scoped via getProject.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit } from '$lib/server/session';
import { isGlobalScope } from '$lib/server/hierarchy';
import { getProject, transitionStatus } from '$lib/server/projects';
import { isValidStatus } from '$lib/engines/workflow/status';

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	const project = await getProject(env, locals.user, params.id);
	if (!project) error(404, 'Project not found.');
	if (!isGlobalScope(locals.user)) error(403, 'Staff or admin role required.');

	let body: { status?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}
	if (!isValidStatus(body.status)) error(400, 'A valid target status is required.');

	const result = await transitionStatus(env, locals.user.id, project, body.status);
	if (!result.ok) error(409, result.error ?? 'Illegal status transition.');
	await audit(env, locals.user.id, `project.status.${body.status}`, `project:${params.id}`, request);
	return json({ ok: true, status: result.status, progress: result.progress });
};
