import Tenant from "~/app/models/tenant";
import { TenantApiService } from "~/app/services/tenant-api";
import middleware from "~/lib/middleware";

declare module "remix/fetch-router" {
	interface RequestContext {
		tenant: {
			id: string;
			name: string;
			slug: string;
			region: string;
			status: string;
		};
		tenantApi: TenantApiService;
	}
}

/**
 * Middleware that verifies the current user owns the tenant in the URL.
 * Must be used after the session middleware.
 */
export default middleware(async (context, next) => {
	let tenantId = context.params.tenantId as string | undefined;

	if (!tenantId) {
		return new Response("Tenant ID required", { status: 400 });
	}

	let tenant = await Tenant.show(context.db, tenantId);

	if (!tenant) {
		return new Response("Tenant not found", { status: 404 });
	}

	if (tenant.owner_subject_id !== context.platformSession.subjectId) {
		return new Response("Access denied", { status: 403 });
	}

	context.tenant = {
		id: tenant.id,
		name: tenant.name,
		slug: tenant.slug,
		region: tenant.region,
		status: tenant.status,
	};

	context.tenantApi = new TenantApiService(tenantId);

	return next();
});
