/**
 * A real management router mapping every tenant, member, domain, MFA-policy
 * and session-policy route, wired around the provisioned tenant and helpers
 * {@link buildManagementTestCore} builds, for driving the HTTP surface
 * through real requests the way `roles/test-harness.ts` drives the roles
 * surface. A domain attach or remove call reaches Cloudflare's
 * custom-hostname API for real, through a `HostnameClient` pointed at the
 * zone a test's own MSW handlers answer for, the way
 * `app/services/domain.test.ts` already drives that same client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HostnameClient } from "@sdxc/hostname";
import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ManagementTestCore } from "~/app/http/controllers/management/test-harness";
import type TenantObject from "~/database/tenant-do";

import {
	createTenantDomainsAttachAction,
	createTenantDomainsListAction,
	createTenantDomainsRemoveAction,
	createTenantDomainsVerificationAction,
} from "~/app/http/controllers/management/tenants/domains";
import {
	createTenantMembersCreateAction,
	createTenantMembersListAction,
	createTenantMembersRemoveAction,
	createTenantMembersUpdateRoleAction,
} from "~/app/http/controllers/management/tenants/members";
import { createTenantMfaPolicySetAction } from "~/app/http/controllers/management/tenants/mfa-policy";
import { createTenantReadAction } from "~/app/http/controllers/management/tenants/read";
import { createTenantSessionPolicyDescribeAction } from "~/app/http/controllers/management/tenants/session-policy";
import { createTenantSessionPolicySetAction } from "~/app/http/controllers/management/tenants/set-session-policy";
import {
	buildManagementTestCore,
	fakeHostnameClient,
	fakeLimiter,
	grantEntitlement,
	grantMembership,
	HOSTNAME_ZONE_ID,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import routes from "~/routes/management";

export {
	fakeHostnameClient,
	fakeLimiter,
	grantEntitlement,
	grantMembership,
	HOSTNAME_ZONE_ID,
	ISSUER,
};

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildTenantsRouter(
	db: Database,
	tenantDO: TenantObject,
	options: {
		resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
		limiter?: RateLimiterBinding;
		hostnameClient?: () => HostnameClient;
	} = {},
) {
	let controllerOptions: ManagementControllerOptions = {
		issuer: ISSUER,
		resolveDashboardSubjectId: options.resolveDashboardSubjectId ?? (async () => null),
		limiter: options.limiter ?? fakeLimiter(),
		resolveStub: () => tenantDO as unknown as DurableObjectStub<TenantObject>,
		hostnameClient: options.hostnameClient ?? fakeHostnameClient,
	};

	let router = createRouter({ middleware: [database(() => db)] });

	router.map(routes.tenantRead, createTenantReadAction(controllerOptions));

	router.map(routes.tenantMembersList, createTenantMembersListAction(controllerOptions));
	router.map(routes.tenantMembersCreate, createTenantMembersCreateAction(controllerOptions));
	router.map(
		routes.tenantMembersUpdateRole,
		createTenantMembersUpdateRoleAction(controllerOptions),
	);
	router.map(routes.tenantMembersRemove, createTenantMembersRemoveAction(controllerOptions));

	router.map(routes.tenantDomainsList, createTenantDomainsListAction(controllerOptions));
	router.map(routes.tenantDomainsAttach, createTenantDomainsAttachAction(controllerOptions));
	router.map(
		routes.tenantDomainsVerification,
		createTenantDomainsVerificationAction(controllerOptions),
	);
	router.map(routes.tenantDomainsRemove, createTenantDomainsRemoveAction(controllerOptions));

	router.map(routes.tenantMfaPolicySet, createTenantMfaPolicySetAction(controllerOptions));

	router.map(routes.tenantSessionPolicySet, createTenantSessionPolicySetAction(controllerOptions));
	router.map(
		routes.tenantSessionPolicyDescribe,
		createTenantSessionPolicyDescribeAction(controllerOptions),
	);

	return router;
}

export interface TenantsHarness extends ManagementTestCore {
	router: ReturnType<typeof buildTenantsRouter>;
}

export interface BuildTenantsHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
	hostnameClient?: () => HostnameClient;
	/** The scope a signed token carries when a test asks for none of its own. */
	defaultScope?: string;
}

/** Provisions a fresh tenant, its control-plane record, and the tenants router, ready for an HTTP-surface test. */
export async function buildTenantsHarness(
	options: BuildTenantsHarnessOptions = {},
): Promise<TenantsHarness> {
	let core = await buildManagementTestCore({
		defaultScope: options.defaultScope ?? "tenant:write members:write",
	});
	let router = buildTenantsRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
