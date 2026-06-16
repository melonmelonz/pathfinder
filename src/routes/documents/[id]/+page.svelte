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
	import {
		MAP_TYPES,
		reNumberMarkers,
		hallwayColor,
		type MapMarker,
		type MapMarkerType
	} from '$lib/engines/map-export/markers';
	import { buildMapPdf, exportFilename } from '$lib/engines/map-export/export-pdf';

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
	let mapCanvas: HTMLCanvasElement;
	let area: HTMLDivElement;

	// --- map layer (E6) ---
	const MAP_TOOLS: { id: 'select' | MapMarkerType; key: string; label: string }[] = [
		{ id: 'select', key: 'v', label: 'Select' },
		{ id: 'stairs', key: 's', label: 'Stairs' },
		{ id: 'hallway', key: 'h', label: 'Hallway' },
		{ id: 'door', key: 'd', label: 'Door' },
		{ id: 'elevator', key: 'e', label: 'Elevator' },
		{ id: 'room', key: 'o', label: 'Room' }
	];
	let mapMode = $state(false);
	let mapTool = $state<'select' | MapMarkerType>('stairs');
	let markers = $state<MapMarker[]>([]);
	let hallwayPts = $state<Array<{ nx: number; ny: number }>>([]);
	let mapDirty = $state(false);
	let exporting = $state(false);
	let selectedMapId = $state<string | null>(null);

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

	function deserializeMarkers(rows: typeof data.markers): MapMarker[] {
		return rows.map((r) => ({
			id: r.id,
			type: r.type as MapMarkerType,
			label: r.label,
			page: r.page,
			nx: r.nx,
			ny: r.ny,
			labelPinned: !!r.label_pinned,
			labelNx: r.label_nx,
			labelNy: r.label_ny,
			points: r.points ? JSON.parse(r.points) : undefined,
			extraLabels: r.extra_labels ? JSON.parse(r.extra_labels) : undefined
		}));
	}

	const dims = () => ({ width: annCanvas.width, height: annCanvas.height });
	const nums = $derived(commentNumbers(annotations));

	function redraw() {
		if (!annCanvas) return;
		renderAnnotations(annCanvas.getContext('2d')!, annotations, currentPage, dims(), nums, selectedId);
		renderMap();
	}

	function renderMap() {
		if (!mapCanvas) return;
		const ctx = mapCanvas.getContext('2d')!;
		const cw = mapCanvas.width;
		const ch = mapCanvas.height;
		ctx.clearRect(0, 0, cw, ch);
		for (const m of markers) {
			if (m.page !== currentPage) continue;
			const color = m.type === 'hallway' ? hallwayColor(m.label) : MAP_TYPES[m.type].color;
			if (m.type === 'hallway' && m.points && m.points.length > 1) {
				ctx.save();
				ctx.strokeStyle = color;
				ctx.lineWidth = m.id === selectedMapId ? 4 : 2.5;
				ctx.beginPath();
				ctx.moveTo(m.points[0].nx * cw, m.points[0].ny * ch);
				for (const p of m.points) ctx.lineTo(p.nx * cw, p.ny * ch);
				ctx.stroke();
				ctx.restore();
			}
			drawMapChip(ctx, m.nx * cw, m.ny * ch, m.label, color, m.id === selectedMapId);
		}
		// in-progress hallway
		if (hallwayPts.length) {
			ctx.save();
			ctx.strokeStyle = '#16A34A';
			ctx.setLineDash([5, 4]);
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(hallwayPts[0].nx * cw, hallwayPts[0].ny * ch);
			for (const p of hallwayPts) ctx.lineTo(p.nx * cw, p.ny * ch);
			ctx.stroke();
			ctx.restore();
		}
	}

	function drawMapChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string, sel: boolean) {
		ctx.save();
		ctx.fillStyle = color;
		ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,0.3)';
		ctx.lineWidth = sel ? 2.5 : 1;
		const r = 11;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#fff';
		ctx.font = '700 10px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	async function renderPage(n: number) {
		if (demoMode) {
			drawDemo();
			redraw();
			return;
		}
		const page = await pdfDoc.getPage(n);
		const viewport = page.getViewport({ scale });
		for (const c of [pdfCanvas, annCanvas, mapCanvas]) {
			c.width = viewport.width;
			c.height = viewport.height;
		}
		await page.render({ canvasContext: pdfCanvas.getContext('2d')!, viewport }).promise;
		redraw();
	}

	function drawDemo() {
		const w = Math.max((area?.clientWidth ?? 900) - 40, 320);
		const h = Math.round(w * 0.72);
		for (const c of [pdfCanvas, annCanvas, mapCanvas]) {
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
		markers = reNumberMarkers(deserializeMarkers(data.markers));
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

	// --- map layer interaction (E6) ---
	function mapId() {
		return 'mk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	function onMapPointerDown(e: PointerEvent) {
		if (!data.canEdit) return;
		const p = screenToCanvas(e.clientX, e.clientY, mapCanvas.getBoundingClientRect(), dims());
		const nx = p.x / mapCanvas.width;
		const ny = p.y / mapCanvas.height;
		if (mapTool === 'select') {
			selectedMapId = nearestMarker(nx, ny);
			renderMap();
			return;
		}
		if (mapTool === 'hallway') {
			hallwayPts = [...hallwayPts, { nx, ny }];
			renderMap();
			return;
		}
		// point marker
		markers = reNumberMarkers([
			...markers,
			{ id: mapId(), type: mapTool, label: '', page: currentPage, nx, ny, createdAt: new Date().toISOString() }
		]);
		mapDirty = true;
		renderMap();
	}

	function commitHallway() {
		if (hallwayPts.length < 3) return;
		const cx = hallwayPts.reduce((s, p) => s + p.nx, 0) / hallwayPts.length;
		const cy = hallwayPts.reduce((s, p) => s + p.ny, 0) / hallwayPts.length;
		markers = reNumberMarkers([
			...markers,
			{ id: mapId(), type: 'hallway', label: '', page: currentPage, nx: cx, ny: cy, points: [...hallwayPts], createdAt: new Date().toISOString() }
		]);
		hallwayPts = [];
		mapDirty = true;
		renderMap();
	}

	function nearestMarker(nx: number, ny: number): string | null {
		let best: string | null = null;
		let bestD = 0.03;
		for (const m of markers) {
			if (m.page !== currentPage) continue;
			const d = Math.hypot(m.nx - nx, m.ny - ny);
			if (d < bestD) {
				bestD = d;
				best = m.id;
			}
		}
		return best;
	}

	function deleteMarker() {
		if (!selectedMapId) return;
		markers = reNumberMarkers(markers.filter((m) => m.id !== selectedMapId));
		selectedMapId = null;
		mapDirty = true;
		renderMap();
	}

	async function saveMarkers() {
		saving = true;
		const payload = markers.map((m) => ({
			id: m.id,
			page: m.page,
			type: m.type,
			label: m.label,
			labelPinned: m.labelPinned,
			nx: m.nx,
			ny: m.ny,
			labelNx: m.labelNx,
			labelNy: m.labelNy,
			points: m.points,
			extraLabels: m.extraLabels
		}));
		const res = await fetch(`/api/documents/${data.document.id}/markers`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ markers: payload })
		});
		saving = false;
		if (res.ok) mapDirty = false;
	}

	async function exportMapPdf() {
		exporting = true;
		try {
			const { default: JsPDF } = await import('jspdf');
			// Compose the floorplan image from the pdf layer for the current page.
			const composite = document.createElement('canvas');
			composite.width = pdfCanvas.width;
			composite.height = pdfCanvas.height;
			composite.getContext('2d')!.drawImage(pdfCanvas, 0, 0);
			const imageDataUrl = composite.toDataURL('image/jpeg', 0.95);
			const pageMarkers = markers.filter((m) => m.page === currentPage);
			const doc = buildMapPdf(
				(orientation, size) => new JsPDF({ orientation, unit: 'mm', format: size }),
				[{ page: currentPage, imageDataUrl, canvasW: pdfCanvas.width, canvasH: pdfCanvas.height, markers: pageMarkers }],
				{},
				markers,
				{
					facilityName: data.document.filename.replace(/\.[^.]+$/, ''),
					brandName: 'Pathfinder'
				}
			);
			doc.save(exportFilename(data.document.filename));
		} finally {
			exporting = false;
		}
	}

	function toggleMapMode() {
		mapMode = !mapMode;
		selectedId = null;
		selectedMapId = null;
		hallwayPts = [];
		redraw();
	}

	async function gotoPage(n: number) {
		if (n < 1 || n > totalPages) return;
		currentPage = n;
		await renderPage(n);
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
		if (mapMode) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
				e.preventDefault();
				saveMarkers();
				return;
			}
			if (e.key === 'Enter') {
				commitHallway();
				return;
			}
			if (e.key === 'Escape') {
				hallwayPts = [];
				toggleMapMode();
				return;
			}
			if (e.key === 'Delete' || e.key === 'Backspace') {
				deleteMarker();
				return;
			}
			if (e.key === 'ArrowRight') gotoPage(currentPage + 1);
			if (e.key === 'ArrowLeft') gotoPage(currentPage - 1);
			const mt = MAP_TOOLS.find((m) => m.key === e.key.toLowerCase());
			if (mt) mapTool = mt.id;
			return;
		}
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
			<button
				class:active={mapMode}
				onclick={toggleMapMode}
				data-testid="map-mode-toggle">{mapMode ? 'Annotate mode' : 'Map mode'}</button
			>
			<button onclick={exportMapPdf} disabled={exporting} data-testid="export-map">
				{exporting ? 'Exporting...' : 'Export NFPA map'}
			</button>
		</div>
	</header>

	<div class="workspace">
		{#if data.canEdit && !mapMode}
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
		{#if data.canEdit && mapMode}
			<aside class="tools" data-testid="map-toolbar" aria-label="Map marker tools">
				{#each MAP_TOOLS as mt (mt.id)}
					<button
						class:active={mapTool === mt.id}
						onclick={() => (mapTool = mt.id)}
						data-testid={`map-tool-${mt.id}`}
						title={`${mt.label} (${mt.key})`}>{mt.label}</button
					>
				{/each}
				{#if mapTool === 'hallway' && hallwayPts.length >= 3}
					<button onclick={commitHallway} data-testid="close-hallway">Close polygon</button>
				{/if}
				<button
					class="primary"
					onclick={saveMarkers}
					disabled={saving || !mapDirty}
					data-testid="save-markers">{saving ? 'Saving...' : mapDirty ? 'Save map' : 'Saved'}</button
				>
			</aside>
		{/if}

		<div class="canvas-area" bind:this={area} data-testid="canvas-area">
			<div class="canvas-stack">
				<canvas bind:this={pdfCanvas} class="pdf-layer"></canvas>
				<canvas
					bind:this={annCanvas}
					class="ann-layer"
					class:hidden-layer={mapMode}
					data-testid="annotation-canvas"
					onpointerdown={onPointerDown}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
				></canvas>
				<canvas
					bind:this={mapCanvas}
					class="ann-layer"
					class:hidden-layer={!mapMode}
					data-testid="map-canvas"
					onpointerdown={onMapPointerDown}
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
	.hidden-layer {
		pointer-events: none;
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
