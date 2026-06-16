<script lang="ts">
	// 2D floorplan annotation viewer (Epic E5). Hosts PDF.js + a canvas overlay
	// and drives the framework-agnostic engine modules. Falls back to a demo
	// floorplan when object storage is not yet wired (E7/S4) so the tooling stays
	// demonstrable. Map markers + NFPA export (E6) layer on in the map panel.
	import { onMount } from 'svelte';
	import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
	import type { PageData } from './$types';
	import { screenToCanvas, toNorm, calcFitScale, clampScale } from '$lib/engines/2d-annotate/coords';
	import { newHistory, pushUndo, undo as doUndo, redo as doRedo } from '$lib/engines/2d-annotate/undo';
	import { hitTest } from '$lib/engines/2d-annotate/hittest';
	import { commentNumbers, buildExport } from '$lib/engines/2d-annotate/export-json';
	import { renderAnnotations } from '$lib/engines/2d-annotate/render';
	import {
		MARKER_TOOLS,
		MIN_SHAPE_PX,
		DEFAULT_COLOR,
		type Annotation,
		type AnnotationType
	} from '$lib/engines/2d-annotate/types';

	let { data }: { data: PageData } = $props();

	type Tool = 'select' | 'pan' | AnnotationType;
	const TOOLS: { id: Tool; key: string; label: string }[] = [
		{ id: 'select', key: 's', label: 'Select' },
		{ id: 'pan', key: 'p', label: 'Pan' },
		{ id: 'circle', key: 'c', label: 'Circle' },
		{ id: 'rect', key: 'r', label: 'Rect' },
		{ id: 'arrow', key: 'a', label: 'Arrow' },
		{ id: 'freehand', key: 'f', label: 'Draw' },
		{ id: 'comment', key: 't', label: 'Comment' },
		{ id: 'correction', key: 'x', label: 'Correction' },
		{ id: 'aed', key: '1', label: 'AED' },
		{ id: 'stairs', key: '2', label: 'Stairs' },
		{ id: 'door', key: '3', label: 'Door' },
		{ id: 'overhead', key: '4', label: 'Overhead' },
		{ id: 'exit', key: '5', label: 'Exit' },
		{ id: 'fireext', key: '6', label: 'Fire Ext' }
	];

	// --- engine state --- (seeded from the server load in onMount; viewer owns it after)
	let annotations = $state<Annotation[]>([]);
	let tool = $state<Tool>('select');
	let color = $state(DEFAULT_COLOR);
	let currentPage = $state(1);
	let totalPages = $state(1);
	let scale = $state(1.5);
	let selectedId = $state<string | null>(null);
	let dirty = $state(false);
	let saving = $state(false);
	let demoMode = $state(false);
	let pdfPageWidth = 800;

	const history = newHistory();
	let pdfDoc: any = null;
	let pdfCanvas: HTMLCanvasElement;
	let annCanvas: HTMLCanvasElement;
	let area: HTMLDivElement;

	// drawing scratch
	let drawing = false;
	let startX = 0;
	let startY = 0;
	let points: Array<[number, number]> = [];

	function deserialize(rows: typeof data.annotations): Annotation[] {
		return rows.map((r) => ({
			id: r.id,
			page: r.page_number,
			type: r.type as AnnotationType,
			nx: r.nx,
			ny: r.ny,
			nw: r.nw,
			nh: r.nh,
			points: r.points ? JSON.parse(r.points) : undefined,
			color: r.color,
			text: r.text ?? undefined,
			resolved: !!r.resolved
		}));
	}

	const dims = () => ({ width: annCanvas.width, height: annCanvas.height });
	const nums = $derived(commentNumbers(annotations));

	function redraw() {
		if (!annCanvas) return;
		renderAnnotations(annCanvas.getContext('2d')!, annotations, currentPage, dims(), nums, selectedId);
	}

	async function renderPage(n: number) {
		if (demoMode) {
			drawDemo();
			redraw();
			return;
		}
		const page = await pdfDoc.getPage(n);
		const viewport = page.getViewport({ scale });
		for (const c of [pdfCanvas, annCanvas]) {
			c.width = viewport.width;
			c.height = viewport.height;
		}
		await page.render({ canvasContext: pdfCanvas.getContext('2d')!, viewport }).promise;
		redraw();
	}

	function drawDemo() {
		const w = Math.max((area?.clientWidth ?? 900) - 40, 320);
		const h = Math.round(w * 0.72);
		for (const c of [pdfCanvas, annCanvas]) {
			c.width = w;
			c.height = h;
		}
		const ctx = pdfCanvas.getContext('2d')!;
		ctx.fillStyle = '#f7f7f5';
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = '#94a3b8';
		ctx.lineWidth = 2;
		ctx.strokeRect(w * 0.08, h * 0.1, w * 0.84, h * 0.8);
		ctx.beginPath();
		ctx.moveTo(w * 0.5, h * 0.1);
		ctx.lineTo(w * 0.5, h * 0.9);
		ctx.moveTo(w * 0.08, h * 0.5);
		ctx.lineTo(w * 0.92, h * 0.5);
		ctx.stroke();
		ctx.fillStyle = '#64748b';
		ctx.font = '14px system-ui';
		ctx.fillText('Demo floorplan - object storage not configured (E7/S4)', w * 0.1, h * 0.06);
	}

	onMount(async () => {
		annotations = deserialize(data.annotations);
		try {
			const pdfjs = await import('pdfjs-dist');
			pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
			const res = await fetch(data.fileUrl);
			if (!res.ok) throw new Error('no file');
			const buf = await res.arrayBuffer();
			// isEvalSupported:false neutralises CVE-2024-4367 in the pinned 3.11.x.
			pdfDoc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
			totalPages = pdfDoc.numPages;
			const p1 = await pdfDoc.getPage(1);
			pdfPageWidth = p1.getViewport({ scale: 1 }).width;
			scale = clampScale(calcFitScale(area.clientWidth, pdfPageWidth));
			await renderPage(1);
		} catch {
			demoMode = true;
			totalPages = 1;
			await renderPage(1);
		}
	});

	function commit(a: Annotation) {
		pushUndo(history, annotations);
		annotations = [...annotations, a];
		selectedId = a.id;
		dirty = true;
		redraw();
	}

	function newId() {
		return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	function onPointerDown(e: PointerEvent) {
		if (!data.canEdit || tool === 'pan') return;
		const p = screenToCanvas(e.clientX, e.clientY, annCanvas.getBoundingClientRect(), dims());
		startX = p.x;
		startY = p.y;
		if (tool === 'select') {
			selectedId = hitTest(annotations, p.x, p.y, dims());
			redraw();
			return;
		}
		const n = toNorm(p.x, p.y, 0, 0, dims());
		if (tool === 'comment') {
			const text = window.prompt('Comment text:') ?? '';
			if (text.trim())
				commit({ id: newId(), page: currentPage, type: 'comment', nx: n.nx, ny: n.ny, nw: 0, nh: 0, color, text, createdAt: new Date().toISOString() });
			return;
		}
		if (MARKER_TOOLS.includes(tool as AnnotationType)) {
			commit({ id: newId(), page: currentPage, type: tool as AnnotationType, nx: n.nx, ny: n.ny, nw: 0, nh: 0, color });
			return;
		}
		drawing = true;
		points = tool === 'freehand' ? [[n.nx, n.ny]] : [];
	}

	function onPointerMove(e: PointerEvent) {
		if (!drawing) return;
		const p = screenToCanvas(e.clientX, e.clientY, annCanvas.getBoundingClientRect(), dims());
		const ctx = annCanvas.getContext('2d')!;
		redraw();
		ctx.save();
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.5;
		if (tool === 'freehand') {
			const n = toNorm(p.x, p.y, 0, 0, dims());
			points.push([n.nx, n.ny]);
			ctx.beginPath();
			ctx.moveTo(points[0][0] * annCanvas.width, points[0][1] * annCanvas.height);
			for (const pt of points) ctx.lineTo(pt[0] * annCanvas.width, pt[1] * annCanvas.height);
			ctx.stroke();
		} else {
			ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
		}
		ctx.restore();
	}

	function onPointerUp(e: PointerEvent) {
		if (!drawing) return;
		drawing = false;
		const p = screenToCanvas(e.clientX, e.clientY, annCanvas.getBoundingClientRect(), dims());
		if (tool === 'freehand') {
			if (points.length >= 3)
				commit({ id: newId(), page: currentPage, type: 'freehand', nx: 0, ny: 0, nw: 0, nh: 0, points: [...points], color });
			redraw();
			return;
		}
		const dx = p.x - startX;
		const dy = p.y - startY;
		if (Math.abs(dx) < MIN_SHAPE_PX && Math.abs(dy) < MIN_SHAPE_PX) {
			redraw();
			return;
		}
		const n = toNorm(startX, startY, dx, dy, dims());
		commit({ id: newId(), page: currentPage, type: tool as AnnotationType, nx: n.nx, ny: n.ny, nw: n.nw, nh: n.nh, color });
	}

	function undo() {
		const prev = doUndo(history, annotations);
		if (prev) {
			annotations = prev;
			selectedId = null;
			dirty = true;
			redraw();
		}
	}
	function redo() {
		const next = doRedo(history, annotations);
		if (next) {
			annotations = next;
			dirty = true;
			redraw();
		}
	}
	function deleteSelected() {
		if (!selectedId) return;
		pushUndo(history, annotations);
		annotations = annotations.filter((a) => a.id !== selectedId);
		selectedId = null;
		dirty = true;
		redraw();
	}

	async function save() {
		saving = true;
		const payload = annotations.map((a) => ({
			id: a.id,
			page: a.page,
			type: a.type,
			nx: a.nx,
			ny: a.ny,
			nw: a.nw,
			nh: a.nh,
			points: a.points,
			color: a.color,
			text: a.text,
			resolved: a.resolved
		}));
		const res = await fetch(`/api/documents/${data.document.id}/annotations`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ annotations: payload })
		});
		saving = false;
		if (res.ok) dirty = false;
	}

	function exportJson() {
		const env = buildExport(data.document.id, data.document.filename, annotations, new Date().toISOString());
		const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = data.document.filename.replace(/\.[^.]+$/, '') + '_annotations.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function gotoPage(n: number) {
		if (n < 1 || n > totalPages) return;
		currentPage = n;
		await renderPage(n);
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			undo();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
			e.preventDefault();
			redo();
			return;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			save();
			return;
		}
		if (e.key === 'Delete' || e.key === 'Backspace') {
			deleteSelected();
			return;
		}
		if (e.key === 'ArrowRight') gotoPage(currentPage + 1);
		if (e.key === 'ArrowLeft') gotoPage(currentPage - 1);
		const match = TOOLS.find((tl) => tl.key === e.key.toLowerCase());
		if (match) tool = match.id;
	}

	function setZoom(delta: number) {
		scale = clampScale(scale + delta);
		renderPage(currentPage);
	}
</script>

<svelte:window onkeydown={onKey} />

<section class="viewer">
	<header class="vhead">
		<div>
			<p class="eyebrow">Floorplan</p>
			<h1>{data.document.filename}</h1>
		</div>
		<div class="actions">
			<button onclick={() => setZoom(-0.25)} aria-label="Zoom out">-</button>
			<span class="zoom">{Math.round(scale * 100)}%</span>
			<button onclick={() => setZoom(0.25)} aria-label="Zoom in">+</button>
			{#if data.canEdit}
				<button onclick={undo} data-testid="undo">Undo</button>
				<button onclick={redo} data-testid="redo">Redo</button>
				<button class="primary" onclick={save} disabled={saving || !dirty} data-testid="save">
					{saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
				</button>
			{/if}
			<button onclick={exportJson} data-testid="export-json">Export JSON</button>
		</div>
	</header>

	<div class="workspace">
		{#if data.canEdit}
			<aside class="tools" data-testid="toolbar" aria-label="Annotation tools">
				{#each TOOLS as tl (tl.id)}
					<button
						class:active={tool === tl.id}
						onclick={() => (tool = tl.id)}
						data-testid={`tool-${tl.id}`}
						title={`${tl.label} (${tl.key})`}>{tl.label}</button
					>
				{/each}
				<label class="color">
					Colour
					<input type="color" bind:value={color} aria-label="Annotation colour" />
				</label>
			</aside>
		{/if}

		<div class="canvas-area" bind:this={area} data-testid="canvas-area">
			<div class="canvas-stack">
				<canvas bind:this={pdfCanvas} class="pdf-layer"></canvas>
				<canvas
					bind:this={annCanvas}
					class="ann-layer"
					data-testid="annotation-canvas"
					onpointerdown={onPointerDown}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
				></canvas>
			</div>
			<footer class="pager">
				<button onclick={() => gotoPage(currentPage - 1)} disabled={currentPage <= 1}>Prev</button>
				<span data-testid="page-indicator">Page {currentPage} / {totalPages}</span>
				<button onclick={() => gotoPage(currentPage + 1)} disabled={currentPage >= totalPages}>Next</button>
				<span class="count" data-testid="annotation-count">{annotations.length} annotations</span>
			</footer>
		</div>
	</div>
</section>

<style>
	.viewer {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.vhead {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--brand-muted);
	}
	h1 {
		font-size: 1.4rem;
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
	}
	.actions button,
	.tools button {
		padding: var(--space-1) var(--space-2);
		background: var(--brand-surface);
		color: var(--brand-text);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
		cursor: pointer;
		font-size: 0.85rem;
	}
	.actions .primary {
		background: var(--brand-primary);
		color: var(--brand-bg);
		font-weight: 600;
	}
	.actions button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.zoom {
		font-variant-numeric: tabular-nums;
		color: var(--brand-muted);
	}
	.workspace {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.tools {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 7rem;
	}
	.tools button.active {
		background: var(--brand-primary);
		color: var(--brand-bg);
		font-weight: 600;
	}
	.color {
		margin-top: var(--space-2);
		font-size: 0.75rem;
		color: var(--brand-muted);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.canvas-area {
		flex: 1;
		min-width: 0;
		overflow: auto;
		background: var(--brand-surface);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent);
		border-radius: var(--radius);
		padding: var(--space-3);
	}
	.canvas-stack {
		position: relative;
		display: inline-block;
	}
	.pdf-layer {
		display: block;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
	}
	.ann-layer {
		position: absolute;
		inset: 0;
		touch-action: none;
		cursor: crosshair;
	}
	.pager {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-3);
		color: var(--brand-muted);
	}
	.pager button {
		padding: var(--space-1) var(--space-2);
		background: var(--brand-surface);
		color: var(--brand-text);
		border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.pager .count {
		margin-left: auto;
	}
</style>
