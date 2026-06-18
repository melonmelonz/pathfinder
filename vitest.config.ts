import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit-test config (Epic E14). Kept separate from vite.config.ts so the
// SvelteKit plugin's vite types are not mixed with vitest's bundled vite.
// E2E is owned by Playwright (playwright.config.ts).
export default defineConfig({
	resolve: {
		alias: {
			// Mirror SvelteKit's $lib alias so server modules under test resolve.
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
