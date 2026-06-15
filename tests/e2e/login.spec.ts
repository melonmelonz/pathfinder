// Seed E2E spec (Epic E14 / accessibility Epic E12). Worked example for the
// per-AC Playwright tests described in docs/04-tdd-plan.md (T-<AC> ids).
import { test, expect } from '@playwright/test';

test('T-2.1.1 login form exposes accessible, labeled fields', async ({ page }) => {
	await page.goto('/login');

	// Fields are reachable by their accessible label (real <label for=...>).
	const email = page.getByLabel('Email address');
	const password = page.getByLabel('Password');
	await expect(email).toBeVisible();
	await expect(password).toBeVisible();
	await expect(email).toHaveAttribute('type', 'email');
	await expect(password).toHaveAttribute('type', 'password');

	// Submit shows the Sprint 1 backend notice (no real auth yet).
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('status')).toContainText(/Sprint 1/i);

	await page.screenshot({ path: 'tests/e2e/__screenshots__/login.png', fullPage: true });
});
