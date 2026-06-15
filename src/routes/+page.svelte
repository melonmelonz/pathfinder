<script lang="ts">
	import { activeBrand } from '$lib/brand';
	const brand = activeBrand;
</script>

<section class="hero">
	<p class="eyebrow">{brand.operatorName}</p>
	<h1>{brand.productName}</h1>
	<p class="lede">{brand.tagline}</p>
	<p class="sub">
		An open platform for emergency floorplan mapping, NFPA-compliant safety
		annotation, and 3D facility documentation - built so first responders can
		find what they need inside a building before they arrive.
	</p>
	<div class="cta">
		<a class="btn-primary" href="/login">Sign in</a>
		<a class="btn-secondary" href="#editions">Compare editions</a>
	</div>
</section>

<section id="editions" class="editions" aria-labelledby="editions-title">
	<h2 id="editions-title">Editions</h2>
	<div class="cards">
		<article class="card">
			<h3>Open Source Community Edition</h3>
			<p class="price">Free, self-hosted</p>
			<ul>
				<li>Full white-label brand layer</li>
				<li>2D floorplan annotation and NFPA 170 map export</li>
				<li>Org hierarchy, projects, and review workflow</li>
				<li>Deploy to your own Cloudflare account</li>
			</ul>
		</article>
		<article class="card card-pro">
			<h3>Pathfinder Pro</h3>
			<p class="price">Hosted and supported</p>
			<ul>
				<li>Everything in Community Edition</li>
				<li>Managed hosting, backups, and SLAs</li>
				<li>3D splat scan viewer and scan library</li>
				<li>Compliance reporting and priority support</li>
			</ul>
		</article>
	</div>
	<p class="editions-note">
		Pathfinder is open core: the Community Edition is the platform; Pathfinder
		Pro is the hosted, supported deployment run by {brand.operatorName}.
	</p>
</section>

<style>
	.hero {
		max-width: 44rem;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.78rem;
		color: var(--brand-primary);
		font-family: var(--brand-font-mono);
		margin-bottom: var(--space-2);
	}
	h1 {
		font-size: clamp(2.5rem, 6vw, 4rem);
		margin-bottom: var(--space-2);
	}
	.lede {
		font-size: 1.25rem;
		color: var(--brand-text);
		margin-bottom: var(--space-3);
	}
	.sub {
		color: var(--brand-muted);
		max-width: 38rem;
		margin-bottom: var(--space-4);
	}
	.cta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.btn-primary,
	.btn-secondary {
		display: inline-block;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius);
		text-decoration: none;
		font-weight: 600;
	}
	.btn-primary {
		background: var(--brand-primary);
		color: var(--brand-bg);
		border: 1px solid var(--brand-primary);
	}
	.btn-primary:hover {
		background: var(--brand-accent);
		border-color: var(--brand-accent);
	}
	.btn-secondary {
		background: transparent;
		color: var(--brand-text);
		border: 1px solid var(--brand-secondary);
	}
	.btn-secondary:hover {
		background: color-mix(in srgb, var(--brand-primary) 18%, transparent);
	}

	.editions {
		margin-top: var(--space-6);
	}
	.editions h2 {
		font-size: 1.8rem;
		margin-bottom: var(--space-4);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-3);
	}
	.card {
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
		padding: var(--space-4);
	}
	.card-pro {
		border-color: var(--brand-primary);
	}
	.card h3 {
		font-size: 1.2rem;
		margin-bottom: var(--space-1);
	}
	.price {
		color: var(--brand-primary);
		font-family: var(--brand-font-mono);
		font-size: 0.85rem;
		margin-bottom: var(--space-3);
	}
	.card ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		color: var(--brand-muted);
	}
	.card li::before {
		content: '+ ';
		color: var(--brand-accent);
		font-family: var(--brand-font-mono);
	}
	.editions-note {
		margin-top: var(--space-4);
		color: var(--brand-muted);
		font-size: 0.9rem;
		max-width: 40rem;
	}
</style>
