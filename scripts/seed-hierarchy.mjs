/**
 * Hierarchy dev seed (Epic E3 - Org Hierarchy & Dashboards). Emits idempotent
 * INSERT ... ON CONFLICT SQL to stdout for a small demo tree so the roll-up
 * dashboard and the browse/breadcrumb routes have real content:
 *
 *   Org: ELS911
 *     District: Wellsboro Area School District
 *       Facility: Wellsboro Area High School   (2 buildings, 2 projects)
 *       Facility: Don Gill Elementary School   (1 building, 1 project)
 *     Facility (standalone): Tioga County 911 Center (1 building)
 *
 * Plus a SECOND org (Northgate School District) so the seeded CLIENT user
 * (client@test.com, org 'Northgate School District') sees exactly one org and
 * org-scoping is demonstrable. IDs are deterministic so E2E can navigate by
 * stable URLs. LOCAL ONLY - no real data.
 *
 * Usage (see package.json db:seed:hierarchy:local):
 *   node scripts/seed-hierarchy.mjs | wrangler d1 execute pathfinder --local --file=/dev/stdin
 */

function esc(s) {
	return String(s).replace(/'/g, "''");
}

const lines = ['-- LOCAL hierarchy seed (idempotent).'];

// --- helpers that emit idempotent UPSERTs ---

function org(id, name, type) {
	lines.push(
		`INSERT INTO orgs (id, name, type) VALUES ('${id}', '${esc(name)}', '${type}')\n` +
			`ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type;`
	);
}

function district(id, orgId, name) {
	lines.push(
		`INSERT INTO districts (id, org_id, name) VALUES ('${id}', '${orgId}', '${esc(name)}')\n` +
			`ON CONFLICT(id) DO UPDATE SET org_id=excluded.org_id, name=excluded.name;`
	);
}

function facility(id, districtId, orgId, name, type, address, zip, phone) {
	const d = districtId ? `'${districtId}'` : 'NULL';
	lines.push(
		`INSERT INTO facilities (id, district_id, org_id, name, type, address, zip, phone)\n` +
			`VALUES ('${id}', ${d}, '${orgId}', '${esc(name)}', '${type}', '${esc(address)}', '${esc(zip)}', '${esc(phone)}')\n` +
			`ON CONFLICT(id) DO UPDATE SET district_id=excluded.district_id, org_id=excluded.org_id,\n` +
			`  name=excluded.name, type=excluded.type, address=excluded.address, zip=excluded.zip, phone=excluded.phone;`
	);
}

function building(id, facilityId, name, floors) {
	lines.push(
		`INSERT INTO buildings (id, facility_id, name, floors) VALUES ('${id}', '${facilityId}', '${esc(name)}', ${floors})\n` +
			`ON CONFLICT(id) DO UPDATE SET facility_id=excluded.facility_id, name=excluded.name, floors=excluded.floors;`
	);
}

function project(id, buildingId, name, status, progress) {
	lines.push(
		`INSERT INTO projects (id, building_id, name, status, progress)\n` +
			`VALUES ('${id}', '${buildingId}', '${esc(name)}', '${status}', ${progress})\n` +
			`ON CONFLICT(id) DO UPDATE SET building_id=excluded.building_id, name=excluded.name,\n` +
			`  status=excluded.status, progress=excluded.progress;`
	);
}

// --- ELS911 org (the flagship operator deployment's demo tenant) ---
const ORG_ELS = 'org-els911-0000-0000-0000-000000000001';
org(ORG_ELS, 'ELS911', '911_center');

const DIST_WELLS = 'dist-wellsboro-0000-0000-000000000001';
district(DIST_WELLS, ORG_ELS, 'Wellsboro Area School District');

const FAC_WAHS = 'fac-wahs-0000-0000-0000-000000000001';
facility(FAC_WAHS, DIST_WELLS, ORG_ELS, 'Wellsboro Area High School', 'school', '225 Nichols St', '16901', '570-724-3500');

const FAC_DGE = 'fac-dongill-0000-0000-0000-00000000001';
facility(FAC_DGE, DIST_WELLS, ORG_ELS, 'Don Gill Elementary School', 'school', '24 Pearl St', '16901', '570-724-1234');

const FAC_911 = 'fac-tioga911-0000-0000-000000000001';
facility(FAC_911, null, ORG_ELS, 'Tioga County 911 Center', '911_center', '116 Nichols St', '16901', '570-724-9111');

// Buildings.
const B_WAHS_MAIN = 'bld-wahs-main-0000-000000000001';
const B_WAHS_GYM = 'bld-wahs-gym-0000-0000000000001';
building(B_WAHS_MAIN, FAC_WAHS, 'Main Building', 3);
building(B_WAHS_GYM, FAC_WAHS, 'Gymnasium', 1);

const B_DGE_MAIN = 'bld-dge-main-0000-0000000000001';
building(B_DGE_MAIN, FAC_DGE, 'Main Building', 2);

const B_911_OPS = 'bld-911-ops-0000-00000000000001';
building(B_911_OPS, FAC_911, 'Operations Center', 1);

// Projects (give roll-ups something to count).
project('proj-wahs-egress-000000000001', B_WAHS_MAIN, 'Egress mapping review', 'in_review', 60);
project('proj-wahs-nfpa-0000000000001', B_WAHS_MAIN, 'NFPA 170 marker pass', 'draft', 20);
project('proj-dge-floorplan-00000001', B_DGE_MAIN, 'Floorplan annotation', 'approved', 100);

// --- A second org so the client user sees exactly one (org-scoping demo) ---
const ORG_NORTH = 'org-northgate-0000-0000-000000000001';
org(ORG_NORTH, 'Northgate School District', 'school');
const FAC_NORTH = 'fac-northgate-0000-0000-00000000001';
facility(FAC_NORTH, null, ORG_NORTH, 'Northgate Middle School', 'school', '100 Main St', '15202', '412-555-0100');
building('bld-north-main-0000-000000000001', FAC_NORTH, 'Main Building', 2);

process.stdout.write(lines.join('\n') + '\n');
