/**
 * The W3C Passkey Endpoints document: where a password manager sends a person to
 * create a passkey or manage existing ones. Every member is optional, so an empty
 * object is a valid document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";
import type { FieldTable } from "./lib/metadata.js";
import type { WellKnownParseError } from "./parse-error.js";

import { readMetadata, writeMetadata } from "./lib/metadata.js";

export const NAME = "passkey-endpoints";
export const MEDIA_TYPE = "application/json";

export interface PasskeyEndpoints {
	/** The page where a signed-in person creates a passkey. */
	enroll: URL | null;
	/** The page where a signed-in person lists and removes their passkeys. */
	manage: URL | null;
	/** The page explaining how the site uses the WebAuthn PRF extension. */
	prfUsageDetails: URL | null;
}

/** Every member the specification defines, by camelCase field. */
const FIELDS = {
	enroll: { wire: "enroll", kind: "url" },
	manage: { wire: "manage", kind: "url" },
	prfUsageDetails: { wire: "prf_usage_details", kind: "url" },
} satisfies FieldTable;

/**
 * Reads the document; absent members are `null`, a member that is not an absolute URL
 * fails, and unknown members are ignored.
 *
 * @param text - The served JSON.
 */
export function parse(text: string): Result<PasskeyEndpoints, WellKnownParseError> {
	let read = readMetadata(text, { format: NAME, table: FIELDS });
	if (read.status === "failure") return read;
	let { enroll, manage, prfUsageDetails } = read.data as unknown as PasskeyEndpoints;
	return success({ enroll, manage, prfUsageDetails });
}

/**
 * Writes the document, leaving out `null` members.
 *
 * @param document - The endpoints to publish.
 */
export function stringify(document: PasskeyEndpoints): string {
	return writeMetadata(document, FIELDS);
}

/** The passkey endpoints as a servable format, always answered with the document itself. */
export const passkeyEndpoints: WellKnownFormat<PasskeyEndpoints> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: false,
	stringify,
	parse,
};
