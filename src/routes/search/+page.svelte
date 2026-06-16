<script lang="ts">
	// Global search (Epic E10). As-you-type query across facilities, buildings,
	// projects, documents and marker labels, scoped server-side to the caller.
	import { goto } from '$app/navigation';
	import type { SearchHit } from '$lib/engines/search/query';

	let q = $state('');
	let hits = $state<SearchHit[]>([]);
	let searching = $state(false);
	let ran = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const TYPE_LABEL: Record<string, string> = {
		facility: 'Facility',
		building: 'Building',
		project: 'Project',
		document: 'Floorplan',
		marker: 'Marker'
	};

	async function run() {
		if (!q.trim()) {
			hits = [];
			ran = false;
			return;
		}
		searching = true;
		const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
		if (res.ok) {
			const data = (await res.json()) as { hits: SearchHit[] };
			hits = data.hits;
		}
		searching = false;
		ran = true;
	}

	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(run, 180);
	}
</script>

<section class="search">
	<h1>Search</h1>
	<input
		type="search"
		bind:value={q}
		oninput={onInput}
		placeholder="Search facilities, buildings, floorplans, markers..."
		aria-label="Search query"
		data-testid="search-input"
	/>

	{#if searching}<p class="muted">Searching...</p>{/if}

	{#if hits.length > 0}
		<ul class="results" data-testid="search-results">
			{#each hits as h (h.entity_type + h.entity_id)}
				<li>
					<button class="hit" onclick={() => goto(h.url)} data-testid="search-hit">
						<span class="badge">{TYPE_LABEL[h.entity_type] ?? h.entity_type}</span>
						<span class="title">{h.title}</span>
						{#if h.subtitle}<span class="sub">{h.subtitle}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else if ran && !searching}
		<p class="muted" data-testid="search-empty">No matches for "{q}".</p>
	{/if}
</section>

<style>
	.search { display: flex; flex-direction: column; gap: var(--space-3); }
	h1 { font-size: 1.6rem; }
	input {
		padding: var(--space-3);
		font-size: 1rem;
		background: var(--brand-surface);
		color: var(--brand-text);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 45%, transparent);
		border-radius: var(--radius);
	}
	.muted { color: var(--brand-muted); }
	.results { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
	.hit {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		border-radius: var(--radius);
		color: var(--brand-text);
		cursor: pointer;
		text-align: left;
	}
	.hit:hover { background: color-mix(in srgb, var(--brand-primary) 12%, transparent); }
	.badge {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15em 0.6em;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 50%, transparent);
		color: var(--brand-muted);
		min-width: 5rem;
		text-align: center;
	}
	.title { font-weight: 600; }
	.sub { color: var(--brand-muted); font-size: 0.85rem; margin-left: auto; }
</style>
