// E2E for collaboration (Epic E9): the comments panel + resolve workflow and
// the read-only share link round-trip.

import { test, expect, type Page } from '@playwright/test';

const ADMIN = { email: 'test@test.com', password: 'test1234' };
const DOC = 'doc-wahs-main-f1-000000000001';

async function login(page: Page) {
	await page.goto('/login');
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByLabel('Email address').fill(ADMIN.email);
	await page.getByLabel('Password').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

test('E9 the viewer shows a comments panel; the draft requires a selected annotation', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	const panel = page.getByTestId('comments-panel');
	await expect(panel).toBeVisible();
	// With nothing selected, the comment draft is disabled (anchored comments).
	await expect(page.getByTestId('comment-draft')).toBeDisabled();
	await expect(page.getByTestId('show-resolved')).toBeVisible();
});

test('E9 a share link mints a public read-only view of the floorplan', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	await page.getByTestId('share-link').click();
	const note = page.getByTestId('share-url');
	await expect(note).toBeVisible();
	const shareUrl = (await note.textContent()) ?? '';
	const match = shareUrl.match(/\/share\/[a-f0-9]+/);
	expect(match).not.toBeNull();

	// The share page is public (no auth) and read-only: open it in a fresh
	// context with no session cookie.
	const ctx = await page.context().browser()!.newContext();
	const anon = await ctx.newPage();
	await anon.goto(match![0]);
	await expect(anon.getByTestId('share-annotations')).toBeVisible();
	await expect(anon.locator('.eyebrow')).toContainText(/read only/i);
	await anon.screenshot({ path: 'tests/e2e/__screenshots__/share-readonly.png', fullPage: true });
	await ctx.close();
});
