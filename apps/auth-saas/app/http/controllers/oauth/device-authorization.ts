/**
 * `POST /oauth/device_authorization` — mints a device and user code pair for a
 * device with no browser worth using, per RFC 8628. Unauthenticated beyond the
 * `client_id` it names, since the device holds no secret to present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import routes from "~/routes/tenant";

import { tokenError } from "./token";

/** Reads a form field as a non-empty string, or `null` when absent, empty, or a file. */
function stringField(form: FormData, name: string): string | null {
	let value = form.get(name);
	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Mints a device and user code pair for a client carrying the device grant.
 *
 * @param ctx - The request context (provides `tenantStub`).
 * @returns The RFC 8628 device authorization response, or the OAuth error the
 * tenant's device authorization module refused the request for.
 * @example
 * router.map(routes.deviceAuthorization, deviceAuthorization);
 */
export default createAction(routes.deviceAuthorization, async (ctx) => {
	let form = ctx.formData;

	let clientId = stringField(form, "client_id");
	if (clientId === null) {
		return tokenError(400, "invalid_request", "client_id is required.");
	}

	let scope = stringField(form, "scope") ?? "";

	let result = await ctx.tenantStub.beginDeviceAuthorization({
		clientId,
		scope,
		now: Date.now(),
	});

	if (!result.ok) {
		if (result.reason === "invalid-client") {
			return tokenError(400, "invalid_client", "This client is not recognized.");
		}

		if (result.reason === "unsupported-grant-type") {
			return tokenError(
				400,
				"unauthorized_client",
				"This application is not registered for the device authorization grant.",
			);
		}

		return tokenError(
			400,
			"invalid_scope",
			"One or more requested scopes are not allowed for this application.",
		);
	}

	return json(
		{
			device_code: result.deviceCode,
			user_code: result.userCode,
			verification_uri: result.verificationUri,
			verification_uri_complete: result.verificationUriComplete,
			expires_in: result.expiresIn,
			interval: result.interval,
		},
		{ status: 200, headers: { "Cache-Control": "no-store" } },
	);
});
