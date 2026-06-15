// Dashboard load (Epic E2). The hooks guard already redirects anonymous users
// to /login; here we just hand the resolved user to the page.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	return { user: locals.user };
};
