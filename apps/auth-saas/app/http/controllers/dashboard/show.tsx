/**
 * `GET /dashboard` — every tenant the signed-in subject administers.
 * `POST /dashboard/tenants` — creates another tenant under the subject's own
 * existing customer: a customer owns one or more tenants (the target
 * architecture's own model), and every subject reaching this page already owns
 * exactly one customer from signing up, so a second tenant joins that same
 * customer rather than minting a new billing identity for it. The customer is
 * read off whichever tenant the subject already administers, since the control
 * plane keeps no direct subject-to-customer row of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import {
	dashboardSignInUrl,
	resolveDashboardSession,
} from "~/app/http/middleware/dashboard-session";
import { provisionTenant } from "~/app/services/tenant-provisioning";
import { DashboardHomePage } from "~/app/views/dashboard";
import { PublicDocument } from "~/app/views/landing";
import routes from "~/routes/web";

/** `POST /dashboard/tenants`'s own form schema: an organization name, nothing else. */
let createTenantSchema = f.object({
	organizationName: f.field(s.string().pipe(checks.minLength(1))),
});

/** A plain redirect response, for a page requiring a session no request carries. */
function redirect(location: string): Response {
	return new Response(null, { status: 302, headers: { Location: location } });
}

/**
 * `GET /dashboard` — renders every tenant the signed-in subject administers, with a
 * form to create another one. Redirects a request with no valid session to the
 * platform's own sign-in page, returning here once signed back in.
 *
 * @param ctx - The request context (provides `render` and `db`).
 * @returns The rendered dashboard, or a redirect to sign-in.
 * @example
 * router.map(routes.dashboard.show, dashboardShow);
 */
export const dashboardShow = createAction(routes.dashboard.show, async (ctx) => {
	let session = await resolveDashboardSession(ctx);
	if (!session) return redirect(dashboardSignInUrl(routes.dashboard.show.href()));

	let tenants = await ctx.models.memberships.administeredTenants(session.subjectId);

	return ctx.render(
		<PublicDocument title="Auth SaaS - Dashboard">
			<DashboardHomePage
				tenants={tenants}
				createTenantAction={routes.dashboard.createTenant.href()}
				agentClientsHref={(tenantId) => routes.dashboard.agentClients.href({ tenantId })}
				signOutAction={routes.dashboard.signOut.href()}
			/>
		</PublicDocument>,
	);
});

/**
 * Re-renders the dashboard home page with a create-tenant validation issue,
 * preserving the subject's already-administered tenant list.
 *
 * @param ctx - The request context (provides `render` and `db`).
 * @param subjectId - The signed-in subject's id.
 * @param input - The submitted organization name, and the issues to display.
 * @returns The re-rendered dashboard, with a `400` status.
 */
async function renderCreateTenantIssue(
	ctx: RequestContext,
	subjectId: string,
	input: { organizationName?: string; issues: ReadonlyArray<s.Issue> },
): Promise<Response> {
	let tenants = await ctx.models.memberships.administeredTenants(subjectId);

	return ctx.render(
		<PublicDocument title="Auth SaaS - Dashboard">
			<DashboardHomePage
				tenants={tenants}
				createTenantAction={routes.dashboard.createTenant.href()}
				agentClientsHref={(tenantId) => routes.dashboard.agentClients.href({ tenantId })}
				signOutAction={routes.dashboard.signOut.href()}
				organizationName={input.organizationName}
				issues={input.issues}
			/>
		</PublicDocument>,
		{ status: 400 },
	);
}

/**
 * `POST /dashboard/tenants` — provisions a new tenant under the subject's own
 * existing customer, writes the owning membership, and redirects back to the
 * dashboard. A subject with no administered tenant yet (unreachable through this
 * app's own signup flow, which always grants one) gets a freshly-created customer
 * instead, so this action never fails for a state nothing else can produce.
 *
 * @param ctx - The request context (provides `formData`, `render` and `db`).
 * @returns The redirect to `/dashboard` on success, or this page re-rendered with an
 * error.
 * @example
 * router.map(routes.dashboard.createTenant, dashboardCreateTenant);
 */
export const dashboardCreateTenant = createAction(routes.dashboard.createTenant, async (ctx) => {
	let session = await resolveDashboardSession(ctx);
	if (!session) return redirect(dashboardSignInUrl(routes.dashboard.show.href()));

	let parsed = s.parseSafe(createTenantSchema, ctx.formData);
	if (!parsed.success)
		return renderCreateTenantIssue(ctx, session.subjectId, { issues: parsed.issues });

	let { organizationName } = parsed.value;

	let administered = await ctx.models.memberships.administeredTenants(session.subjectId);
	let customerId = administered[0]
		? administered[0].tenant.customer_id
		: unwrap(await ctx.models.customers.create({ name: organizationName })).id;

	let tenant = await provisionTenant(ctx.models, { customerId, name: organizationName });
	unwrap(
		await ctx.models.memberships.create({
			tenant_id: tenant.id,
			subject_id: session.subjectId,
			role: "owner",
		}),
	);

	return redirect(routes.dashboard.show.href());
});
