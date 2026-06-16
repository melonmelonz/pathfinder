// Map engine - NFPA multi-page PDF export (Epic E6).
//
// Browser-side: turns per-page render inputs into a printed NFPA-style map PDF
// using jsPDF. All geometry (page sizing, marker placement, legend autofit,
// chip layout) comes from the pure, unit-tested engine modules (legend.ts,
// layout.ts, markers.ts); this file only issues jsPDF draw calls. Faithful to
// v1 _runMapExport for the 'command' style (navy/red), which is the default.

import type jsPDF from 'jspdf';
import { MAP_TYPES, type MapMarker, type MapMarkerType } from './markers';
import {
	buildLegendItems,
	layoutItem,
	legendHeight,
	placeChips,
	HDR_MM,
	PAD,
	LEG_HEADER_H,
	LEG_ICON_W,
	type PrintStyle
} from './legend';
import {
	orderPages,
	cropPx,
	pageSizeMm,
	markerMm,
	hexToRgb,
	floorLine,
	countCaption,
	type Crop
} from './layout';

export interface ExportPageInput {
	page: number;
	imageDataUrl: string; // full rendered page as JPEG/PNG data URL
	canvasW: number;
	canvasH: number;
	markers: MapMarker[];
}

export interface ExportHeader {
	facilityName: string;
	address?: string;
	zip?: string;
	phone?: string;
	brandName?: string;
}

const PIN_R = 5; // mm, v1

type Rgb = [number, number, number];
const COMMAND: { header: Rgb; accent: Rgb; text: Rgb } = {
	header: [0, 40, 104], // navy
	accent: [178, 34, 52], // red
	text: [20, 30, 45]
};

const typeMeta = Object.fromEntries(
	Object.entries(MAP_TYPES).map(([k, v]) => [k, { label: v.label, color: v.color }])
) as Record<MapMarkerType, { label: string; color: string }>;

/**
 * Build the NFPA map PDF. Returns the jsPDF doc (caller .save()s it). `mkDoc`
 * is a factory taking orientation + [w,h] mm so the caller owns the jsPDF
 * import; `style` defaults to 'command'.
 */
export function buildMapPdf(
	mkDoc: (orientation: 'p' | 'l', size: [number, number]) => jsPDF,
	pages: ExportPageInput[],
	crops: Record<number, Crop>,
	buildingMarkers: MapMarker[],
	header: ExportHeader,
	style: PrintStyle = 'command'
): jsPDF {
	const order = orderPages(
		pages.map((p) => p.page),
		crops
	);
	const sorted = order.map((n) => pages.find((p) => p.page === n)!).filter(Boolean);

	let doc: jsPDF | null = null;
	sorted.forEach((pg, idx) => {
		const crop = crops[pg.page];
		const cp = cropPx(crop, pg.canvasW, pg.canvasH);
		const pageMarkers = pg.markers;
		const legItems = buildLegendItems(pageMarkers, buildingMarkers, typeMeta);
		const legH = legendHeight(legItems, style);
		const sz = pageSizeMm(cp.w, cp.h, legH);
		const orientation: 'p' | 'l' = sz.wMm >= sz.hMm ? 'l' : 'p';

		if (!doc) doc = mkDoc(orientation, [sz.wMm, sz.hMm]);
		else doc.addPage([sz.wMm, sz.hMm], orientation);
		const d = doc;

		// Header band.
		d.setFillColor(...COMMAND.header);
		d.rect(0, 0, sz.wMm, HDR_MM, 'F');
		d.setTextColor(255, 255, 255);
		d.setFont('helvetica', 'bold');
		d.setFontSize(15);
		d.text(header.facilityName, PAD, 13);
		d.setFont('helvetica', 'normal');
		d.setFontSize(8.5);
		const sub = [header.address, header.zip, header.phone].filter(Boolean).join('   ');
		if (sub) d.text(sub, PAD, 20);
		d.setFillColor(...COMMAND.accent);
		d.rect(0, HDR_MM - 2.5, sz.wMm, 2.5, 'F');
		d.setFontSize(9);
		d.setTextColor(255, 255, 255);
		d.text(floorLine(crop, idx + 1, sorted.length), sz.wMm - PAD, 13, { align: 'right' });

		// Floorplan image (cropped region scaled to crop mm box under the header).
		d.addImage(pg.imageDataUrl, 'JPEG', 0, HDR_MM, sz.cropWmm, sz.cropHmm);

		// Markers: shadow pass then fill+label.
		for (const m of pageMarkers) {
			const p = markerMm(m, pg.canvasW, pg.canvasH, cp.x, cp.y);
			const rgb = hexToRgb(typeMeta[m.type].color);
			d.setFillColor(0, 0, 0);
			d.circle(p.x + 0.4, p.y + 0.4, PIN_R, 'F');
			d.setFillColor(rgb[0], rgb[1], rgb[2]);
			d.circle(p.x, p.y, PIN_R, 'F');
			d.setTextColor(255, 255, 255);
			d.setFont('helvetica', 'bold');
			d.setFontSize(7);
			d.text(m.label, p.x, p.y + 0.6, { align: 'center' });
		}

		// Legend block under the floorplan.
		const legTop = HDR_MM + sz.cropHmm;
		d.setFillColor(245, 246, 248);
		d.rect(0, legTop, sz.wMm, legH, 'F');
		d.setTextColor(...COMMAND.text);
		d.setFont('helvetica', 'bold');
		d.setFontSize(9);
		d.text('LEGEND', PAD, legTop + 5.5);

		const iconX = PAD + 8;
		const nameX = iconX + LEG_ICON_W + 6;
		const countX = sz.wMm - PAD - 2;
		let cursorY = legTop + LEG_HEADER_H;
		legItems.forEach((item, i) => {
			const lay = layoutItem(item, style);
			const rowCY = cursorY + lay.rowH / 2;
			if (i > 0) {
				d.setDrawColor(210, 214, 220);
				d.setLineWidth(0.2);
				d.line(PAD, cursorY, sz.wMm - PAD, cursorY);
			}
			// chips
			for (const chip of placeChips(item, lay, iconX, rowCY)) {
				const rgb = hexToRgb(chip.color);
				d.setFillColor(rgb[0], rgb[1], rgb[2]);
				d.circle(chip.x, chip.y, Math.min(lay.cell.w, lay.cell.h) / 2, 'F');
				d.setTextColor(255, 255, 255);
				d.setFont('helvetica', 'bold');
				d.setFontSize(6);
				d.text(chip.label, chip.x, chip.y + 0.5, { align: 'center' });
			}
			// type name + counts
			d.setTextColor(...COMMAND.text);
			d.setFont('helvetica', 'bold');
			d.setFontSize(9);
			d.text(item.typeName.toUpperCase(), nameX, rowCY + 1);
			d.setFont('helvetica', 'normal');
			d.setFontSize(7.5);
			d.text(countCaption(item.count, item.buildingCount), countX, rowCY + 1, { align: 'right' });
			cursorY += lay.rowH;
		});

		// Footer.
		d.setFontSize(7);
		d.setTextColor(120, 130, 140);
		d.text(
			`${header.brandName ?? 'Pathfinder'} - generated map - not to scale`,
			PAD,
			sz.hMm - 3
		);
	});

	return doc!;
}

/** Safe filename for the export (v1: facility name slug). */
export function exportFilename(facilityName: string): string {
	return facilityName.replace(/[^a-z0-9]/gi, '_') + '_map.pdf';
}
