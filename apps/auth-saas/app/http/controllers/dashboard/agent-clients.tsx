/**
 * `GET/POST /dashboard/tenants/:tenantId/agent-clients` — every machine credential
 * registered against a tenant, and a form to register another one. Registration
 * itself is dogfooded through the real, public `POST /tenants/:tenantId/agent-clients`
 * Management API route, called over a self-referencing service binding, rather than
 * through `AgentClientBinding`/tenant-DO RPCs directly — the dashboard is the first
 * UI consumer of that API and exercises it exactly as any other caller would.
 *
 * The page-level guard (does the signed-in subject administer this tenant at all) is
 * independent of, and runs before, whatever the dogfooded Management API call itself
 * also enforces: a subject with no membership here never even reaches the call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import type { DashboardTenantMember } from "~/app/http/middleware/dashboard-session";
import type { MembershipRole } from "~/app/models/membership";

import {
	DashboardSignInRequiredError,
	dashboardSignInUrl,
	resolveTenantMember,
} from "~/app/http/middleware/dashboard-session";
import { callManagementApi } from "~/app/lib/management-client";
import AgentClientBinding from "~/app/models/agent-client-binding";
import {
	MANAGEMENT_SCOPES,
	MANAGEMENT_SCOPE_DESCRIPTIONS,
	MANAGEMENT_SCOPE_TITLES,
} from "~/app/services/management-scopes";
import { AgentClientsPage } from "~/app/views/dashboard";
import { PublicDocument } from "~/app/views/landing";
import routes from "~/routes/web";

/** `POST .../agent-clients`'s own form schema: a name, and one or more scopes. */
let registerAgentClientSchema = f.object({
	name: f.field(s.string().pipe(checks.minLength(1))),
	scopes: f.fields(s.array(s.enum_(MANAGEMENT_SCOPES))),
});

/** A plain redirect response, for a page a request may not view. */
function redirect(location: string): Response {
	return new Response(null, { status: 302, headers: { Location: location } });
}

/**
 * Resolves the signed-in dashboard session's membership of `:tenantId`, answering
 * the redirect a caller should send instead: to sign-in when there is no session,
 * and back to the dashboard for a tenant the subject does not administer.
 *
 * @param ctx - The request context (provides `request` and `db`).
 * @param tenantId - The tenant id the matched route's own `:tenantId` segment named.
 * @returns The session's membership on success, or the redirect to answer.
 */
async function requireTenantMembership(
	ctx: RequestContext,
	tenantId: string,
): Promise<DashboardTenantMember | { redirect: Response }> {
	let member = await resolveTenantMember(ctx, tenantId);
	if (isSuccess(member)) return member.data;

	if (member.error instanceof DashboardSignInRequiredError) {
		return { redirect: redirect(dashboardSignInUrl(ctx.url.pathname)) };
	}
	return { redirect: redirect(routes.dashboard.show.href()) };
}

/**
 * Renders the agent-clients page for a resolved tenant membership.
 *
 * @param ctx - The request context (provides `render` and `db`).
 * @param resolved - The tenant and role `requireTenantMembership` resolved.
 * @param extra - The re-render state: a just-minted secret, or validation issues.
 * @returns The rendered agent-clients page.
 */
async function renderAgentClientsPage(
	ctx: RequestContext,
	resolved: { role: MembershipRole; tenant: { id: string; name: string } },
	extra: {
		justRegistered?: { clientId: string; secret: string } | null;
		name?: string;
		selectedScopes?: ReadonlyArray<string>;
		issues?: ReadonlyArray<s.Issue>;
	} = {},
): Promise<Response> {
	let clients = await AgentClientBinding.listByTenantId(ctx.db, resolved.tenant.id);

	return ctx.render(
		<PublicDocument title="Auth SaaS - Agent clients">
			<AgentClientsPage
				tenant={resolved.tenant}
				role={resolved.role}
				clients={clients}
				scopes={MANAGEMENT_SCOPES}
				scopeTitles={MANAGEMENT_SCOPE_TITLES}
				scopeDescriptions={MANAGEMENT_SCOPE_DESCRIPTIONS}
				registerAction={routes.dashboard.registerAgentClient.href({ tenantId: resolved.tenant.id })}
				signOutAction={routes.dashboard.signOut.href()}
				backHref={routes.dashboard.show.href()}
				justRegistered={extra.justRegistered}
				name={extra.name}
				selectedScopes={extra.selectedScopes}
				issues={extra.issues}
			/>
		</PublicDocument>,
		extra.issues?.length ? { status: 400 } : undefined,
	);
}

/**
 * `GET /dashboard/tenants/:tenantId/agent-clients` — lists every machine credential
 * registered against the tenant, refusing a subject with no membership there.
 *
 * @param ctx - The request context (provides `render`, `params` and `db`).
 * @returns The rendered agent-clients page, or a redirect.
 * @example
 * router.map(routes.dashboard.agentClients, dashboardAgentClientsShow);
 */
export const dashboardAgentClientsShow = createAction(
	routes.dashboard.agentClients,
	async (ctx) => {
		let resolved = await requireTenantMembership(ctx, ctx.params.tenantId);
		if ("redirect" in resolved) return resolved.redirect;

		return renderAgentClientsPage(ctx, resolved);
	},
);

/**
 * `POST /dashboard/tenants/:tenantId/agent-clients` — registers a machine credential
 * through the real Management API route, then renders the plaintext secret exactly
 * once on this same response.
 *
 * @param ctx - The request context (provides `formData`, `render`, `params` and `db`).
 * @returns The agent-clients page carrying the freshly-minted secret, this page
 * re-rendered with an error, or a redirect.
 * @example
 * router.map(routes.dashboard.registerAgentClient, dashboardAgentClientsRegister);
 */
export const dashboardAgentClientsRegister = createAction(
	routes.dashboard.registerAgentClient,
	async (ctx) => {
		let resolved = await requireTenantMembership(ctx, ctx.params.tenantId);
		if ("redirect" in resolved) return resolved.redirect;

		let parsed = s.parseSafe(registerAgentClientSchema, ctx.formData);
		if (!parsed.success) return renderAgentClientsPage(ctx, resolved, { issues: parsed.issues });

		let { name, scopes } = parsed.value;
		if (scopes.length === 0) {
			return renderAgentClientsPage(ctx, resolved, {
				name,
				selectedScopes: scopes,
				issues: [{ message: "Choose at least one scope.", path: ["scopes"] }],
			});
		}

		let response = await callManagementApi(ctx, `/tenants/${resolved.tenant.id}/agent-clients`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, scopes }),
		});

		if (!response.ok) {
			let problem = (await response.json().catch(() => ({}))) as { detail?: string };
			return renderAgentClientsPage(ctx, resolved, {
				name,
				selectedScopes: scopes,
				issues: [{ message: problem.detail ?? "Something went wrong. Try again." }],
			});
		}

		let created = (await response.json()) as { clientId: string; secret: string };

		return renderAgentClientsPage(ctx, resolved, {
			justRegistered: { clientId: created.clientId, secret: created.secret },
		});
	},
);
