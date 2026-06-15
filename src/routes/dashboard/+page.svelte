<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const user = $derived(data.user);
	const counts = $derived(data.counts);
	const facilities = $derived(data.facilities);
	const districts = $derived(data.districts);

	const roleLabel: Record<string, string> = {
		admin: 'Administrator',
		staff: 'Staff',
		client: 'Client'
	};

	// Roll-up cards (AC-3.3.1): aggregated counts for the caller's scope.
	const cards = $derived([
		{ key: 'districts', label: 'Districts', value: counts.districts },
		{ key: 'facilities', label: 'Facilities', value: counts.facilities },
		{ key: 'buildings', label: 'Buildings', value: counts.buildings },
		{ key: 'projects', label: 'Projects', value: counts.projects }
	]);

	let signingOut = $state(false);

	async function logout() {
		signingOut = true;
		await fetch('/api/auth/logout', { method: 'POST' });
		await goto('/login');
	}
</script>

<section class="dashboard">
	<header class="head">
		<div>
			<p class="eyebrow">Dashboard</p>
			<h1>Welcome, {user.name}</h1>
			<p class="role" data-testid="user-role">
				Signed in as <strong>{roleLabel[user.role] ?? user.role}</strong>
				{#if user.org}<span class="org">&middot; {user.org}</span>{/if}
			</p>
		</div>
		<button class="btn-logout" type="button" onclick={logout} disabled={signingOut}>
			{signingOut ? 'Signing out...' : 'Sign out'}
		</button>
	</header>

	<h2 class="section-title">Roll-up</h2>
	<ul class="cards" data-testid="rollup-cards" aria-label="Hierarchy roll-up counts">
		{#each cards as card (card.key)}
			<li class="card" data-testid={`rollup-${card.key}`}>
				<span class="count">{card.value}</span>
				<span class="card-label">{card.label}</span>
			</li>
		{/each}
	</ul>

	{#if districts.length > 0}
		<h2 class="section-title">Districts</h2>
		<ul class="list" data-testid="district-list">
			{#each districts as d (d.id)}
				<li>
					<a class="row" href={`/districts/${d.id}`} data-testid="district-link">
						<span class="row-name">{d.name}</span>
						<span class="row-go" aria-hidden="true">&rarr;</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<h2 class="section-title">Facilities</h2>
	{#if facilities.length > 0}
		<ul class="list" data-testid="facility-list">
			{#each facilities as f (f.id)}
				<li>
					<a class="row" href={`/facilities/${f.id}`} data-testid="facility-link">
						<span class="row-name">{f.name}</span>
						{#if f.address}<span class="row-meta">{f.address}</span>{/if}
						<span class="row-go" aria-hidden="true">&rarr;</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<!-- Designed empty state: a sample preview and one clear first action
		     (AC-3.4.1, research/04). -->
		<div class="empty" data-testid="empty-state">
			<p class="empty-title">No facilities yet</p>
			<p class="empty-body">
				When facilities are added to your organization, their maps, scans, and
				review projects will roll up here. A typical facility looks like
				<em>"Wellsboro Area High School"</em> with one or more buildings inside.
			</p>
			<a class="empty-action" href="/dashboard" data-testid="empty-action"
				>Refresh dashboard</a
			>
		</div>
	{/if}
</section>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--brand-muted);
		margin-bottom: var(--space-1);
	}
	h1 {
		font-size: 1.8rem;
		margin-bottom: var(--space-2);
	}
	.section-title {
		font-size: 1.1rem;
		margin-bottom: calc(-1 * var(--space-2));
		color: var(--brand-text);
	}
	.role {
		color: var(--brand-muted);
	}
	.role strong {
		color: var(--brand-text);
	}
	.org {
		color: var(--brand-muted);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--space-3);
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
		padding: var(--space-4);
	}
	.count {
		font-size: 2rem;
		font-weight: 700;
		font-family: var(--brand-font-display);
		color: var(--brand-primary);
		line-height: 1;
	}
	.card-label {
		font-size: 0.85rem;
		color: var(--brand-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--brand-text);
	}
	.row:hover {
		background: color-mix(in srgb, var(--brand-primary) 12%, transparent);
	}
	.row-name {
		font-weight: 600;
	}
	.row-meta {
		color: var(--brand-muted);
		font-size: 0.85rem;
	}
	.row-go {
		margin-left: auto;
		color: var(--brand-muted);
	}

	.empty {
		background: var(--brand-surface);
		border: 1px dashed color-mix(in srgb, var(--brand-secondary) 50%, transparent);
		border-radius: var(--radius);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.empty-title {
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--brand-text);
	}
	.empty-body {
		color: var(--brand-muted);
		max-width: 42rem;
	}
	.empty-action {
		display: inline-block;
		padding: var(--space-2) var(--space-3);
		background: var(--brand-primary);
		color: var(--brand-bg);
		border-radius: var(--radius);
		text-decoration: none;
		font-weight: 600;
	}

	.btn-logout {
		padding: var(--space-2) var(--space-3);
		background: transparent;
		color: var(--brand-text);
		border: 1px solid var(--brand-secondary);
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
	}
	.btn-logout:hover {
		background: color-mix(in srgb, var(--brand-primary) 18%, transparent);
	}
	.btn-logout:disabled {
		opacity: 0.6;
		cursor: progress;
	}
</style>
