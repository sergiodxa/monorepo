/**
 * The tenant's side of a SCIM response: which error document each refusal a SCIM RPC
 * method answers with becomes, and the wire User and Group with their `meta.location`
 * resolved against the request, since the tenant object never sees a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { errorResponse, ScimError } from "@sdxc/scim";

import type { ScimFilterRefusal, ScimPatchRefusal } from "~/database/scim";
import type { ScimGroupRepresentation, ScimUserRepresentation } from "~/database/scim-resources";

import { groupWire, userWire } from "~/database/scim-resources";
import routes from "~/routes/tenant";

/**
 * Maps one of `scim.ts`'s own refusal shapes onto the matching SCIM error document and
 * status.
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
		| { ok: false; reason: "unsupported-operation"; index: number }
		| { ok: false; reason: "unknown-member"; subjectId: string }
		| ScimFilterRefusal
		| ScimPatchRefusal,
): Response {
	switch (result.reason) {
		case "invalid-token":
			return errorResponse(new ScimError(401, "The bearer token does not authorize a connection."));
		case "missing-external-id":
			return errorResponse(
				new ScimError(400, "externalId is required.", { scimType: "invalidValue" }),
			);
		case "missing-identifier":
			return errorResponse(
				new ScimError(400, "The resource named neither a primary email nor a userName.", {
					scimType: "invalidValue",
				}),
			);
		case "invalid-identifier":
			return errorResponse(
				new ScimError(400, "The resource's primary email does not parse as an address.", {
					scimType: "invalidValue",
				}),
			);
		case "uniqueness-conflict":
			return errorResponse(
				new ScimError(409, "Another resource already claims this identifier.", {
					scimType: "uniqueness",
				}),
			);
		case "not-found":
			return errorResponse(new ScimError(404, "No resource matches the given id."));
		case "unsupported-filter":
			return errorResponse(new ScimError(400, result.detail, { scimType: "invalidFilter" }));
		case "unsupported-operation":
			return errorResponse(
				new ScimError(400, `Operation ${result.index} is not one of the supported PATCH forms.`, {
					scimType: "invalidPath",
				}),
			);
		case "invalid-patch":
			return errorResponse(
				new ScimError(result.status, result.detail, { scimType: result.scimType ?? undefined }),
			);
		case "unknown-member":
			return errorResponse(
				new ScimError(400, `${result.subjectId} does not name an existing user.`, {
					scimType: "invalidValue",
				}),
			);
	}
}

/**
 * The wire User a response carries, with `meta` locating it under the request's origin.
 *
 * @param representation - The representation a user RPC method answered with.
 * @param url - The request's URL, whose origin the resource lives under.
 * @returns The SCIM user resource.
 */
export function userToScim(
	representation: ScimUserRepresentation,
	url: URL,
): Record<string, unknown> {
	let location = new URL(routes.scimUsersRead.href({ id: representation.id }), url);
	return userWire(representation, location.href);
}

/**
 * The wire Group a response carries, with `meta` locating it under the request's origin.
 *
 * @param representation - The representation a group RPC method answered with.
 * @param url - The request's URL, whose origin the resource lives under.
 * @returns The SCIM group resource.
 */
export function groupToScim(
	representation: ScimGroupRepresentation,
	url: URL,
): Record<string, unknown> {
	let location = new URL(routes.scimGroupsRead.href({ id: representation.id }), url);
	return groupWire(representation, location.href);
}
