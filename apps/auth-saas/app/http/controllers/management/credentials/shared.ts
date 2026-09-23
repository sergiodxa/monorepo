/**
 * What every route in this directory shares: reading the `:credentialId`,
 * `:deviceId` and `:sessionId` path params, and the `problem+json` responses
 * for a passkey, trusted device or session the tenant does not hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import { managementProblem } from "~/app/http/lib/problem";

/** Parses and requires the `:credentialId` path param every single-passkey route matches. */
export function credentialIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ credentialId: s.string() }), ctx.params).credentialId;
}

/** Parses and requires the `:deviceId` path param the trusted-device revoke route matches. */
export function deviceIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ deviceId: s.string() }), ctx.params).deviceId;
}

/** Parses and requires the `:sessionId` path param the single-session route matches. */
export function sessionIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ sessionId: s.string() }), ctx.params).sessionId;
}

/** A passkey named in a route's own path that this subject does not hold. */
export function passkeyNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such passkey exists for this subject.",
	});
}

/** A trusted device named in a route's own path that this subject does not hold. */
export function trustedDeviceNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such trusted device exists for this subject.",
	});
}

/** A session named in a route's own path that this subject does not hold. */
export function sessionNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such session exists for this subject.",
	});
}
