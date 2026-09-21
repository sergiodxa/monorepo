/**
 * Turns a raw `/scim/v2/*` request — its JSON body or its query string — into
 * the shapes `scim.ts`'s own RPC methods accept: a `ScimUserResource` or
 * `ScimGroupResource` for a create or a replace, a flat operation list for a
 * PATCH, and a filter/page pair for a list. Nothing here writes anything; a
 * request this module cannot make sense of answers `null` for its caller to
 * turn into the matching SCIM error document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type {
	ScimGroupPatchOperation,
	ScimGroupResource,
	ScimUserPatchOperation,
	ScimUserResource,
} from "~/database/scim";
import type { AttributeValue } from "~/database/subjects";

import { ENTERPRISE_USER_SCHEMA } from "./response";

/** A simple, single-segment attribute name — the only `path` shape a supported PATCH operation may name. */
const SIMPLE_ATTRIBUTE_PATH = /^[A-Za-z][A-Za-z0-9_]*$/;

/** The one member-removal `path` shape this connection parses; anything else is unsupported. */
const MEMBER_REMOVE_PATH = /^members\[value eq "([^"]*)"\]$/;

let AttributeValueSchema = s.union([s.string(), s.number(), s.boolean(), s.null_()]);

let ScimEmailSchema = s.object({ value: s.string(), primary: s.optional(s.boolean()) });

let ScimNameSchema = s.object({
	givenName: s.optional(s.nullable(s.string())),
	familyName: s.optional(s.nullable(s.string())),
	formatted: s.optional(s.nullable(s.string())),
});

let ScimPhotoSchema = s.object({ value: s.string(), type: s.optional(s.string()) });

let ScimUserResourceSchema = s.object({
	externalId: s.optional(s.nullable(s.string())),
	userName: s.optional(s.string()),
	active: s.optional(s.boolean()),
	emails: s.optional(s.array(ScimEmailSchema)),
	name: s.optional(ScimNameSchema),
	displayName: s.optional(s.nullable(s.string())),
	preferredLanguage: s.optional(s.nullable(s.string())),
	timezone: s.optional(s.nullable(s.string())),
	photos: s.optional(s.array(ScimPhotoSchema)),
	[ENTERPRISE_USER_SCHEMA]: s.optional(s.record(s.string(), AttributeValueSchema)),
});

/**
 * Parses a create or replace request body into the `ScimUserResource` shape
 * `scimProvisionUser` and `scimReplaceUser` accept, folding the enterprise
 * extension's schema-qualified key onto `enterprise`.
 *
 * @param body - The request's already-decoded JSON body.
 * @returns The parsed resource, or that the body does not parse.
 */
export function parseScimUserResource(
	body: unknown,
): { ok: true; resource: ScimUserResource } | { ok: false } {
	let parsed = s.parseSafe(ScimUserResourceSchema, body);
	if (!parsed.success) return { ok: false };

	let { [ENTERPRISE_USER_SCHEMA]: enterprise, ...rest } = parsed.value;

	return {
		ok: true,
		resource: { ...rest, enterprise: enterprise as Record<string, AttributeValue> | undefined },
	};
}

let ScimGroupMemberSchema = s.object({ value: s.string() });

let ScimGroupResourceSchema = s.object({
	displayName: s.string(),
	externalId: s.optional(s.nullable(s.string())),
	members: s.optional(s.array(ScimGroupMemberSchema)),
});

/**
 * Parses a create or replace request body into the `ScimGroupResource` shape
 * `scimProvisionGroup` and `scimReplaceGroup` accept.
 *
 * @param body - The request's already-decoded JSON body.
 * @returns The parsed resource, or that the body does not parse.
 */
export function parseScimGroupResource(
	body: unknown,
): { ok: true; resource: ScimGroupResource } | { ok: false } {
	let parsed = s.parseSafe(ScimGroupResourceSchema, body);
	if (!parsed.success) return { ok: false };
	return { ok: true, resource: parsed.value };
}

let ScimPatchOperationSchema = s.object({
	op: s.string(),
	path: s.optional(s.nullable(s.string())),
	value: s.any(),
});

let ScimPatchRequestSchema = s.object({
	Operations: s.array(ScimPatchOperationSchema),
});

export type PatchTranslation<Operation> =
	| { ok: true; operations: Operation[] }
	| { ok: false; index?: number };

/**
 * Parses a PATCH request body into the flat, single-attribute operation list
 * `scimPatchUser` accepts — the `replace`/`add` forms on a named attribute,
 * nothing else, since that is the whole of what `scim.ts` can apply.
 *
 * @param body - The request's already-decoded JSON body.
 * @returns The translated operations, or the index of the first operation
 * this connection does not serve, or that the envelope itself does not parse.
 */
export function parseUserPatchOperations(body: unknown): PatchTranslation<ScimUserPatchOperation> {
	let parsed = s.parseSafe(ScimPatchRequestSchema, body);
	if (!parsed.success) return { ok: false };

	let operations: ScimUserPatchOperation[] = [];

	for (let [index, raw] of parsed.value.Operations.entries()) {
		let op = raw.op.toLowerCase();
		let path = raw.path ?? undefined;

		if ((op !== "replace" && op !== "add") || !path || !SIMPLE_ATTRIBUTE_PATH.test(path)) {
			return { ok: false, index };
		}

		operations.push({ op, attribute: path, value: raw.value as AttributeValue });
	}

	return { ok: true, operations };
}

/**
 * Parses a PATCH request body into the operation list `scimPatchGroup`
 * accepts — a `displayName` change, a membership `add` with a value array,
 * or a membership `remove` naming one subject through `members[value eq
 * "…"]`, the three forms `scim.ts` can apply to a group.
 *
 * @param body - The request's already-decoded JSON body.
 * @returns The translated operations, or the index of the first operation
 * this connection does not serve, or that the envelope itself does not parse.
 */
export function parseGroupPatchOperations(
	body: unknown,
): PatchTranslation<ScimGroupPatchOperation> {
	let parsed = s.parseSafe(ScimPatchRequestSchema, body);
	if (!parsed.success) return { ok: false };

	let operations: ScimGroupPatchOperation[] = [];

	for (let [index, raw] of parsed.value.Operations.entries()) {
		let op = raw.op.toLowerCase();
		let path = raw.path ?? undefined;

		if (
			path === "displayName" &&
			(op === "replace" || op === "add") &&
			typeof raw.value === "string"
		) {
			operations.push({ op, attribute: "displayName", value: raw.value });
			continue;
		}

		if (path === "members" && op === "add" && Array.isArray(raw.value)) {
			let values = raw.value.map((entry) =>
				typeof entry === "object" &&
				entry !== null &&
				typeof (entry as { value?: unknown }).value === "string"
					? (entry as { value: string }).value
					: null,
			);
			if (values.some((value) => value === null)) return { ok: false, index };
			operations.push({ op: "add", attribute: "members", values: values as string[] });
			continue;
		}

		if (op === "remove" && path) {
			let match = MEMBER_REMOVE_PATH.exec(path);
			if (match) {
				operations.push({ op: "remove", attribute: "members", value: match[1] ?? "" });
				continue;
			}
		}

		return { ok: false, index };
	}

	return { ok: true, operations };
}

export interface ScimListQuery {
	filter?: string;
	startIndex?: number;
	count?: number;
}

/**
 * Reads the list query params this connection serves — `filter`,
 * `startIndex` and `count` — from a `GET /scim/v2/Users` or `.../Groups`
 * request. `sortBy`, `sortOrder`, `attributes` and `excludedAttributes` are
 * read by no caller of this function, matching the surface `Schemas`
 * advertises.
 *
 * @param url - The request's URL.
 * @returns The query this connection acts on.
 */
export function parseScimListQuery(url: URL): ScimListQuery {
	let filter = url.searchParams.get("filter");
	let startIndex = url.searchParams.get("startIndex");
	let count = url.searchParams.get("count");

	return {
		...(filter !== null ? { filter } : {}),
		...(startIndex !== null && !Number.isNaN(Number(startIndex))
			? { startIndex: Number(startIndex) }
			: {}),
		...(count !== null && !Number.isNaN(Number(count)) ? { count: Number(count) } : {}),
	};
}
