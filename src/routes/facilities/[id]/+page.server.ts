// Facility browse (Epic E3, AC-3.1.1 / AC-3.2.x / AC-3.4.1). Server-guarded:
// 404 for any facility the caller's scope cannot see. Loads the facility, its
// buildings (direct children), a roll-up, the parent district (if any) for the
// breadcrumb, and sibling facilities for the breadcrumb switcher.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getFacility,
	getDistrict,
	listBuildings,
	listFacilities,
	rollup
} from '$lib/server/hierarchy';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');
	if (!locals.user) error(401, 'Not authenticated.');

	const facility = await getFacility(env, locals.user, params.id);
	if (!facility) error(404, 'Facility not found.');

	const district = facility.district_id
		? await getDistrict(env, locals.user, facility.district_id)
		: null;

	const [buildings, siblings, counts] = await Promise.all([
		listBuildings(env, locals.user, { facilityId: facility.id }),
		// Siblings: facilities under the same district (or org-wide if standalone).
		listFacilities(env, locals.user, { districtId: facility.district_id ?? undefined }),
		rollup(env, locals.user, { facilityId: facility.id })
	]);

	return { facility, district, buildings, siblings, counts };
};
