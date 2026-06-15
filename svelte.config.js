import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Cloudflare Pages + Functions deployment target (canonical sec 3).
		// adapter-cloudflare emulates platform bindings in `vite dev` from
		// wrangler.toml + .dev.vars (D1 `DB`, JWT_SECRET), so server routes can
		// read `platform.env` locally just as they do on Pages.
		adapter: adapter()
	}
};

export default config;
