// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces.
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			// Cloudflare bindings (canonical sec 3) are available here once
			// declared in wrangler.toml. Uncomment as the backend lands.
			env?: {
				// DB: D1Database;
				// DOCUMENTS: R2Bucket;
				// CACHE: KVNamespace;
			};
		}
	}
}

export {};
