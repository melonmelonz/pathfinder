// Map engine - marker types, auto-numbering, colours, polygon math (Epic E6).
//
// The persistent wayfinding layer, separate from review annotations. Ported
// verbatim from v1 viewer.js: MAP_TYPES, reNumberMarkers, _hallwayColor,
// _labelSort, _snap90, _pointInPoly, centroid. Pure - no DOM.

export type MapMarkerType = 'stairs' | 'hallway' | 'door' | 'elevator' | 'room';

export interface MapTypeMeta {
	prefix: string;
	color: string;
	label: string;
}

/** v1 MAP_TYPES. `room` exists in the engine; the D1 CHECK allows it too
 *  (migration 0004) so engine and schema agree. */
export const MAP_TYPES: Record<MapMarkerType, MapTypeMeta> = {
	stairs: { prefix: 'S', color: '#DC2626', label: 'Stairwell' },
	hallway: { prefix: 'H', color: '#16A34A', label: 'Hallway' },
	door: { prefix: 'D', color: '#2563EB', label: 'Door' },
	elevator: { prefix: 'E', color: '#7C3AED', label: 'Elevator' },
	room: { prefix: 'R', color: '#475569', label: 'Room' }
};

/** v1 HALLWAY_COLORS - 8-colour cycle keyed by label number. */
export const HALLWAY_COLORS = [
	'#16A34A',
	'#0EA5E9',
	'#F59E0B',
	'#EC4899',
	'#8B5CF6',
	'#14B8A6',
	'#EF4444',
	'#84CC16'
];

export interface MapMarker {
	id: string;
	type: MapMarkerType;
	label: string;
	page: number;
	nx: number;
	ny: number;
	labelPinned?: boolean; // user typed a label -> keep it, skip auto-number
	labelNx?: number | null;
	labelNy?: number | null;
	points?: Array<{ nx: number; ny: number }>; // hallway polygon (>=3)
	extraLabels?: Array<{ nx: number; ny: number }>;
	createdAt?: string;
}

/** Hallway colour for a label (v1 _hallwayColor): parse digits, cycle by 8. */
export function hallwayColor(label: string): string {
	const num = parseInt(label.replace(/\D/g, ''), 10);
	if (isNaN(num) || num < 1) return HALLWAY_COLORS[0];
	return HALLWAY_COLORS[(num - 1) % HALLWAY_COLORS.length];
}

/** Numeric-aware label sort (v1 _labelSort). */
export function labelSort(a: string, b: string): number {
	const an = parseInt(a.replace(/\D/g, ''), 10);
	const bn = parseInt(b.replace(/\D/g, ''), 10);
	if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
	return a.localeCompare(b);
}

/**
 * Re-number markers in place (v1 reNumberMarkers). Per type, sort by createdAt
 * and assign labels in placement order: doors get LETTERS (A, B, C...), all
 * others get prefix + (n+1) (S1, H1, E1, R1). A marker with labelPinned keeps
 * its typed label and does NOT consume a counter slot. Mutates and returns the
 * array.
 */
export function reNumberMarkers(markers: MapMarker[]): MapMarker[] {
	const byType = new Map<MapMarkerType, MapMarker[]>();
	for (const m of markers) {
		const arr = byType.get(m.type) ?? [];
		arr.push(m);
		byType.set(m.type, arr);
	}
	for (const [type, list] of byType) {
		list.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
		let counter = 0;
		for (const m of list) {
			if (m.labelPinned) continue; // keep typed label, no counter slot
			if (type === 'door') {
				m.label = String.fromCharCode(65 + counter);
			} else {
				m.label = MAP_TYPES[type].prefix + (counter + 1);
			}
			counter++;
		}
	}
	return markers;
}

/** Snap a delta to the nearest 45 degrees when shift is held (v1 _snap90). */
export function snap90(dx: number, dy: number): { dx: number; dy: number } {
	const ang = Math.atan2(dy, dx);
	const step = Math.PI / 4;
	const snapped = Math.round(ang / step) * step;
	const len = Math.hypot(dx, dy);
	return { dx: Math.cos(snapped) * len, dy: Math.sin(snapped) * len };
}

/** Ray-cast point-in-polygon (v1 _pointInPoly). pts in normalized space. */
export function pointInPoly(nx: number, ny: number, pts: Array<{ nx: number; ny: number }>): boolean {
	let inside = false;
	for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
		const xi = pts[i].nx;
		const yi = pts[i].ny;
		const xj = pts[j].nx;
		const yj = pts[j].ny;
		const intersect =
			yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

type Pt = { nx: number; ny: number };

/** Index of the polygon vertex within `tol` of (nx,ny), or -1 (for vertex drag/
 *  delete hit-testing). */
export function nearestVertex(pts: Pt[], nx: number, ny: number, tol = 0.02): number {
	let best = -1;
	let bestD = tol;
	pts.forEach((p, i) => {
		const d = Math.hypot(p.nx - nx, p.ny - ny);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	});
	return best;
}

/** The segment index whose midpoint is nearest (nx,ny) within `tol`, or -1
 *  (for midpoint-insert hit-testing). Segment i joins vertex i and i+1 (wrap). */
export function nearestMidpoint(pts: Pt[], nx: number, ny: number, tol = 0.02): number {
	let best = -1;
	let bestD = tol;
	for (let i = 0; i < pts.length; i++) {
		const a = pts[i];
		const b = pts[(i + 1) % pts.length];
		const mx = (a.nx + b.nx) / 2;
		const my = (a.ny + b.ny) / 2;
		const d = Math.hypot(mx - nx, my - ny);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best;
}

/** Insert a vertex at the midpoint of segment `segIndex`. Returns a new array. */
export function insertMidpoint(pts: Pt[], segIndex: number): Pt[] {
	const a = pts[segIndex];
	const b = pts[(segIndex + 1) % pts.length];
	const mid = { nx: (a.nx + b.nx) / 2, ny: (a.ny + b.ny) / 2 };
	const next = pts.slice();
	next.splice(segIndex + 1, 0, mid);
	return next;
}

/** Delete vertex `i`, keeping a minimum of 3 (returns the original if at 3). */
export function deleteVertex(pts: Pt[], i: number): Pt[] {
	if (pts.length <= 3) return pts;
	return pts.filter((_, idx) => idx !== i);
}

/** Centroid (mean of vertices) of a polygon (v1 hallway centroid). */
export function centroid(pts: Array<{ nx: number; ny: number }>): { nx: number; ny: number } {
	if (pts.length === 0) return { nx: 0, ny: 0 };
	let sx = 0;
	let sy = 0;
	for (const p of pts) {
		sx += p.nx;
		sy += p.ny;
	}
	return { nx: sx / pts.length, ny: sy / pts.length };
}
