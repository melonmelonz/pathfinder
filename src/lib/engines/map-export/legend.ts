// Map engine - NFPA legend autofit (Epic E6).
//
// The load-bearing, fiddly correctness the canonical de-risking principle says
// not to re-litigate. Ported VERBATIM from v1 _runMapExport (_legCellSize,
// _layoutItem, legH_mm, chip placement). All units are millimetres. Pure - no
// DOM, no jsPDF. The browser-side exporter consumes these layouts and draws.

import { hallwayColor, labelSort, type MapMarker, type MapMarkerType } from './markers';

export type PrintStyle = 'command' | 'blueprint' | 'field';

// Legend layout constants (v1).
export const HDR_MM = 36;
export const FOOTER_H_MM = 8;
export const PAD = 10;
export const LEG_HEADER_H = 8;
export const LEG_PAD_V = 4;
export const LEG_ROW_MIN_H = 16;
export const LEG_CELL_VGAP = 2.0;
export const LEG_ICON_W = 105;

export interface LegendChip {
	label: string;
	color: string;
}

export interface LegendItem {
	type: MapMarkerType;
	typeName: string;
	count: number; // markers of this type on this page
	buildingCount: number; // markers of this type across the building
	chips: LegendChip[];
}

export interface CellSize {
	w: number;
	h: number;
	hgap: number;
}

export interface ItemLayout {
	cell: CellSize;
	perRow: number;
	rows: number;
	blockH: number;
	rowH: number;
}

/** Per-(style,type) legend icon cell size in mm (v1 _legCellSize). */
export function legCellSize(type: MapMarkerType, styleKey: PrintStyle): CellSize {
	if (type === 'hallway') return { w: 11.0, h: 6.5, hgap: 1.2 };
	if (type === 'room') return { w: 16.0, h: 6.5, hgap: 1.5 };
	if (styleKey === 'blueprint') {
		if (type === 'door') return { w: 11.0, h: 15.0, hgap: 1.8 };
		if (type === 'stairs') return { w: 18.0, h: 11.0, hgap: 2.0 };
		if (type === 'elevator') return { w: 12.0, h: 14.0, hgap: 1.8 };
	} else if (styleKey === 'field') {
		if (type === 'door') return { w: 10.0, h: 15.0, hgap: 2.0 };
		if (type === 'stairs') return { w: 16.0, h: 10.0, hgap: 2.0 };
		if (type === 'elevator') return { w: 12.0, h: 12.0, hgap: 2.0 };
	} else {
		// command
		if (type === 'door') return { w: 7.0, h: 10.0, hgap: 1.4 };
		if (type === 'stairs') return { w: 11.5, h: 7.5, hgap: 1.6 };
		if (type === 'elevator') return { w: 8.5, h: 8.5, hgap: 1.6 };
	}
	return { w: 10.0, h: 10.0, hgap: 1.4 };
}

/** Wrap + row-height for one legend item (v1 _layoutItem). */
export function layoutItem(item: LegendItem, styleKey: PrintStyle): ItemLayout {
	const cell = legCellSize(item.type, styleKey);
	const n = item.chips.length;
	const maxPerRow = Math.max(1, Math.floor((LEG_ICON_W + cell.hgap) / (cell.w + cell.hgap)));
	const perRow = Math.min(n, maxPerRow);
	const rows = Math.ceil(n / perRow);
	const blockH = rows * cell.h + (rows - 1) * LEG_CELL_VGAP;
	const rowH = Math.max(LEG_ROW_MIN_H, blockH + 4); // +4mm breathing room
	return { cell, perRow, rows, blockH, rowH };
}

/** Total legend height in mm (v1 legH_mm). */
export function legendHeight(items: LegendItem[], styleKey: PrintStyle): number {
	if (items.length === 0) return 18;
	const total = items.reduce((s, it) => s + layoutItem(it, styleKey).rowH, 0);
	return LEG_HEADER_H + total + LEG_PAD_V;
}

/**
 * Build legend items from the markers on a page (v1 lines 3406-3427). One entry
 * per type that has markers on the page; each carries one chip per unique
 * label, sorted numeric-aware. Hallway chips get per-label colour; others share
 * the type colour. `typeMeta` supplies label/color per type.
 */
export function buildLegendItems(
	pageMarkers: MapMarker[],
	buildingMarkers: MapMarker[],
	typeMeta: Record<MapMarkerType, { label: string; color: string }>
): LegendItem[] {
	const order: MapMarkerType[] = ['stairs', 'hallway', 'door', 'elevator', 'room'];
	const items: LegendItem[] = [];
	for (const type of order) {
		const onPage = pageMarkers.filter((m) => m.type === type);
		if (onPage.length === 0) continue;
		const labels = [...new Set(onPage.map((m) => m.label))].sort(labelSort);
		items.push({
			type,
			typeName: typeMeta[type].label + 's',
			count: onPage.length,
			buildingCount: buildingMarkers.filter((m) => m.type === type).length,
			chips: labels.map((label) => ({
				label,
				color: type === 'hallway' ? hallwayColor(label) : typeMeta[type].color
			}))
		});
	}
	return items;
}

/** One placed chip: top-left (cx,cy) and centre (x,y) in mm. */
export interface PlacedChip extends LegendChip {
	cx: number;
	cy: number;
	x: number;
	y: number;
}

/**
 * Place an item's chips within its icon column (v1 lines 4015-4028). Each
 * wrapped row is centred independently; the last (possibly short) row is
 * centred on its own count. `iconX` is the column left edge, `rowCY` the row's
 * vertical centre.
 */
export function placeChips(
	item: LegendItem,
	layout: ItemLayout,
	iconX: number,
	rowCY: number
): PlacedChip[] {
	const { cell, perRow, rows, blockH } = layout;
	const { chips } = item;
	const blockTopY = rowCY - blockH / 2;
	return chips.map((chip, ci) => {
		const cr = Math.floor(ci / perRow);
		const cc = ci % perRow;
		const inThisRow = cr === rows - 1 ? chips.length - cr * perRow : perRow;
		const rowStripW = inThisRow * cell.w + (inThisRow - 1) * cell.hgap;
		const startX = iconX + (LEG_ICON_W - rowStripW) / 2;
		const cx = startX + cc * (cell.w + cell.hgap);
		const cy = blockTopY + cr * (cell.h + LEG_CELL_VGAP);
		return { ...chip, cx, cy, x: cx + cell.w / 2, y: cy + cell.h / 2 };
	});
}
