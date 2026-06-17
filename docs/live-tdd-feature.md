# Live TDD Runbook - Annotation Resize Handles

A self-contained feature you can build live in ~12-15 minutes, demonstrating
strict red-green-refactor TDD. It closes a real, verified gap: v1 let you resize
box annotations after drawing; v2 currently only moves them (see the parity
audit). So this is honest, visible, and the math is clean enough to TDD live.

**Why this feature for a live demo**
- The core is a pure function -> a fast, deterministic red->green you can show.
- It plugs into the engine the same way `translateAnnotation` already does.
- It fixes something the audience can see (drag a corner, the box grows).

**Talking point up front:** *"The de-risking principle here is shell-rewrite,
engine-port: all the load-bearing geometry lives in pure, framework-agnostic
modules with unit tests. I'll add resize the same way - test first."*

---

## Setup (10s)

```bash
cd ~/dev/pathfinder
npx vitest --watch tests/unit/edit-engine.test.ts   # leave this running on screen
```

The watcher re-runs on every save - the audience sees red flip to green live.

---

## Step 1 - RED: write the failing test (3 min)

Open `tests/unit/edit-engine.test.ts` and add this block. It imports a function
that does not exist yet, so it fails to compile/run - that's the red.

```ts
import { resizeAnnotation } from '../../src/lib/engines/2d-annotate/edit';

describe('resizeAnnotation (box shapes)', () => {
	const rect: Annotation = { id: 'r', page: 1, type: 'rect', nx: 0.2, ny: 0.2, nw: 0.4, nh: 0.3, color: '#000' };

	it('SE handle grows width + height by the delta', () => {
		const r = resizeAnnotation(rect, 'se', 0.1, 0.05);
		expect(r.nw).toBeCloseTo(0.5);
		expect(r.nh).toBeCloseTo(0.35);
		expect(r.nx).toBeCloseTo(0.2); // origin unchanged
	});

	it('NW handle moves the origin and shrinks the box', () => {
		const r = resizeAnnotation(rect, 'nw', 0.1, 0.1);
		expect(r.nx).toBeCloseTo(0.3);
		expect(r.ny).toBeCloseTo(0.3);
		expect(r.nw).toBeCloseTo(0.3);
		expect(r.nh).toBeCloseTo(0.2);
	});

	it('keeps a minimum size so a box cannot invert', () => {
		const r = resizeAnnotation(rect, 'se', -1, -1);
		expect(r.nw).toBeGreaterThanOrEqual(0.01);
		expect(r.nh).toBeGreaterThanOrEqual(0.01);
	});
});
```

Save. Show the watcher: **RED** (`resizeAnnotation is not a function`).

---

## Step 2 - GREEN: implement the minimum to pass (3 min)

Open `src/lib/engines/2d-annotate/edit.ts` and add:

```ts
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
const MIN = 0.01;

/** Resize a box-type annotation by dragging a corner handle (normalized delta).
 *  The opposite corner is the anchor; enforces a minimum size so it can't invert. */
export function resizeAnnotation(a: Annotation, handle: ResizeHandle, dnx: number, dny: number): Annotation {
	let { nx, ny, nw, nh } = a;
	if (handle === 'se') { nw += dnx; nh += dny; }
	else if (handle === 'sw') { nx += dnx; nw -= dnx; nh += dny; }
	else if (handle === 'ne') { ny += dny; nw += dnx; nh -= dny; }
	else { nx += dnx; ny += dny; nw -= dnx; nh -= dny; } // nw
	if (nw < MIN) nw = MIN;
	if (nh < MIN) nh = MIN;
	return { ...a, nx, ny, nw, nh };
}
```

Save. Show the watcher: **GREEN** (3 passing). That's the red-green cycle.

---

## Step 3 - REFACTOR (1 min)

The four branches share a shape. Optionally tidy, re-run, stay green:

```ts
export function resizeAnnotation(a: Annotation, handle: ResizeHandle, dnx: number, dny: number): Annotation {
	const left = handle === 'nw' || handle === 'sw';
	const top = handle === 'nw' || handle === 'ne';
	let { nx, ny, nw, nh } = a;
	if (left) { nx += dnx; nw -= dnx; } else { nw += dnx; }
	if (top) { ny += dny; nh -= dny; } else { nh += dny; }
	return { ...a, nx, ny, nw: Math.max(MIN, nw), nh: Math.max(MIN, nh) };
}
```

Re-run -> still green. *"Behaviour locked by the tests, so I can refactor freely."*

---

## Step 4 - Wire it into the viewer (the visible payoff, ~5 min)

In `src/routes/documents/[id]/+page.svelte` (the engine is already imported):

1. **Draw handles** for the selected box annotation. In `redraw()` (or a small
   `drawHandles` after `renderAnnotations`), for the selected non-marker/
   non-freehand annotation, draw 4 small squares at the bbox corners
   (`fromNorm` gives the px rect).
2. **Hit-test a handle on pointer-down.** In `onPointerDown`, when `tool ===
   'select'` and an annotation is already selected, check if the click is within
   ~6px of a corner; if so set `resizing = true; resizeHandle = '<corner>'` and
   take an undo snapshot on first move (mirror the existing `draggingAnn` path).
3. **Apply on pointer-move.** When `resizing`, compute the normalized delta
   (same `toNorm` delta you already compute for drag) and
   `annotations = annotations.map(a => a.id === selectedId
	   ? resizeAnnotation(a, resizeHandle, dnx, dny) : a)`; `redraw()`.
4. **Release on pointer-up** (`resizing = false`).

Demo it: select a rectangle, drag a corner, watch it resize; Ctrl+Z undoes it.

**Close:** *"New behaviour, test-first, locked by unit tests, mounted in the
shell without touching the proven render path - and it just closed a real v1
parity gap."*

---

## If you have less time

Do Steps 1-3 only (the pure function, red-green-refactor) and *describe* Step 4.
The TDD discipline is the point; the wiring is mechanical and already has a
twin in the working `translateAnnotation` drag path.
