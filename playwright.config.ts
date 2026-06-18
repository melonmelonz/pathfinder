import { defineConfig, devices } from '@playwright/test';

// E2E harness (Epic E14). Boots the app via `wrangler pages dev` so server
// routes have the Cloudflare bindings (D1 `DB`, JWT_SECRET from .dev.vars) and
// the seeded test users, then runs the specs in tests/e2e. Screenshots land in
// tests/e2e/__screenshots__.
const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	outputDir: 'test-results',
	// All specs share ONE local D1 (miniflare SQLite) behind the dev server, so
	// they run serially - parallel workers cause SQLite write-contention flakes
	// (a full-table reindex racing concurrent writes). Production D1 handles
	// concurrency fine; this is purely a single-file-SQLite test-runner artifact.
	fullyParallel: false,
	workers: 1,
	reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		screenshot: 'on',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		// Build, apply the local D1 migration, seed the test users, then serve
		// the built worker with the local bindings so login works end to end.
		command: 'npm run e2e:serve',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
