// Admin / platform-ops DAL (Epic E13). User listing, API-key listing and audit
// access for the admin console. Admin role is enforced by the callers.

type Env = { DB: D1Database };

export interface AdminUser {
	id: string;
	name: string;
	email: string;
	role: string;
	org: string | null;
	active: number;
	mfa_enabled: number;
	last_login: string | null;
	created_at: string;
}

export async function listUsers(env: Env): Promise<AdminUser[]> {
	const { results } = await env.DB.prepare(
		'SELECT id, name, email, role, org, active, mfa_enabled, last_login, created_at FROM users ORDER BY created_at DESC'
	).all<AdminUser>();
	return results ?? [];
}

export async function setUserActive(env: Env, id: string, active: boolean): Promise<void> {
	await env.DB.prepare('UPDATE users SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run();
}

export interface AdminApiKey {
	id: string;
	name: string;
	masked_key: string | null;
	user_id: string | null;
	revoked: number;
	last_used_at: string | null;
	created_at: string;
}

export async function listApiKeys(env: Env): Promise<AdminApiKey[]> {
	// api_keys ships in the v1 schema; the table may not exist in a fresh v2 DB
	// until the v1 import runs, so tolerate its absence.
	try {
		const { results } = await env.DB.prepare(
			'SELECT id, name, masked_key, user_id, revoked, last_used_at, created_at FROM api_keys ORDER BY created_at DESC'
		).all<AdminApiKey>();
		return results ?? [];
	} catch {
		return [];
	}
}

export interface PlatformStats {
	users: number;
	facilities: number;
	buildings: number;
	documents: number;
	media: number;
}

export async function platformStats(env: Env): Promise<PlatformStats> {
	const row = await env.DB.prepare(
		`SELECT
		   (SELECT COUNT(*) FROM users) AS users,
		   (SELECT COUNT(*) FROM facilities) AS facilities,
		   (SELECT COUNT(*) FROM buildings) AS buildings,
		   (SELECT COUNT(*) FROM documents) AS documents,
		   (SELECT COUNT(*) FROM media_assets) AS media`
	).first<PlatformStats>();
	return row ?? { users: 0, facilities: 0, buildings: 0, documents: 0, media: 0 };
}
