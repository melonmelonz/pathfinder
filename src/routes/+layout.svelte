<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { activeBrand, brandToCssVars } from '$lib/brand';
	import Logo from '$lib/components/Logo.svelte';

	// White-label shell (Epic E1).
	// The active brand's tokens are injected onto :root as CSS custom
	// properties. Every component below references var(--brand-*) only.
	//
	// TO REBRAND: add a profile in src/lib/brand/profiles/<id>.ts, register
	// it in src/lib/brand/index.ts, and build with VITE_BRAND=<id>.
	// Default brand is 'pathfinder'. No component edits required.

	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
	const brand = activeBrand;
	const cssVars = brandToCssVars(brand);
	const user = $derived(data.user);

	// Mark the document hydrated once the client app mounts. Lets E2E tests wait
	// for interactivity before driving progressively-enhanced forms (no race
	// against a pre-hydration native submit).
	onMount(() => {
		document.documentElement.setAttribute('data-hydrated', 'true');
	});
</script>

<svelte:head>
	<title>{brand.productName} - {brand.tagline}</title>
	<!-- Inject brand tokens onto the document root. -->
	{@html `<style>:root { ${cssVars} }</style>`}
</svelte:head>

<a class="skip-link" href="#main">Skip to main content</a>

<div class="shell">
	<header class="site-header">
		<a class="brand-link" href="/" aria-label={`${brand.productName} home`}>
			<Logo label={brand.productName} size={26} />
		</a>
		<nav class="site-nav" aria-label="Primary">
			{#if user}
				<a href="/search" class="btn-ghost" data-testid="nav-search">Search</a>
				<a href="/dashboard" class="btn-ghost">Dashboard</a>
				{#if user.role === 'admin'}
					<a href="/admin" class="btn-ghost" data-testid="nav-admin">Admin</a>
				{/if}
			{:else}
				<a href="/login" class="btn-ghost">Sign in</a>
			{/if}
		</nav>
	</header>

	<main id="main" class="site-main">
		{@render children?.()}
	</main>

	<footer class="site-footer">
		<p class="legal">{brand.legalFooter}</p>
		<p class="contact">
			<a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
		</p>
	</footer>
</div>

<style>
	.skip-link {
		position: absolute;
		left: -9999px;
		top: 0;
		background: var(--brand-surface);
		color: var(--brand-text);
		padding: var(--space-2) var(--space-3);
		z-index: 100;
		border: 1px solid var(--brand-secondary);
		border-radius: var(--radius);
	}
	.skip-link:focus {
		left: var(--space-3);
		top: var(--space-3);
	}

	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.site-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		gap: var(--space-3);
	}
	.brand-link {
		text-decoration: none;
	}

	.site-main {
		flex: 1;
		width: 100%;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}

	.site-footer {
		border-top: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		padding: var(--space-4);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		justify-content: space-between;
		font-size: 0.85rem;
		color: var(--brand-muted);
	}
	.site-footer a {
		color: var(--brand-primary);
	}

	.btn-ghost {
		display: inline-block;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--brand-secondary);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--brand-text);
		background: transparent;
		transition: background 0.15s ease;
	}
	.btn-ghost:hover {
		background: color-mix(in srgb, var(--brand-primary) 18%, transparent);
	}
</style>
