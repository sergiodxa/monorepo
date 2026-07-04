import type { TenantMemberRole } from "~/app/models/tenant-member";

import middleware from "~/app/lib/middleware";
import Tenant from "~/app/models/tenant";
import { TenantApiService } from "~/app/services/tenant-api";

declare module "remix/fetch-router" {
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
 */
export default middleware(async (context, next) => {
	let tenantId = context.params.tenantId as string | undefined;

	if (!tenantId) {
		return new Response("Tenant ID required", { status: 400 });
	}

	let tenant = await Tenant.showWithAccess(
		context.db,
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
