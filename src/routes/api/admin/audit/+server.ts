// /api/admin/audit (Epic E11/E13). Immutable audit-log export as JSON or CSV
// (?format=csv). Admin only.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportAuditLog } from '$lib/server/compliance';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');
	if (locals.user.role !== 'admin') error(403, 'Admin role required.');

	const rows = await exportAuditLog(env);
	if (url.searchParams.get('format') === 'csv') {
		const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
		const header = 'id,user_id,action,resource,ip,created_at';
		const body = rows.map((r) => [r.id, r.user_id, r.action, r.resource, r.ip, r.created_at].map(esc).join(',')).join('\n');
		return new Response(header + '\n' + body, {
			headers: {
				'content-type': 'text/csv',
				'content-disposition': 'attachment; filename="pathfinder_audit.csv"'
			}
		});
	}
	return json({ audit: rows });
};
