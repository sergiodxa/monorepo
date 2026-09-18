/**
 * Reads the client data the browser signs alongside every ceremony.
 *
 * This is the half of a WebAuthn response the browser vouches for rather than
 * the authenticator: it carries the challenge and the origin, which together
 * are what bind an assertion to one request from one site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { MalformedResponseError } from "../errors.js";

/** The fields of client data this package acts on. */
export interface ClientData {
	/** `webauthn.create` for a registration, `webauthn.get` for an assertion. */
	type: string;
	/** Challenge the ceremony was issued with, base64url as the browser writes it. */
	challenge: string;
	/** Origin of the page that ran the ceremony. */
	origin: string;
	/** Whether the ceremony ran inside a cross-origin frame. */
	crossOrigin?: boolean;
}

/**
 * Parses client data and confirms it carries the three fields verification
 * depends on.
 *
 * @param bytes The UTF-8 JSON the browser signed.
 * @returns The parsed client data, or `MalformedResponseError`.
 * @example
 * let clientData = parse(clientDataJSON);
 */
export function parse(bytes: Bytes): Result<ClientData, MalformedResponseError> {
	let value: unknown;
	try {
		value = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return failure(new MalformedResponseError("client data is not JSON"));
	}

	if (typeof value !== "object" || value === null) {
		return failure(new MalformedResponseError("client data is not an object"));
	}

	let { type, challenge, origin, crossOrigin } = value as Record<string, unknown>;
	if (typeof type !== "string" || typeof challenge !== "string" || typeof origin !== "string") {
		return failure(new MalformedResponseError("client data is missing a required field"));
	}

	return success({
		type,
		challenge,
		origin,
		crossOrigin: typeof crossOrigin === "boolean" ? crossOrigin : undefined,
	});
}
