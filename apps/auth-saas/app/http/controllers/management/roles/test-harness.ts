/**
 * A real management router mapping every roles, permissions and consent
 * grants route, wired around the provisioned tenant and helpers
 * {@link buildManagementTestCore} builds, for driving the HTTP surface
 * through real requests the way `api-keys/test-harness.ts` drives the API
 * keys surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ManagementTestCore } from "~/app/http/controllers/management/test-harness";
import type TenantObject from "~/database/tenant-do";

import { createSubjectAccessReadAction } from "~/app/http/controllers/management/roles/access";
import { createSubjectRolesAssignAction } from "~/app/http/controllers/management/roles/assign";
import { createRolesDefineAction } from "~/app/http/controllers/management/roles/define";
import { createRolesDeleteAction } from "~/app/http/controllers/management/roles/delete";
import {
	createSubjectGrantsListAction,
	createSubjectGrantsRevokeAction,
} from "~/app/http/controllers/management/roles/grants";
import { createRolesListAction } from "~/app/http/controllers/management/roles/list";
import {
	createPermissionsDefineAction,
	createPermissionsListAction,
	createPermissionsRemoveAction,
} from "~/app/http/controllers/management/roles/permissions";
import { createRolesSetPermissionsAction } from "~/app/http/controllers/management/roles/set-permissions";
import { createRolesUpdateAction } from "~/app/http/controllers/management/roles/update";
import {
	buildManagementTestCore,
	fakeLimiter,
	grantEntitlement,
	grantMembership,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import routes from "~/routes/management";

export { fakeLimiter, grantEntitlement, grantMembership, ISSUER };

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildRolesRouter(
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
	};

	let router = createRouter({ middleware: [database(() => db)] });

	router.map(routes.permissionsList, createPermissionsListAction(controllerOptions));
	router.map(routes.permissionsDefine, createPermissionsDefineAction(controllerOptions));
	router.map(routes.permissionsRemove, createPermissionsRemoveAction(controllerOptions));

	router.map(routes.rolesList, createRolesListAction(controllerOptions));
	router.map(routes.rolesDefine, createRolesDefineAction(controllerOptions));
	router.map(routes.rolesUpdate, createRolesUpdateAction(controllerOptions));
	router.map(routes.rolesDelete, createRolesDeleteAction(controllerOptions));
	router.map(routes.rolesSetPermissions, createRolesSetPermissionsAction(controllerOptions));

	router.map(routes.subjectRolesAssign, createSubjectRolesAssignAction(controllerOptions));
	router.map(routes.subjectAccessRead, createSubjectAccessReadAction(controllerOptions));

	router.map(routes.subjectGrantsList, createSubjectGrantsListAction(controllerOptions));
	router.map(routes.subjectGrantsRevoke, createSubjectGrantsRevokeAction(controllerOptions));

	return router;
}

export interface RolesHarness extends ManagementTestCore {
	router: ReturnType<typeof buildRolesRouter>;
}

export interface BuildRolesHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
	/** The scope a signed token carries when a test asks for none of its own. */
	defaultScope?: string;
}

/** Provisions a fresh tenant, its control-plane record, and the roles router, ready for an HTTP-surface test. */
export async function buildRolesHarness(
	options: BuildRolesHarnessOptions = {},
): Promise<RolesHarness> {
	let core = await buildManagementTestCore({
		defaultScope: options.defaultScope ?? "members:write",
	});
	let router = buildRolesRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
