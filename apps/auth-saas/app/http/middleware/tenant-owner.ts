/**
 * Middleware that authorizes access to the tenant named in the URL for the current
 * platform user (owners, pending owners, and team members), then attaches the resolved
 * tenant and a per-tenant {@link TenantApiService} client to the request context.
 * Must run after the session middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { TenantMemberRole } from "~/app/models/tenant-member";

import middleware from "~/app/lib/middleware";
import Tenant from "~/app/models/tenant";
import { TenantApiService } from "~/app/services/tenant-api";

declare module "remix/router" {
	interface RequestContext {
		tenant: {
			id: string;
			name: string;
			slug: string;
			region: string;
			status: string;
			/** Whether this is an internal (non-billed) tenant. */
			internal: boolean;
			/** The current user's role for this tenant. */
			role: "owner" | TenantMemberRole;
		};
		tenantApi: TenantApiService;
	}
}

/**
 * Middleware that verifies the current user has access to the tenant in the URL.
 * Supports owners, pending owners, and team members.
 * Must be used after the session middleware.
 *
 * @returns The downstream response when access is granted, or a `400`/`403` response
 * when the tenant id is missing or the user lacks access.
 * @example
 * router.map(route, { middleware: [session, tenantOwner], handler });
 */
export default middleware(async (context, next) => {
	let tenantId = context.params.tenantId as string | undefined;

	if (!tenantId) {
		return new Response("Tenant ID required", { status: 400 });
	}

	let db = getServiceContainer().get(Database);

	let tenant = await Tenant.showWithAccess(
		db,
		tenantId,
		context.platformSession.subjectId,
		context.platformSession.email,
	);

	if (!tenant) {
		return new Response("Access denied", { status: 403 });
	}

	context.tenant = {
		id: tenant.id,
		name: tenant.name,
		slug: tenant.slug,
		region: tenant.region,
		status: tenant.status,
		internal: tenant.internal,
		role: tenant.role,
	};

	context.tenantApi = new TenantApiService(tenantId);

	return next();
});
