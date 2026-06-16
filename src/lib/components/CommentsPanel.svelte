<script lang="ts">
	// Anchored comment threads + resolve workflow (Epic E9). Comments attach to
	// the currently-selected annotation. Resolving hides (does not delete) the
	// thread; toggle "Show resolved" to see the audit trail. @-mentions in the
	// body fan out to batched notifications server-side.
	import { onMount } from 'svelte';

	interface Comment {
		id: string;
		annotation_id: string;
		text: string;
		resolved: number;
		author_name?: string;
		created_at: string;
	}

	let {
		documentId,
		selectedId,
		canEdit
	}: { documentId: string; selectedId: string | null; canEdit: boolean } = $props();

	let comments = $state<Comment[]>([]);
	let showResolved = $state(false);
	let draft = $state('');
	let busy = $state(false);

	async function load() {
		const res = await fetch(`/api/documents/${documentId}/comments${showResolved ? '?all=1' : ''}`);
		if (res.ok) comments = ((await res.json()) as { comments: Comment[] }).comments;
	}

	onMount(load);

	async function add() {
		if (!selectedId) return;
		if (!draft.trim()) return;
		busy = true;
		const res = await fetch(`/api/documents/${documentId}/comments`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ annotationId: selectedId, text: draft.trim() })
		});
		busy = false;
		if (res.ok) {
			draft = '';
			await load();
		}
	}

	async function toggleResolve(c: Comment) {
		await fetch(`/api/comments/${c.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ resolved: !c.resolved })
		});
		await load();
	}
</script>

<aside class="comments" data-testid="comments-panel">
	<header>
		<h2>Comments</h2>
		<label class="toggle">
			<input type="checkbox" bind:checked={showResolved} onchange={load} data-testid="show-resolved" />
			Show resolved
		</label>
	</header>

	<ul class="clist" data-testid="comment-list">
		{#each comments as c (c.id)}
			<li class:resolved={c.resolved} data-testid="comment">
				<p class="body">{c.text}</p>
				<p class="meta">
					{c.author_name ?? 'Unknown'}
					{#if c.resolved}<span class="rb">resolved</span>{/if}
				</p>
				{#if canEdit}
					<button class="resolve" onclick={() => toggleResolve(c)} data-testid="resolve-toggle">
						{c.resolved ? 'Reopen' : 'Resolve'}
					</button>
				{/if}
			</li>
		{:else}
			<li class="muted">No comments{showResolved ? '' : ' (open)'} yet.</li>
		{/each}
	</ul>

	{#if canEdit}
		<form onsubmit={(e) => { e.preventDefault(); add(); }}>
			<textarea
				bind:value={draft}
				placeholder={selectedId ? 'Comment on the selected annotation. Use @name to mention.' : 'Select an annotation to comment on it.'}
				disabled={!selectedId || busy}
				data-testid="comment-draft"
			></textarea>
			<button type="submit" disabled={!selectedId || busy || !draft.trim()} data-testid="comment-submit">
				{busy ? 'Posting...' : 'Comment'}
			</button>
		</form>
	{/if}
</aside>

<style>
	.comments { width: 16rem; display: flex; flex-direction: column; gap: var(--space-2); }
	header { display: flex; flex-direction: column; gap: var(--space-1); }
	h2 { font-size: 1rem; }
	.toggle { font-size: 0.75rem; color: var(--brand-muted); display: flex; gap: var(--space-1); align-items: center; }
	.clist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
	.clist li { background: var(--brand-surface); border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent); border-radius: var(--radius); padding: var(--space-2); }
	.clist li.resolved { opacity: 0.6; }
	.body { font-size: 0.85rem; }
	.meta { font-size: 0.72rem; color: var(--brand-muted); margin-top: var(--space-1); }
	.rb { color: var(--brand-primary); margin-left: var(--space-1); }
	.resolve { margin-top: var(--space-1); font-size: 0.75rem; padding: 0.1em 0.6em; background: transparent; color: var(--brand-text); border: 1px solid var(--brand-secondary); border-radius: var(--radius); cursor: pointer; }
	.muted { color: var(--brand-muted); font-size: 0.85rem; }
	textarea { width: 100%; min-height: 4rem; background: var(--brand-surface); color: var(--brand-text); border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent); border-radius: var(--radius); padding: var(--space-2); font: inherit; }
	form button { margin-top: var(--space-1); padding: var(--space-1) var(--space-3); background: var(--brand-primary); color: var(--brand-bg); border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer; }
	form button:disabled { opacity: 0.55; cursor: default; }
</style>
