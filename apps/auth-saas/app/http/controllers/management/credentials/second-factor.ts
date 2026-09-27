/**
 * The administrative second-factor actions a subject cannot take on its own:
 * `POST .../second-factor/reset` strips a subject's whole TOTP state and
 * marks it owing a fresh enrolment, and `POST
 * .../second-factor/trusted-devices/:deviceId/revoke` ends one remembered
 * browser's excuse from proving it again. The current state — the active
 * factor, its recovery codes and its trusted devices — is already part of
 * `subjectsRead`'s own payload, so this resource exposes no read route of
 * its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	deviceIdParam,
	trustedDeviceNotFound,
} from "~/app/http/controllers/management/credentials/shared";
import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SECOND_FACTOR_RESET } from "~/app/http/openapi/credentials";
import routes from "~/routes/management";

function mountedMiddleware(options: ManagementControllerOptions) {
	return [
		managementAuth({
			issuer: options.issuer,
			resolveDashboardSubjectId: options.resolveDashboardSubjectId,
		}),
		managementTenant(options.resolveStub),
		managementRateLimit(options.limiter, { bucket: "write" }),
	];
}

/**
 * Builds the `secondFactorReset` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.secondFactorReset, createSecondFactorResetAction(options));
 */
export function createSecondFactorResetAction(options: ManagementControllerOptions) {
	return createAction(routes.secondFactorReset, {
		middleware: mountedMiddleware(options),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let input = await SECOND_FACTOR_RESET.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.resetSecondFactor({
				subjectId,
				reason: input.data.body.reason,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return subjectNotFound();

			return json({ notifyAddress: result.notifyAddress }, { status: 200 });
		},
	});
}

/**
 * Builds the `secondFactorTrustedDevicesRevoke` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(
 * 	routes.secondFactorTrustedDevicesRevoke,
 * 	createSecondFactorTrustedDevicesRevokeAction(options),
 * );
 */
export function createSecondFactorTrustedDevicesRevokeAction(options: ManagementControllerOptions) {
	return createAction(routes.secondFactorTrustedDevicesRevoke, {
		middleware: mountedMiddleware(options),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);
			let deviceId = deviceIdParam(ctx);

			let result = await ctx.tenantStub.revokeTrustedDevice({ subjectId, deviceId });
			if (!result.ok) return trustedDeviceNotFound();

			return new Response(null, { status: 204 });
		},
	});
}
