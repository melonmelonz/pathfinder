// Collaboration DAL (Epic E9): anchored comment threads on annotations, the
// resolve-not-delete workflow, @-mention -> notification fan-in, the activity
// feed, and tokenised share links. Visibility of the underlying document is
// enforced by the caller (getDocument); these operate once access is granted.

import { uuid } from './auth';
import { parseMentions } from '$lib/engines/search/query';

type Env = { DB: D1Database };

export interface CommentRow {
	id: string;
	annotation_id: string;
	user_id: string;
	text: string;
	resolved: number;
	created_at: string;
	author_name?: string;
}

/** List comments on a document's annotations. `includeResolved` controls the
 *  resolve-hides-not-deletes behaviour (resolved threads stay queryable for the
 *  audit trail but are hidden from the default view). */
export async function listComments(
	env: Env,
	documentId: string,
	includeResolved = false
): Promise<CommentRow[]> {
	const clause = includeResolved ? '' : 'AND c.resolved = 0';
	const { results } = await env.DB.prepare(
		`SELECT c.*, u.name AS author_name
		   FROM annotation_comments c
		   JOIN annotations a ON a.id = c.annotation_id
		   LEFT JOIN users u ON u.id = c.user_id
		  WHERE a.document_id = ? ${clause}
		  ORDER BY c.created_at`
	)
		.bind(documentId)
		.all<CommentRow>();
	return results ?? [];
}

/** Add a comment, fan @-mentions out into notifications, and log activity. */
export async function addComment(
	env: Env,
	input: { annotationId: string; userId: string; actorName: string; text: string; resourceUrl: string }
): Promise<CommentRow> {
	const id = uuid();
	await env.DB.prepare(
		'INSERT INTO annotation_comments (id, annotation_id, user_id, text) VALUES (?, ?, ?, ?)'
	)
		.bind(id, input.annotationId, input.userId, input.text)
		.run();

	// Resolve @handles to users and queue (unbatched) notifications.
	const handles = parseMentions(input.text);
	if (handles.length) {
		const stmts: D1PreparedStatement[] = [];
		for (const h of handles) {
			const u = await env.DB.prepare(
				"SELECT id FROM users WHERE lower(email) LIKE ? OR lower(replace(name,' ','')) = ? LIMIT 1"
			)
				.bind(h + '@%', h)
				.first<{ id: string }>();
			if (u && u.id !== input.userId) {
				stmts.push(
					env.DB.prepare(
						'INSERT INTO notifications (id, recipient_id, actor_id, kind, resource_url, excerpt) VALUES (?, ?, ?, ?, ?, ?)'
					).bind(uuid(), u.id, input.userId, 'mention', input.resourceUrl, input.text.slice(0, 140))
				);
			}
		}
		if (stmts.length) await env.DB.batch(stmts);
	}

	await logActivity(env, input.userId, 'comment.add', 'annotation', input.annotationId, input.actorName + ' commented');
	const row = await env.DB.prepare(
		`SELECT c.*, u.name AS author_name FROM annotation_comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.id = ?`
	)
		.bind(id)
		.first<CommentRow>();
	return row as CommentRow;
}

/** Resolve / unresolve a comment thread. Resolving hides, never deletes. */
export async function setCommentResolved(
	env: Env,
	commentId: string,
	resolved: boolean,
	actorId: string
): Promise<void> {
	await env.DB.prepare('UPDATE annotation_comments SET resolved = ? WHERE id = ?')
		.bind(resolved ? 1 : 0, commentId)
		.run();
	await logActivity(env, actorId, resolved ? 'comment.resolve' : 'comment.reopen', 'comment', commentId, null);
}

// --- Activity feed ---

export async function logActivity(
	env: Env,
	actorId: string | null,
	action: string,
	resourceType: string,
	resourceId: string,
	summary: string | null
): Promise<void> {
	await env.DB.prepare(
		'INSERT INTO activity_log (id, actor_id, action, resource_type, resource_id, summary) VALUES (?, ?, ?, ?, ?, ?)'
	)
		.bind(uuid(), actorId, action, resourceType, resourceId, summary)
		.run();
}

export interface ActivityRow {
	id: string;
	actor_id: string | null;
	action: string;
	resource_type: string;
	resource_id: string;
	summary: string | null;
	created_at: string;
	actor_name?: string | null;
}

export async function recentActivity(env: Env, limit = 30): Promise<ActivityRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT al.*, u.name AS actor_name FROM activity_log al
		   LEFT JOIN users u ON u.id = al.actor_id
		  ORDER BY al.created_at DESC LIMIT ?`
	)
		.bind(limit)
		.all<ActivityRow>();
	return results ?? [];
}

// --- Share links ---

export async function createShareLink(
	env: Env,
	input: { resourceType: string; resourceId: string; createdBy: string; expiresAt?: string | null }
): Promise<string> {
	const token = uuid().replace(/-/g, '') + uuid().replace(/-/g, '').slice(0, 8);
	await env.DB.prepare(
		'INSERT INTO share_links (token, resource_type, resource_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?)'
	)
		.bind(token, input.resourceType, input.resourceId, input.createdBy, input.expiresAt ?? null)
		.run();
	return token;
}

export async function resolveShareLink(
	env: Env,
	token: string
): Promise<{ resource_type: string; resource_id: string } | null> {
	const row = await env.DB.prepare(
		`SELECT resource_type, resource_id, expires_at, revoked FROM share_links WHERE token = ?`
	)
		.bind(token)
		.first<{ resource_type: string; resource_id: string; expires_at: string | null; revoked: number }>();
	if (!row || row.revoked) return null;
	if (row.expires_at && row.expires_at < new Date().toISOString()) return null;
	return { resource_type: row.resource_type, resource_id: row.resource_id };
}

// --- Notification batching (digest send happens in the API/cron layer) ---

export interface RawNotification {
	id: string;
	recipient_id: string;
	recipient_email: string;
	actor_name: string;
	kind: 'mention' | 'reply' | 'resolve';
	resource_url: string;
	excerpt: string;
}

export async function unbatchedNotifications(env: Env): Promise<RawNotification[]> {
	const { results } = await env.DB.prepare(
		`SELECT n.id, n.recipient_id, u.email AS recipient_email,
		        COALESCE(a.name,'Someone') AS actor_name, n.kind, n.resource_url, n.excerpt
		   FROM notifications n
		   JOIN users u ON u.id = n.recipient_id
		   LEFT JOIN users a ON a.id = n.actor_id
		  WHERE n.batched_at IS NULL
		  ORDER BY n.created_at`
	).all<RawNotification>();
	return results ?? [];
}

export async function markBatched(env: Env, ids: string[]): Promise<void> {
	if (!ids.length) return;
	const now = new Date().toISOString();
	await env.DB.batch(
		ids.map((id) => env.DB.prepare('UPDATE notifications SET batched_at = ? WHERE id = ?').bind(now, id))
	);
}
