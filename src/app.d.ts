// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces.
/// <reference types="@cloudflare/workers-types" />

/** Authenticated user shape exposed on event.locals (Epic E2). */
interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'staff' | 'client';
	org: string | null;
	active: number;
	mfa_enabled: number;
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Populated by hooks.server.ts from the JWT, or null if unauthenticated. */
			user: SessionUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			// Cloudflare bindings (canonical sec 3), available in dev via the
			// SvelteKit platformProxy (wrangler.toml) and in production on Pages.
			env?: {
				DB: D1Database;
				JWT_SECRET?: string;
				// DOCUMENTS: R2Bucket;
				CACHE?: KVNamespace;
			};
		}
	}
}

export {};
