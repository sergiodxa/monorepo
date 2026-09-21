/**
 * `application/scim+json` plumbing: the SCIM error document shape, the wire
 * representation `scim.ts`'s own user and group records round-trip through,
 * and the `ListResponse` envelope a page of either answers as. Every helper
 * here works on plain data — the request-body parsing a POST or PUT needs
 * lives next to it in `request.ts`, and the entitlement and rate-limit gate
 * lives in `~/app/http/middleware/scim-gate`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScimGroupRepresentation, ScimUserRepresentation } from "~/database/scim";

/** The schema URN every SCIM error document declares. */
const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

/** The schema URN a page of resources answers under. */
const LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

/** The schema URN a user resource declares. */
export const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";

/** The schema URN a group resource declares. */
export const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";

/** The schema URN the enterprise extension's members are qualified under. */
export const ENTERPRISE_USER_SCHEMA = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";

/** The one content type every `/scim/v2/*` response carries. */
const SCIM_CONTENT_TYPE = "application/scim+json";

/**
 * A JSON response stamped `application/scim+json` in place of the plain
 * `application/json` `Response.json` sets on its own.
 *
 * @param body - The value to serialize as the response body.
 * @param status - The status code to answer with.
 * @param headers - Additional headers to set alongside the content type.
 * @returns The SCIM-typed response.
 */
export function scimJson(body: unknown, status: number, headers?: HeadersInit): Response {
	let response = Response.json(body, { status, headers });
	response.headers.set("Content-Type", SCIM_CONTENT_TYPE);
	return response;
}

export interface ScimErrorInput {
	status: number;
	detail: string;
	scimType?: string;
	headers?: HeadersInit;
}

/**
 * Builds the RFC 7644 error document: `schemas`, `status` as a string, a
 * human-readable `detail`, and the `scimType` the refusal table names when
 * one applies.
 *
 * @param input - The status, detail message, optional `scimType`, and any
 * extra headers (a `Retry-After` on a `429`, for instance).
 * @returns The SCIM error response.
 */
export function scimError(input: ScimErrorInput): Response {
	let body: Record<string, unknown> = {
		schemas: [ERROR_SCHEMA],
		status: String(input.status),
		detail: input.detail,
	};
	if (input.scimType) body.scimType = input.scimType;

	return scimJson(body, input.status, input.headers);
}

/**
 * Maps one of `scim.ts`'s own refusal shapes onto the matching SCIM error
 * document and status.
 *
 * @param result - The failed result a `scim.ts` RPC method answered with.
 * @returns The SCIM error response for that refusal.
 */
export function scimFailure(
	result:
		| { ok: false; reason: "invalid-token" }
		| { ok: false; reason: "missing-external-id" }
		| { ok: false; reason: "missing-identifier" }
		| { ok: false; reason: "invalid-identifier" }
		| { ok: false; reason: "uniqueness-conflict" }
		| { ok: false; reason: "not-found" }
		| { ok: false; reason: "unsupported-filter" }
		| { ok: false; reason: "unsupported-operation"; index: number }
		| { ok: false; reason: "unknown-member"; subjectId: string },
): Response {
	switch (result.reason) {
		case "invalid-token":
			return scimError({
				status: 401,
				detail: "The bearer token does not authorize a connection.",
			});
		case "missing-external-id":
			return scimError({
				status: 400,
				scimType: "invalidValue",
				detail: "externalId is required.",
			});
		case "missing-identifier":
			return scimError({
				status: 400,
				scimType: "invalidValue",
				detail: "The resource named neither a primary email nor a userName.",
			});
		case "invalid-identifier":
			return scimError({
				status: 400,
				scimType: "invalidValue",
				detail: "The resource's primary email does not parse as an address.",
			});
		case "uniqueness-conflict":
			return scimError({
				status: 409,
				scimType: "uniqueness",
				detail: "Another resource already claims this identifier.",
			});
		case "not-found":
			return scimError({ status: 404, detail: "No resource matches the given id." });
		case "unsupported-filter":
			return scimError({
				status: 400,
				scimType: "invalidFilter",
				detail: "filter supports only eq on the attributes this connection serves.",
			});
		case "unsupported-operation":
			return scimError({
				status: 400,
				scimType: "invalidPath",
				detail: `Operation ${result.index} is not one of the supported PATCH forms.`,
			});
		case "unknown-member":
			return scimError({
				status: 400,
				scimType: "invalidValue",
				detail: `${result.subjectId} does not name an existing user.`,
			});
	}
}

/** Drops every `null`/`undefined` entry from a plain object, so an absent field is omitted rather than serialized as `null`. */
function withoutEmpty<T extends Record<string, unknown>>(value: T): Partial<T> {
	let entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined);
	return Object.fromEntries(entries) as Partial<T>;
}

/**
 * Maps a subject's internal SCIM representation onto the `urn:...core:2.0:User`
 * wire shape, adding the enterprise extension's schema and members only when
 * this connection declared any.
 *
 * @param representation - The representation a user RPC method answered with.
 * @returns The SCIM user resource.
 */
export function userToScim(representation: ScimUserRepresentation): Record<string, unknown> {
	let schemas = [USER_SCHEMA];

	let name = withoutEmpty({
		givenName: representation.name.givenName,
		familyName: representation.name.familyName,
		formatted: representation.name.formatted,
	});

	let body: Record<string, unknown> = {
		schemas,
		id: representation.id,
		active: representation.active,
		...withoutEmpty({
			externalId: representation.externalId,
			userName: representation.userName,
			displayName: representation.displayName,
			preferredLanguage: representation.preferredLanguage,
			timezone: representation.timezone,
		}),
	};

	if (Object.keys(name).length > 0) body.name = name;
	if (representation.emails.length > 0) body.emails = representation.emails;

	if (Object.keys(representation.attributes).length > 0) {
		schemas.push(ENTERPRISE_USER_SCHEMA);
		body[ENTERPRISE_USER_SCHEMA] = representation.attributes;
	}

	return body;
}

/**
 * Maps a group's internal SCIM representation onto the `urn:...core:2.0:Group`
 * wire shape.
 *
 * @param representation - The representation a group RPC method answered with.
 * @returns The SCIM group resource.
 */
export function groupToScim(representation: ScimGroupRepresentation): Record<string, unknown> {
	return {
		schemas: [GROUP_SCHEMA],
		id: representation.id,
		displayName: representation.displayName,
		...withoutEmpty({ externalId: representation.externalId }),
		members: representation.members.map((subjectId) => ({ value: subjectId })),
	};
}

export interface ScimPage<Representation> {
	representations: Representation[];
	totalResults: number;
	startIndex: number;
}

/**
 * Wraps a page of representations in the `ListResponse` envelope, mapping
 * each one through `toScim`.
 *
 * @param page - The page a `*ReadPage` RPC method answered with.
 * @param toScim - The per-representation wire mapper (`userToScim` or
 * `groupToScim`).
 * @returns The SCIM `ListResponse`.
 */
export function scimListResponse<Representation>(
	page: ScimPage<Representation>,
	toScim: (representation: Representation) => Record<string, unknown>,
): Record<string, unknown> {
	return {
		schemas: [LIST_SCHEMA],
		totalResults: page.totalResults,
		startIndex: page.startIndex,
		itemsPerPage: page.representations.length,
		Resources: page.representations.map(toScim),
	};
}
