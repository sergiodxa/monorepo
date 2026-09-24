/**
 * `Response` builders for SCIM: every body is `application/scim+json`, errors follow the
 * RFC 7644 §3.12 document with `status` as a string, and lists use the `ListResponse` envelope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Scim } from "../index.js";

import type { ScimError } from "./error.js";

import { ERROR_SCHEMA, MEDIA_TYPE } from "./constants.js";
import { listEnvelope } from "./envelope.js";

/**
 * A JSON response typed `application/scim+json`, which RFC 7644 §8.1 requires of every
 * SCIM response; the content type wins over one passed in `init`.
 *
 * @param body - The document
 * @param init - Status and extra headers
 * @returns The response
 */
export function scimResponse(body: object, init: ResponseInit = {}): Response {
	let headers = new Headers(init.headers);
	headers.set("Content-Type", MEDIA_TYPE);
	return new Response(JSON.stringify(body), { ...init, headers });
}

/**
 * The RFC 7644 §3.12 error document for an error, answered with its status.
 *
 * @param error - The refusal
 * @param init - Extra headers, such as `Retry-After` on a `429`; the status is the error's
 * @returns The response
 * @example errorResponse(new ScimError(409, "userName is taken.", { scimType: "uniqueness" }))
 */
export function errorResponse(error: ScimError, init: ResponseInit = {}): Response {
	let body = {
		schemas: [ERROR_SCHEMA],
		status: String(error.status),
		...(error.scimType ? { scimType: error.scimType } : {}),
		detail: error.message,
	};
	return scimResponse(body, { ...init, status: error.status });
}

/**
 * A `ListResponse` over one page, mapping each resource to its wire object.
 *
 * @param page - The page's resources, the total across pages, and the page's start index
 * @param toResource - Maps one resource to its wire object, where projection also belongs
 * @param init - Status and extra headers
 * @returns The response
 */
export function listResponse<Resource>(
	page: Scim.Page<Resource>,
	toResource: (resource: Resource) => object,
	init: ResponseInit = {},
): Response {
	let resources = page.resources.map(toResource);
	return scimResponse(listEnvelope(resources, page.totalResults, page.startIndex), init);
}
