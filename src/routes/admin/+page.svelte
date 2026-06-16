<script lang="ts">
	// Admin console (Epic E13): platform stats, user management, audit viewer,
	// search reindex, immutable audit export.
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	let reindexing = $state(false);
	let reindexMsg = $state('');
	async function reindex() {
		reindexing = true;
		const res = await fetch('/api/search/reindex', { method: 'POST' });
		reindexMsg = res.ok ? `Reindexed ${((await res.json()) as { indexed: number }).indexed} entities.` : 'Reindex failed.';
		reindexing = false;
	}

	async function toggleActive(id: string, active: number) {
		await fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ active: !active })
		});
		await invalidateAll();
	}

	const stats = $derived(data.stats);
	const cards = $derived([
		{ k: 'users', label: 'Users', v: stats.users },
		{ k: 'facilities', label: 'Facilities', v: stats.facilities },
		{ k: 'buildings', label: 'Buildings', v: stats.buildings },
		{ k: 'documents', label: 'Floorplans', v: stats.documents },
		{ k: 'media', label: 'Media', v: stats.media }
	]);
</script>

<section class="admin">
	<header class="ahead">
		<h1>Admin console</h1>
		<div class="tools">
			<button onclick={reindex} disabled={reindexing} data-testid="reindex">{reindexing ? 'Reindexing...' : 'Reindex search'}</button>
			<a class="dl" href="/api/admin/audit?format=csv" data-testid="audit-export">Export audit (CSV)</a>
		</div>
	</header>
	{#if reindexMsg}<p class="muted" data-testid="reindex-msg">{reindexMsg}</p>{/if}

	<ul class="cards" data-testid="admin-stats">
		{#each cards as c (c.k)}
			<li class="card"><span class="count">{c.v}</span><span class="lbl">{c.label}</span></li>
		{/each}
	</ul>

	<h2>Users</h2>
	<table data-testid="admin-users">
		<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Org</th><th>Status</th><th></th></tr></thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<td>{u.name}</td>
					<td>{u.email}</td>
					<td>{u.role}</td>
					<td>{u.org ?? '-'}</td>
					<td>{u.active ? 'active' : 'disabled'}</td>
					<td><button class="sm" onclick={() => toggleActive(u.id, u.active)}>{u.active ? 'Disable' : 'Enable'}</button></td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2>API keys</h2>
	{#if data.apiKeys.length}
		<table data-testid="admin-apikeys">
			<thead><tr><th>Name</th><th>Key</th><th>Status</th></tr></thead>
			<tbody>
				{#each data.apiKeys as k (k.id)}
					<tr><td>{k.name}</td><td>{k.masked_key ?? '-'}</td><td>{k.revoked ? 'revoked' : 'active'}</td></tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="muted">No API keys (the v1 import seeds these).</p>
	{/if}

	<h2>Recent audit log</h2>
	<table data-testid="admin-audit">
		<thead><tr><th>When</th><th>Action</th><th>Resource</th><th>IP</th></tr></thead>
		<tbody>
			{#each data.audit as a (a.id)}
				<tr><td>{a.created_at}</td><td>{a.action}</td><td>{a.resource ?? '-'}</td><td>{a.ip ?? '-'}</td></tr>
			{:else}
				<tr><td colspan="4" class="muted">No audit entries yet.</td></tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.admin { display: flex; flex-direction: column; gap: var(--space-3); }
	.ahead { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
	h1 { font-size: 1.6rem; }
	h2 { font-size: 1.1rem; margin-top: var(--space-3); }
	.tools { display: flex; gap: var(--space-2); align-items: center; }
	.tools button, .dl { padding: var(--space-1) var(--space-3); background: var(--brand-surface); color: var(--brand-text); border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent); border-radius: var(--radius); cursor: pointer; text-decoration: none; font-size: 0.85rem; }
	.muted { color: var(--brand-muted); }
	.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); gap: var(--space-2); list-style: none; padding: 0; margin: 0; }
	.card { display: flex; flex-direction: column; gap: var(--space-1); background: var(--brand-surface); border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent); border-radius: var(--radius); padding: var(--space-3); }
	.count { font-size: 1.6rem; font-weight: 700; color: var(--brand-primary); font-family: var(--brand-font-display); }
	.lbl { font-size: 0.8rem; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.05em; }
	table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
	th, td { text-align: left; padding: var(--space-2); border-bottom: 1px solid color-mix(in srgb, var(--brand-secondary) 25%, transparent); }
	th { color: var(--brand-muted); font-weight: 600; }
	.sm { padding: 0.1em 0.6em; background: transparent; color: var(--brand-text); border: 1px solid var(--brand-secondary); border-radius: var(--radius); cursor: pointer; font-size: 0.75rem; }
</style>
