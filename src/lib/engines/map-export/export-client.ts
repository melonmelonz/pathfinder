// Browser-side glue (Epic E6): render a document's page 1 with PDF.js and
// produce the NFPA map PDF via the tested engine. Shared by the single-doc
// viewer export and the batch export pipeline so they cannot drift. Pure layout
// math stays in legend.ts/layout.ts; this only does PDF.js render + jsPDF emit.

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { buildMapPdf, exportFilename, type ExportPageInput } from './export-pdf';
import type { MapMarker } from './markers';

export interface DocExportInput {
	docId: string;
	filename: string;
	fileUrl: string;
	markers: MapMarker[];
}

/** Render a doc's first page to a JPEG data URL + dims, or null (demo/no file). */
async function renderFirstPage(fileUrl: string): Promise<ExportPageInput | null> {
	try {
		const pdfjs = await import('pdfjs-dist');
		pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
		const res = await fetch(fileUrl);
		if (!res.ok) return null;
		const buf = await res.arrayBuffer();
		const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
		const page = await doc.getPage(1);
		const viewport = page.getViewport({ scale: 2 });
		const canvas = document.createElement('canvas');
		canvas.width = viewport.width;
		canvas.height = viewport.height;
		await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
		return {
			page: 1,
			imageDataUrl: canvas.toDataURL('image/jpeg', 0.95),
			canvasW: canvas.width,
			canvasH: canvas.height,
			markers: []
		};
	} catch {
		return null;
	}
}

/** Build + download the NFPA map PDF for one document. Returns true on success.
 *  Falls back to a blank page render when the PDF is unavailable (demo mode). */
export async function exportDocMap(input: DocExportInput): Promise<boolean> {
	const { default: JsPDF } = await import('jspdf');
	let pageInput = await renderFirstPage(input.fileUrl);
	if (!pageInput) {
		// Demo fallback: a blank light page so the map + legend still render.
		const canvas = document.createElement('canvas');
		canvas.width = 1000;
		canvas.height = 720;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = '#f7f7f5';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		pageInput = { page: 1, imageDataUrl: canvas.toDataURL('image/jpeg', 0.9), canvasW: 1000, canvasH: 720, markers: [] };
	}
	pageInput.markers = input.markers.filter((m) => m.page === 1);
	const facilityName = input.filename.replace(/\.[^.]+$/, '');
	const doc = buildMapPdf(
		(orientation, size) => new JsPDF({ orientation, unit: 'mm', format: size }),
		[pageInput],
		{},
		input.markers,
		{ facilityName, brandName: 'Pathfinder' }
	);
	doc.save(exportFilename(input.filename));
	return true;
}
