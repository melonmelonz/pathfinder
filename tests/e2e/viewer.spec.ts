// E2E for the 2D annotation viewer + map/NFPA export (Epics E5, E6) and the
// non-visual text alternative (E12). Drives the real /documents/[id] route
// against `wrangler pages dev` with the seeded WAHS Floor 1 document.

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

test('E5 viewer renders the 12-tool toolbar, the canvas and the seeded annotations', async ({
	page
}) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	// Toolbar with all 12 annotation tools + select/pan.
	await expect(page.getByTestId('toolbar')).toBeVisible();
	for (const t of ['circle', 'rect', 'arrow', 'freehand', 'comment', 'correction', 'aed', 'stairs', 'door', 'overhead', 'exit', 'fireext']) {
		await expect(page.getByTestId(`tool-${t}`)).toBeVisible();
	}
	await expect(page.getByTestId('annotation-canvas')).toBeVisible();

	// The 4 seeded annotations load (after onMount seeds them).
	await expect(page.getByTestId('annotation-count')).toHaveText(/4 annotations/);
	await expect(page.getByTestId('page-indicator')).toContainText('Page 1');

	// Editing controls present for staff/admin.
	await expect(page.getByTestId('save')).toBeVisible();
	await expect(page.getByTestId('export-json')).toBeVisible();

	await page.screenshot({ path: 'tests/e2e/__screenshots__/viewer.png', fullPage: true });
});

test('E5 selecting a tool activates it and undo/redo are wired', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	const circle = page.getByTestId('tool-circle');
	await circle.click();
	await expect(circle).toHaveClass(/active/);

	await expect(page.getByTestId('undo')).toBeVisible();
	await expect(page.getByTestId('redo')).toBeVisible();
});

test('E6 map mode exposes marker tools and the NFPA export button', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	await expect(page.getByTestId('export-map')).toBeVisible();
	await page.getByTestId('map-mode-toggle').click();

	await expect(page.getByTestId('map-toolbar')).toBeVisible();
	for (const t of ['stairs', 'hallway', 'door', 'elevator', 'room']) {
		await expect(page.getByTestId(`map-tool-${t}`)).toBeVisible();
	}
	await page.screenshot({ path: 'tests/e2e/__screenshots__/viewer-map-mode.png', fullPage: true });
});

test('E12 the floor has a non-visual text alternative for screen readers', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();

	const alt = page.getByTestId('text-alternative');
	await expect(alt).toBeVisible();
	await alt.locator('summary').click();
	// Seeded floor has an AED, an exit and a comment -> headings appear.
	await expect(alt).toContainText(/AED/i);
});
