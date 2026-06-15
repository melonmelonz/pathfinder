// Seed E2E spec (Epic E14). Worked example for the per-AC Playwright tests
// described in docs/04-tdd-plan.md (T-<AC> ids).
import { test, expect } from '@playwright/test';

test('T-1.1.1 landing page shows the brand wordmark and editions', async ({ page }) => {
	await page.goto('/');

	// Brand wordmark is visible in the header (default brand: Pathfinder).
	await expect(page.getByRole('link', { name: /home/i })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	// Editions are mentioned (open-core split). Target the edition headings
	// specifically (the names also appear in the explanatory note below).
	await expect(page.getByRole('heading', { name: 'Open Source Community Edition' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Pathfinder Pro' })).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/landing.png', fullPage: true });
});
