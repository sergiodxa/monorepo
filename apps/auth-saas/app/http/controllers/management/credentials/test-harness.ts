/**
 * A real management router mapping every passkeys, password, second-factor
 * and session route, wired around the provisioned tenant and helpers
 * {@link buildManagementTestCore} builds, for driving the HTTP surface
 * through real requests the way `roles/test-harness.ts` drives the roles
 * surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { createR2Bucket } from "@sdxc/cloudflare-mocks";
import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ManagementTestCore } from "~/app/http/controllers/management/test-harness";
import type TenantObject from "~/database/tenant-do";

import {
	createPasskeysListAction,
	createPasskeysRenameAction,
	createPasskeysRevokeAction,
} from "~/app/http/controllers/management/credentials/passkeys";
import { createPasswordForceResetAction } from "~/app/http/controllers/management/credentials/passwords";
import {
	createSecondFactorResetAction,
	createSecondFactorTrustedDevicesRevokeAction,
} from "~/app/http/controllers/management/credentials/second-factor";
import {
	createSessionsListAction,
	createSessionsRevokeAction,
	createSessionsRevokeAllAction,
} from "~/app/http/controllers/management/credentials/sessions";
import {
	buildManagementTestCore,
	conformance,
	fakeHostnameClient,
	fakeLimiter,
	grantMembership,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import { models as modelsMiddleware } from "~/app/http/middleware/models";
import routes from "~/routes/management";

export { fakeHostnameClient, fakeLimiter, grantMembership, ISSUER };

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildCredentialsRouter(
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

	let router = createRouter({ middleware: [conformance, database(() => db), modelsMiddleware()] });

	router.map(routes.passkeysList, createPasskeysListAction(controllerOptions));
	router.map(routes.passkeysRename, createPasskeysRenameAction(controllerOptions));
	router.map(routes.passkeysRevoke, createPasskeysRevokeAction(controllerOptions));

	router.map(routes.passwordForceReset, createPasswordForceResetAction(controllerOptions));

	router.map(routes.secondFactorReset, createSecondFactorResetAction(controllerOptions));
	router.map(
		routes.secondFactorTrustedDevicesRevoke,
		createSecondFactorTrustedDevicesRevokeAction(controllerOptions),
	);

	router.map(routes.sessionsList, createSessionsListAction(controllerOptions));
	router.map(routes.sessionsRevoke, createSessionsRevokeAction(controllerOptions));
	router.map(routes.sessionsRevokeAll, createSessionsRevokeAllAction(controllerOptions));

	return router;
}

export interface CredentialsHarness extends ManagementTestCore {
	router: ReturnType<typeof buildCredentialsRouter>;
}

export interface BuildCredentialsHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
	/** The scope a signed token carries when a test asks for none of its own. */
	defaultScope?: string;
}

/** Provisions a fresh tenant, its control-plane record, and the credentials router, ready for an HTTP-surface test. */
export async function buildCredentialsHarness(
	options: BuildCredentialsHarnessOptions = {},
): Promise<CredentialsHarness> {
	let core = await buildManagementTestCore({
		defaultScope: options.defaultScope ?? "subjects:write",
	});
	let router = buildCredentialsRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
