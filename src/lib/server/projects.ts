// Project review-workflow DAL (Epic E4). Scoped project reads (via the building
// -> facility -> org chain), guarded status transitions, and member assignment.
// Status edges are validated by the pure workflow engine; the server is the
// authority. Transitions and membership changes are written to the activity log.

import { uuid } from './auth';
import { canSeeOrg, type ScopeUser } from './hierarchy';
import { logActivity } from './collab';
import { canTransition, progressForStatus, type ProjectStatus, type MemberRole } from '$lib/engines/workflow/status';

type Env = { DB: D1Database };

export interface ProjectRow {
	id: string;
	building_id: string | null;
	name: string;
	status: ProjectStatus;
	progress: number;
	created_by: string | null;
	created_at: string;
	updated_at: string | null;
}

async function projectOrgName(env: Env, projectId: string): Promise<string | null> {
	const row = await env.DB.prepare(
		`SELECT o.name AS n FROM projects p
		   JOIN buildings b ON b.id = p.building_id
		   JOIN facilities f ON f.id = b.facility_id
		   JOIN orgs o ON o.id = f.org_id
		  WHERE p.id = ?`
	)
		.bind(projectId)
		.first<{ n: string }>();
	return row?.n ?? null;
}

export async function getProject(env: Env, user: ScopeUser, id: string): Promise<ProjectRow | null> {
	const row = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
	if (!row) return null;
	const org = await projectOrgName(env, id);
	if (org === null) return user.role !== 'client' ? row : null;
	if (!canSeeOrg(user, org)) return null;
	return row;
}

export interface TransitionResult {
	ok: boolean;
	error?: string;
	status?: ProjectStatus;
	progress?: number;
}

/** Transition a project's status along a legal edge, stamping progress + time
 *  and logging activity. Rejects illegal edges. */
export async function transitionStatus(
	env: Env,
	actorId: string,
	project: ProjectRow,
	to: ProjectStatus
): Promise<TransitionResult> {
	if (!canTransition(project.status, to)) {
		return { ok: false, error: `Cannot move a project from ${project.status} to ${to}.` };
	}
	const progress = progressForStatus(to);
	await env.DB.prepare("UPDATE projects SET status = ?, progress = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(to, progress, project.id)
		.run();
	await logActivity(env, actorId, `project.${to}`, 'project', project.id, `${project.name}: ${project.status} -> ${to}`);
	return { ok: true, status: to, progress };
}

export interface MemberRow {
	project_id: string;
	user_id: string;
	role: MemberRole;
	added_at: string;
	name?: string;
	email?: string;
}

export async function listMembers(env: Env, projectId: string): Promise<MemberRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT pm.*, u.name, u.email FROM project_members pm
		   JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.name`
	)
		.bind(projectId)
		.all<MemberRow>();
	return results ?? [];
}

export async function addMember(
	env: Env,
	actorId: string,
	projectId: string,
	userId: string,
	role: MemberRole
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
		 ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`
	)
		.bind(projectId, userId, role)
		.run();
	await logActivity(env, actorId, 'project.member.add', 'project', projectId, `added member as ${role}`);
}

export async function removeMember(env: Env, actorId: string, projectId: string, userId: string): Promise<void> {
	await env.DB.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
		.bind(projectId, userId)
		.run();
	await logActivity(env, actorId, 'project.member.remove', 'project', projectId, 'removed member');
}
