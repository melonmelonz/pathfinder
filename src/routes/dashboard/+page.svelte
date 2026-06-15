<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const user = $derived(data.user);

	const roleLabel: Record<string, string> = {
		admin: 'Administrator',
		staff: 'Staff',
		client: 'Client'
	};

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

	<div class="panel">
		<p>
			This is your scoped workspace. Facility maps, scans, and review projects
			will appear here as later sprints land.
		</p>
	</div>
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
	.role {
		color: var(--brand-muted);
	}
	.role strong {
		color: var(--brand-text);
	}
	.org {
		color: var(--brand-muted);
	}
	.panel {
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
		padding: var(--space-4);
		color: var(--brand-muted);
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
