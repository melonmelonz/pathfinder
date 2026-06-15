<script lang="ts">
	import Breadcrumbs, { type Crumb } from '$lib/components/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const facility = $derived(data.facility);
	const buildings = $derived(data.buildings);
	const counts = $derived(data.counts);

	// Breadcrumb: Dashboard / [district?] / [facility-switcher]. Capped at three
	// visible levels below the root (spec 9.3).
	const crumbs = $derived<Crumb[]>(
		[
			{ label: 'Dashboard', href: '/dashboard' },
			data.district
				? { label: data.district.name, href: `/districts/${data.district.id}` }
				: null,
			{
				label: facility.name,
				href: `/facilities/${facility.id}`,
				siblings: data.siblings.map((f) => ({
					id: f.id,
					name: f.name,
					href: `/facilities/${f.id}`
				}))
			}
		].filter(Boolean) as Crumb[]
	);
</script>

<Breadcrumbs {crumbs} />

<section class="entity">
	<header>
		<p class="eyebrow">Facility</p>
		<h1>{facility.name}</h1>
		{#if facility.address}<p class="muted">{facility.address}</p>{/if}
	</header>

	<ul class="cards" aria-label="Facility roll-up">
		<li class="card"><span class="count">{counts.buildings}</span><span>Buildings</span></li>
		<li class="card"><span class="count">{counts.projects}</span><span>Projects</span></li>
	</ul>

	<h2>Buildings</h2>
	{#if buildings.length > 0}
		<ul class="list" data-testid="building-list">
			{#each buildings as b (b.id)}
				<li>
					<a class="row" href={`/buildings/${b.id}`} data-testid="building-link">
						<span class="row-name">{b.name}</span>
						<span class="row-meta">{b.floors} floor{b.floors === 1 ? '' : 's'}</span>
						<span class="row-go" aria-hidden="true">&rarr;</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<!-- Designed empty state (AC-3.4.1): sample preview + one clear action. -->
		<div class="empty" data-testid="empty-state">
			<p class="empty-title">No buildings yet</p>
			<p class="empty-body">
				A facility usually contains one or more buildings, each with its own
				floorplans and scans. A sample looks like <em>"Main Building, 2 floors"</em>.
			</p>
			<a class="empty-action" href="/dashboard" data-testid="empty-action"
				>Back to dashboard</a
			>
		</div>
	{/if}
</section>

<style>
	.entity {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-4);
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--brand-muted);
	}
	h1 {
		font-size: 1.6rem;
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: calc(-1 * var(--space-2));
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
		color: var(--brand-muted);
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.count {
		font-size: 2rem;
		font-weight: 700;
		font-family: var(--brand-font-display);
		color: var(--brand-primary);
		line-height: 1;
		letter-spacing: 0;
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
	.muted {
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
</style>
