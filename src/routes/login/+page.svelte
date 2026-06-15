<script lang="ts">
	import { activeBrand } from '$lib/brand';
	const brand = activeBrand;

	// Static login form. No authentication backend yet - the JWT/API-key
	// auth port lands in Sprint 1 (Epic E2). Submitting shows a notice.
	let notice = $state('');

	function handleSubmit(event: Event) {
		event.preventDefault();
		notice = 'Authentication backend arrives in Sprint 1. This form is a static foundation.';
	}
</script>

<section class="login">
	<h1>Sign in to {brand.productName}</h1>
	<p class="intro">Access your facility maps, scans, and review projects.</p>

	<form class="form" onsubmit={handleSubmit} novalidate>
		<div class="field">
			<label for="email">Email address</label>
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				inputmode="email"
				required
				aria-required="true"
			/>
		</div>

		<div class="field">
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				aria-required="true"
			/>
		</div>

		<button class="btn-primary" type="submit">Sign in</button>

		{#if notice}
			<p class="notice" role="status" aria-live="polite">{notice}</p>
		{/if}
	</form>

	<p class="support">
		Need help? <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
	</p>
</section>

<style>
	.login {
		max-width: 26rem;
		margin: 0 auto;
	}
	h1 {
		font-size: 1.8rem;
		margin-bottom: var(--space-2);
	}
	.intro {
		color: var(--brand-muted);
		margin-bottom: var(--space-4);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
		padding: var(--space-4);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	label {
		font-size: 0.9rem;
		font-weight: 600;
	}
	input {
		background: var(--brand-bg);
		color: var(--brand-text);
		border: 1px solid var(--brand-secondary);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-3);
	}
	input::placeholder {
		color: var(--brand-muted);
	}
	.btn-primary {
		margin-top: var(--space-1);
		padding: var(--space-2) var(--space-4);
		background: var(--brand-primary);
		color: var(--brand-bg);
		border: 1px solid var(--brand-primary);
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
	}
	.btn-primary:hover {
		background: var(--brand-accent);
		border-color: var(--brand-accent);
	}
	.notice {
		color: var(--brand-accent);
		font-size: 0.9rem;
		background: color-mix(in srgb, var(--brand-primary) 14%, transparent);
		border: 1px solid var(--brand-secondary);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-3);
	}
	.support {
		margin-top: var(--space-4);
		text-align: center;
		color: var(--brand-muted);
		font-size: 0.9rem;
	}
	.support a {
		color: var(--brand-primary);
	}
</style>
