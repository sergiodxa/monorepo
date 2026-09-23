/**
 * The passkeys enrolled under a subject: `GET .../passkeys` lists them,
 * `PATCH .../passkeys/:credentialId` renames one, and `DELETE
 * .../passkeys/:credentialId` removes one, refusing to take a subject's last
 * remaining way to sign in. A credential id is base64url without padding, an
 * alphabet with no `.` in it, so it travels safely as a path segment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RevokePasskeyResult } from "~/database/passkeys";

import {
	credentialIdParam,
	passkeyNotFound,
} from "~/app/http/controllers/management/credentials/shared";
import { subjectIdParam } from "~/app/http/controllers/management/subjects/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

function mountedMiddleware(options: ManagementControllerOptions, bucket: "read" | "write") {
	return [
		managementAuth({
			issuer: options.issuer,
			resolveDashboardSubjectId: options.resolveDashboardSubjectId,
		}),
		managementTenant(options.resolveStub),
		managementRateLimit(options.limiter, { bucket }),
	];
}

/**
 * Builds the `passkeysList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.passkeysList, createPasskeysListAction(options));
 */
export function createPasskeysListAction(options: ManagementControllerOptions) {
	return createAction(routes.passkeysList, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let result = await ctx.tenantStub.listPasskeys({ subjectId });

			return json(result.passkeys, { status: 200 });
		},
	});
}

let RenamePasskeyBodySchema = s.object({ label: s.string() });

/**
 * Builds the `passkeysRename` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.passkeysRename, createPasskeysRenameAction(options));
 */
export function createPasskeysRenameAction(options: ManagementControllerOptions) {
	return createAction(routes.passkeysRename, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);
			let credentialId = credentialIdParam(ctx);

			let parsed = parseBody(RenamePasskeyBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.renamePasskey({
				subjectId,
				credentialId,
				label: parsed.data.label,
			});
			if (!result.ok) return passkeyNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

/** Maps every `revokePasskey` refusal onto its own `problem+json` response. */
function revokePasskeyFailure(result: Exclude<RevokePasskeyResult, { ok: true }>): Response {
	if (result.reason === "not-found") return passkeyNotFound();

	return managementProblem("lastCredential");
}

/**
 * Builds the `passkeysRevoke` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.passkeysRevoke, createPasskeysRevokeAction(options));
 */
export function createPasskeysRevokeAction(options: ManagementControllerOptions) {
	return createAction(routes.passkeysRevoke, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);
			let credentialId = credentialIdParam(ctx);

			let result = await ctx.tenantStub.revokePasskey({ subjectId, credentialId });
			if (!result.ok) return revokePasskeyFailure(result);

			return new Response(null, { status: 204 });
		},
	});
}
