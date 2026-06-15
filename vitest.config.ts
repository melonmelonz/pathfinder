import { defineConfig } from 'vitest/config';

// Unit-test config (Epic E14). Kept separate from vite.config.ts so the
// SvelteKit plugin's vite types are not mixed with vitest's bundled vite.
// E2E is owned by Playwright (playwright.config.ts).
export default defineConfig({
	test: {
		include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
