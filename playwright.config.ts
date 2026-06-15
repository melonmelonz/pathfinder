import { defineConfig, devices } from '@playwright/test';

// E2E harness (Epic E14). Boots the production preview server and runs the
// seed specs in tests/e2e. Screenshots land in tests/e2e/__screenshots__.
const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	outputDir: 'test-results',
	fullyParallel: true,
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
		command: 'npm run preview',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
