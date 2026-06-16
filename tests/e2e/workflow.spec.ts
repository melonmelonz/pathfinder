// E2E for the project review workflow (Epic E4). Drives a guarded status
// transition on the building page against the seeded WAHS projects.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const BUILDING = 'bld-wahs-main-0000-000000000001';

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('E4 a draft project can be submitted for review along a legal edge', async ({ page }) => {
	await login(page);
	await page.goto(`/buildings/${BUILDING}`);

	const list = page.getByTestId('project-list');
	await expect(list).toBeVisible();

	// The seeded "NFPA 170 marker pass" project is in draft -> offers Submit.
	const draftRow = list.locator('li').filter({ hasText: 'NFPA 170 marker pass' });
	await expect(draftRow.getByTestId('project-status')).toHaveText(/Draft/i);

	await draftRow.getByTestId('transition-in_review').click();

	// After the guarded transition + reload, it reads as In review.
	await expect(
		page
			.getByTestId('project-list')
			.locator('li')
			.filter({ hasText: 'NFPA 170 marker pass' })
			.getByTestId('project-status')
	).toHaveText(/In review/i);

	await page.screenshot({ path: 'tests/e2e/__screenshots__/project-workflow.png', fullPage: true });
});
