/**
 * A real management router mapping the audit events route, wired around the
 * provisioned tenant and helpers {@link buildManagementTestCore} builds, for
 * driving the HTTP surface through real requests the way
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { createR2Bucket } from "@sdxc/cloudflare-mocks";
import { database } from "@sdxc/database-middleware";
import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type TenantObject from "~/app/models/tenant/object";
import type { ManagementTestCore } from "~/app/test/harness/management";

import { createAuditEventsListAction } from "~/app/http/controllers/management/audit/list";
import { models as modelsMiddleware } from "~/app/http/middleware/models";
import {
	buildManagementTestCore,
	conformance,
	fakeHostnameClient,
	fakeLimiter,
	grantMembership,
	ISSUER,
} from "~/app/test/harness/management";
import routes from "~/routes/management";

export { fakeHostnameClient, fakeLimiter, grantMembership, ISSUER };

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildAuditRouter(
	db: Database,
	tenantDO: TenantObject,
	options: {
		resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
		limiter?: RateLimiterBinding;
	} = {},
) {
	let controllerOptions: ManagementControllerOptions = {
		issuer: ISSUER,
		resolveDashboardSubjectId: options.resolveDashboardSubjectId ?? (async () => null),
		limiter: options.limiter ?? fakeLimiter(),
		resolveStub: () => tenantDO as unknown as DurableObjectStub<TenantObject>,
		hostnameClient: fakeHostnameClient,
		r2: createR2Bucket(),
	};

	let router = createRouter({ middleware: [conformance, database(db), modelsMiddleware()] });

	router.map(routes.auditEventsList, createAuditEventsListAction(controllerOptions));

	return router;
}

export interface AuditHarness extends ManagementTestCore {
	router: ReturnType<typeof buildAuditRouter>;
}

export interface BuildAuditHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
	/** The scope a signed token carries when a test asks for none of its own. */
	defaultScope?: string;
}

/** Provisions a fresh tenant, its control-plane record, and the audit router, ready for an HTTP-surface test. */
export async function buildAuditHarness(
	options: BuildAuditHarnessOptions = {},
): Promise<AuditHarness> {
	let core = await buildManagementTestCore({ defaultScope: options.defaultScope ?? "audit:read" });
	let router = buildAuditRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
