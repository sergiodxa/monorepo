/**
 * A real management router mapping every subjects and identifiers route, wired
 * around the provisioned tenant and helpers {@link buildManagementTestCore}
 * builds, for driving the HTTP surface through real requests the way
 * `scim/test-harness.ts` drives the SCIM surface.
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

import { createSubjectsBlockAction } from "~/app/http/controllers/management/subjects/block";
import { createSubjectsCreateAction } from "~/app/http/controllers/management/subjects/create";
import { createSubjectsDeleteAction } from "~/app/http/controllers/management/subjects/delete";
import {
	createSubjectIdentifiersAddAction,
	createSubjectIdentifiersRemoveAction,
	createSubjectIdentifiersSetPrimaryAction,
	createSubjectIdentifiersVerifyAction,
} from "~/app/http/controllers/management/subjects/identifiers";
import { createSubjectsListAction } from "~/app/http/controllers/management/subjects/list";
import { createSubjectsReadAction } from "~/app/http/controllers/management/subjects/read";
import { createSubjectsUnblockAction } from "~/app/http/controllers/management/subjects/unblock";
import { createSubjectsUpdateAction } from "~/app/http/controllers/management/subjects/update";
import {
	buildManagementTestCore,
	fakeLimiter,
	grantMembership,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import routes from "~/routes/management";

export { fakeLimiter, grantMembership, ISSUER };

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildSubjectsRouter(
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

	router.map(routes.subjectsCreate, createSubjectsCreateAction(controllerOptions));
	router.map(routes.subjectsList, createSubjectsListAction(controllerOptions));
	router.map(routes.subjectsRead, createSubjectsReadAction(controllerOptions));
	router.map(routes.subjectsUpdate, createSubjectsUpdateAction(controllerOptions));
	router.map(routes.subjectsBlock, createSubjectsBlockAction(controllerOptions));
	router.map(routes.subjectsUnblock, createSubjectsUnblockAction(controllerOptions));
	router.map(routes.subjectsDelete, createSubjectsDeleteAction(controllerOptions));

	router.map(routes.subjectIdentifiersAdd, createSubjectIdentifiersAddAction(controllerOptions));
	router.map(
		routes.subjectIdentifiersVerify,
		createSubjectIdentifiersVerifyAction(controllerOptions),
	);
	router.map(
		routes.subjectIdentifiersSetPrimary,
		createSubjectIdentifiersSetPrimaryAction(controllerOptions),
	);
	router.map(
		routes.subjectIdentifiersRemove,
		createSubjectIdentifiersRemoveAction(controllerOptions),
	);

	return router;
}

export interface SubjectsHarness extends ManagementTestCore {
	router: ReturnType<typeof buildSubjectsRouter>;
}

export interface BuildSubjectsHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
}

/** Provisions a fresh tenant, its control-plane record, and the subjects router, ready for an HTTP-surface test. */
export async function buildSubjectsHarness(
	options: BuildSubjectsHarnessOptions = {},
): Promise<SubjectsHarness> {
	let core = await buildManagementTestCore({ defaultScope: "subjects:read subjects:write" });
	let router = buildSubjectsRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
