<script lang="ts">
	// 3D scan viewer (Epic E8). Two baselines: an mp4 walkthrough player every
	// responder can use, and the interactive Spark splat viewer (THREE.js,
	// WebGL2, SPZ delivery) with point-to-point measurement, anchored 3D markers,
	// named viewpoints, floor switching and capture-date version compare. THREE +
	// Spark load lazily in the browser; the page degrades to a clear message if
	// WebGL2 is unavailable. All geometry math comes from the tested engine.
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { PageData } from './$types';
	import { distance3d, toMeters, formatMeasurement, type Vec3 } from '$lib/engines/splat-viewer/measure';
	import {
		MARKER3D_TYPES,
		MAX_SCENE_MARKERS,
		canAddMarker,
		interpolateViewpoint,
		tourOrder,
		type Marker3d,
		type Marker3dType,
		type Viewpoint
	} from '$lib/engines/splat-viewer/markers3d';

	let { data }: { data: PageData } = $props();
	const isVideo = () => data.media.type === 'walkthrough_video';

	let host: HTMLDivElement | undefined = $state();
	let status = $state('loading');
	let measureMode = $state(false);
	let markerMode = $state<Marker3dType | null>(null);
	let measurePts = $state<Vec3[]>([]);
	let measureLabel = $state('');
	let markers = $state<Marker3d[]>([]);
	let viewpoints = $state<Viewpoint[]>([]);
	let dirty = $state(false);
	let saving = $state(false);
	let unitsPerMeter = $state(1);

	let three: typeof import('three') | null = null;
	let renderer: any = null;
	let scene: any = null;
	let camera: any = null;
	let controls: any = null;
	let splat: any = null;
	let raf = 0;

	function seed() {
		markers = data.markers.map((m) => ({
			id: m.id,
			type: m.type as Marker3dType,
			label: m.label,
			description: m.description ?? undefined,
			position: [m.px, m.py, m.pz] as Vec3,
			normal: m.nx != null ? ([m.nx, m.ny, m.nz] as Vec3) : undefined,
			viewpointId: m.viewpoint_id,
			floor: m.floor
		}));
		viewpoints = data.viewpoints.map((v) => ({
			id: v.id,
			name: v.name,
			position: [v.px, v.py, v.pz] as Vec3,
			target: [v.tx, v.ty, v.tz] as Vec3,
			fov: v.fov,
			order: v.sort_order
		}));
	}

	onMount(async () => {
		seed();
		if (isVideo()) {
			status = 'ready';
			return;
		}
		if (!host) return;
		try {
			const THREE = await import('three');
			const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
			const { SplatMesh } = await import('@sparkjsdev/spark');
			three = THREE;
			const w = host.clientWidth || 800;
			const h = Math.max(420, Math.round(w * 0.6));
			renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setSize(w, h);
			renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
			host.appendChild(renderer.domElement);
			scene = new THREE.Scene();
			scene.background = new THREE.Color(0x0a131e);
			camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
			camera.position.set(0, 1.6, 4);
			controls = new OrbitControls(camera, renderer.domElement);
			controls.enableDamping = true;
			splat = new SplatMesh({ url: data.fileUrl });
			scene.add(splat);
			await splat.initialized?.catch(() => {});
			status = 'ready';
			const loop = () => {
				controls.update();
				renderer.render(scene, camera);
				raf = requestAnimationFrame(loop);
			};
			loop();
		} catch (e) {
			status = 'error:' + (e instanceof Error ? e.message : 'WebGL2 unavailable');
		}
	});

	onDestroy(() => {
		// onDestroy also runs during SSR teardown, where rAF is undefined.
		if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
		renderer?.dispose?.();
	});

	function pickPoint(ev: PointerEvent): Vec3 | null {
		if (!three || !renderer || !camera) return null;
		const rect = renderer.domElement.getBoundingClientRect();
		const ndc = new three.Vector2(
			((ev.clientX - rect.left) / rect.width) * 2 - 1,
			-((ev.clientY - rect.top) / rect.height) * 2 + 1
		);
		const ray = new three.Raycaster();
		ray.setFromCamera(ndc, camera);
		// Try a splat raycast; fall back to the ground plane (y=0) so a point is
		// always pickable even where the splat is sparse.
		const hits = splat ? ray.intersectObject(splat, true) : [];
		if (hits.length) {
			const p = hits[0].point;
			return [p.x, p.y, p.z];
		}
		const plane = new three.Plane(new three.Vector3(0, 1, 0), 0);
		const target = new three.Vector3();
		if (ray.ray.intersectPlane(plane, target)) return [target.x, target.y, target.z];
		return null;
	}

	function onCanvasPointerDown(ev: PointerEvent) {
		if (!data.canEdit) return;
		const p = pickPoint(ev);
		if (!p) return;
		if (measureMode) {
			measurePts = measurePts.length >= 2 ? [p] : [...measurePts, p];
			if (measurePts.length === 2) {
				const d = toMeters(distance3d(measurePts[0], measurePts[1]), unitsPerMeter);
				measureLabel = formatMeasurement(d);
			} else {
				measureLabel = '';
			}
		} else if (markerMode) {
			if (!canAddMarker(markers.length)) {
				measureLabel = `Scene marker cap (${MAX_SCENE_MARKERS}) reached.`;
				return;
			}
			const label = window.prompt(`Label for ${markerMode}:`) ?? '';
			markers = [
				...markers,
				{ id: 'm3' + Date.now().toString(36), type: markerMode, label, position: p }
			];
			dirty = true;
		}
	}

	function gotoViewpoint(vp: Viewpoint) {
		if (!camera || !controls || !three) return;
		const from: Viewpoint = {
			id: '_cur',
			name: '',
			position: [camera.position.x, camera.position.y, camera.position.z],
			target: [controls.target.x, controls.target.y, controls.target.z],
			fov: camera.fov
		};
		const t0 = performance.now();
		const dur = 700;
		const step = (now: number) => {
			const t = Math.min(1, (now - t0) / dur);
			const s = interpolateViewpoint(from, vp, t);
			camera.position.set(...s.position);
			controls.target.set(...s.target);
			camera.fov = s.fov;
			camera.updateProjectionMatrix();
			if (t < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	function saveViewpoint() {
		if (!camera || !controls) return;
		const name = window.prompt('Viewpoint name:') ?? '';
		if (!name.trim()) return;
		viewpoints = [
			...viewpoints,
			{
				id: 'vp' + Date.now().toString(36),
				name,
				position: [camera.position.x, camera.position.y, camera.position.z],
				target: [controls.target.x, controls.target.y, controls.target.z],
				fov: camera.fov,
				order: viewpoints.length
			}
		];
		dirty = true;
	}

	function deleteMarker(id: string) {
		markers = markers.filter((m) => m.id !== id);
		dirty = true;
	}

	async function save() {
		saving = true;
		const [m, v] = await Promise.all([
			fetch(`/api/media/${data.media.id}/markers3d`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					markers: markers.map((m) => ({
						id: m.id,
						type: m.type,
						label: m.label,
						description: m.description,
						position: m.position,
						normal: m.normal ?? null,
						viewpointId: m.viewpointId ?? null,
						floor: m.floor ?? null
					}))
				})
			}),
			fetch(`/api/media/${data.media.id}/viewpoints`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					viewpoints: viewpoints.map((v) => ({
						id: v.id,
						name: v.name,
						position: v.position,
						target: v.target,
						fov: v.fov,
						order: v.order
					}))
				})
			})
		]);
		saving = false;
		if (m.ok && v.ok) {
			dirty = false;
			toasts.success('3D markers and viewpoints saved.');
		} else {
			toasts.error('Could not save the 3D scene. Try again.');
		}
	}

	const tour = $derived(tourOrder(viewpoints));
</script>

<section class="scan">
	<header class="shead">
		<div>
			<p class="eyebrow">{isVideo() ? 'Walkthrough' : '3D Scan'}</p>
			<h1>{data.media.filename}</h1>
			{#if data.media.capture_date}<p class="muted">Captured {data.media.capture_date}{#if data.media.surveyor} - {data.media.surveyor}{/if}</p>{/if}
		</div>
		{#if data.canEdit && !isVideo()}
			<div class="actions">
				<button class:active={measureMode} onclick={() => { measureMode = !measureMode; markerMode = null; measurePts = []; measureLabel = ''; }} data-testid="measure-toggle">Measure</button>
				<button onclick={saveViewpoint} data-testid="save-viewpoint">Save viewpoint</button>
				<button class="primary" onclick={save} disabled={saving || !dirty} data-testid="save-3d">{saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}</button>
			</div>
		{/if}
	</header>

	<div class="layout">
		<div class="stage">
			{#if isVideo()}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video src={data.fileUrl} controls playsinline data-testid="walkthrough-video"></video>
			{:else}
				<div
					class="host"
					bind:this={host}
					onpointerdown={onCanvasPointerDown}
					role="application"
					aria-label="Interactive 3D scan viewport. Use measure and marker tools to annotate."
					data-testid="splat-host"
				></div>
				{#if status.startsWith('loading')}
					<p class="overlay" data-testid="splat-status">Loading splat...</p>
				{:else if status.startsWith('error')}
					<p class="overlay err" data-testid="splat-status">3D view unavailable: {status.slice(6)}. Use the walkthrough video instead.</p>
				{/if}
				{#if measureLabel}<p class="measure" data-testid="measure-readout">{measureLabel}</p>{/if}
			{/if}
		</div>

		<aside class="panel">
			{#if data.canEdit && !isVideo()}
				<h2>Place marker</h2>
				<div class="marker-tools" data-testid="marker3d-tools">
					{#each MARKER3D_TYPES as mt (mt)}
						<button class:active={markerMode === mt} onclick={() => { markerMode = markerMode === mt ? null : mt; measureMode = false; }} data-testid={`m3-${mt}`}>{mt}</button>
					{/each}
				</div>
				<label class="scale">Scan units per metre
					<input type="number" min="0.01" step="0.01" bind:value={unitsPerMeter} />
				</label>
			{/if}

			<h2>Markers ({markers.length}/{MAX_SCENE_MARKERS})</h2>
			<ul class="mlist" data-testid="marker3d-list">
				{#each markers as m (m.id)}
					<li><span class="mtype">{m.type}</span> {m.label || '(unlabeled)'}
						{#if data.canEdit && !isVideo()}<button class="x" onclick={() => deleteMarker(m.id)} aria-label="Delete marker">x</button>{/if}
					</li>
				{:else}
					<li class="muted">No 3D markers yet.</li>
				{/each}
			</ul>

			<h2>Viewpoints</h2>
			<ul class="vlist" data-testid="viewpoint-list">
				{#each tour as v (v.id)}
					<li><button onclick={() => gotoViewpoint(v)} disabled={isVideo()} data-testid="viewpoint">{v.name}</button></li>
				{:else}
					<li class="muted">No saved viewpoints.</li>
				{/each}
			</ul>

			{#if data.related.length > 1}
				<h2>Floors &amp; versions</h2>
				<ul class="rlist" data-testid="related-scans">
					{#each data.related as r (r.id)}
						<li>
							<button class:current={r.id === data.media.id} onclick={() => goto(`/scans/${r.id}`)}>
								{r.type === 'walkthrough_video' ? 'Video' : 'Splat'}
								{#if r.floor != null}- floor {r.floor}{/if}
								v{r.version}{#if r.capture_date} - {r.capture_date}{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>
</section>

<style>
	.scan { display: flex; flex-direction: column; gap: var(--space-3); }
	.shead { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); flex-wrap: wrap; }
	.eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; color: var(--brand-muted); }
	h1 { font-size: 1.4rem; }
	h2 { font-size: 0.95rem; margin: var(--space-2) 0 var(--space-1); }
	.muted { color: var(--brand-muted); font-size: 0.85rem; }
	.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
	.actions button, .marker-tools button, .panel button { padding: var(--space-1) var(--space-2); background: var(--brand-surface); color: var(--brand-text); border: 1px solid color-mix(in srgb, var(--brand-secondary) 40%, transparent); border-radius: var(--radius); cursor: pointer; font-size: 0.8rem; }
	.actions .primary { background: var(--brand-primary); color: var(--brand-bg); font-weight: 600; }
	button.active { background: var(--brand-primary); color: var(--brand-bg); font-weight: 600; }
	button:disabled { opacity: 0.55; cursor: default; }
	.layout { display: flex; gap: var(--space-3); align-items: flex-start; flex-wrap: wrap; }
	.stage { flex: 1; min-width: 320px; position: relative; background: var(--brand-surface); border: 1px solid color-mix(in srgb, var(--brand-secondary) 35%, transparent); border-radius: var(--radius); overflow: hidden; }
	.host { width: 100%; min-height: 420px; }
	.host :global(canvas) { display: block; width: 100%; cursor: crosshair; }
	video { width: 100%; display: block; background: #000; }
	.overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--brand-muted); padding: var(--space-4); text-align: center; }
	.overlay.err { color: #e2574c; }
	.measure { position: absolute; left: var(--space-3); bottom: var(--space-3); background: rgba(10,19,30,0.85); color: #fff; padding: var(--space-1) var(--space-2); border-radius: var(--radius); font-variant-numeric: tabular-nums; }
	.panel { width: 16rem; }
	.marker-tools { display: flex; flex-wrap: wrap; gap: var(--space-1); }
	.scale { display: flex; flex-direction: column; gap: var(--space-1); font-size: 0.75rem; color: var(--brand-muted); margin-top: var(--space-2); }
	.mlist, .vlist, .rlist { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-1); font-size: 0.85rem; }
	.mtype { font-weight: 600; color: var(--brand-primary); }
	.x { margin-left: auto; padding: 0 0.4em; }
	button.current { outline: 2px solid var(--brand-primary); }
</style>
