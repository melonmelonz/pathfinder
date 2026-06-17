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

test('AC-5.2.1 / AC-5.3.1 drawing a shape creates an annotation that persists across reload', async ({ page }) => {
	// Dedicated scratch document so this write test does not disturb the
	// read-only-count assertions on the primary seeded document.
	const SCRATCH = 'doc-wahs-scratch-00000000001';
	await login(page);
	// Reset the scratch doc so the test is isolated across runs.
	await page.request.put(`/api/documents/${SCRATCH}/annotations`, { data: { annotations: [] } });
	await page.goto(`/documents/${SCRATCH}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('annotation-count')).toHaveText(/0 annotations/);

	// Draw a circle by dragging on the canvas.
	const canvas = page.getByTestId('annotation-canvas');
	const box = (await canvas.boundingBox())!;
	await page.getByTestId('tool-circle').click();
	await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 5 });
	await page.mouse.up();
	await expect(page.getByTestId('annotation-count')).toHaveText(/1 annotations/);

	// Save, then reload -> the drawn annotation is still there (persisted).
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save')).toHaveText(/Saved/);
	await page.reload();
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('annotation-count')).toHaveText(/1 annotations/);
});

test('AC-5.4.1 the responder safety layer can be toggled off', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	const toggle = page.getByTestId('responder-layer-toggle').locator('input');
	await expect(toggle).toBeChecked();
	await toggle.uncheck();
	await expect(toggle).not.toBeChecked(); // safety markers hidden from the view
});

test('AC-6.1.2 only the fixed safety symbol catalog is placeable (no freehand symbol tool)', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	// The six NFPA safety markers are present...
	for (const m of ['aed', 'stairs', 'door', 'overhead', 'exit', 'fireext']) {
		await expect(page.getByTestId(`tool-${m}`)).toBeVisible();
	}
	// ...and there is no arbitrary/custom-symbol tool.
	await expect(page.getByTestId('tool-custom')).toHaveCount(0);
});

test('E5 annotated-PDF export is available alongside JSON export', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('export-json')).toBeVisible();
	await expect(page.getByTestId('export-annotated')).toBeVisible();
});

test('E5 delete prompts a confirm dialog before removing a selected annotation', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await expect(page.getByTestId('annotation-count')).toHaveText(/4 annotations/);

	// Select the seeded AED marker on the canvas, then press Delete -> confirm modal.
	const canvas = page.getByTestId('annotation-canvas');
	const box = (await canvas.boundingBox())!;
	await page.getByTestId('tool-select').click();
	await page.mouse.click(box.x + box.width * 0.32, box.y + box.height * 0.41 - 24); // marker body sits above the tip
	await page.keyboard.press('Delete');
	const modal = page.getByRole('dialog', { name: 'Confirm delete' });
	await expect(modal).toBeVisible();
	await page.getByTestId('delete-confirm').click();
	await expect(page.getByTestId('annotation-count')).toHaveText(/3 annotations/);
});

test('E6 map mode exposes the crop tool, print-style picker and map undo', async ({ page }) => {
	await login(page);
	await page.goto(`/documents/${DOC}`);
	await page.locator('html[data-hydrated="true"]').waitFor();
	await page.getByTestId('map-mode-toggle').click();
	await expect(page.getByTestId('map-tool-crop')).toBeVisible();
	await expect(page.getByTestId('map-undo')).toBeVisible();
	await expect(page.getByTestId('print-style')).toBeVisible();
	await page.getByTestId('print-style').selectOption('blueprint');
	await expect(page.getByTestId('print-style')).toHaveValue('blueprint');
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
