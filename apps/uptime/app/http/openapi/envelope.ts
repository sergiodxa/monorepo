/**
 * The success envelope `apiSuccess()` and `apiPage()` answer with, as schemas an operation
 * declares its responses with, so the documented `data`/`meta` shape and the `Link` header
 * a page carries are written once for every endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ResponseSpec } from "@sdxc/openapi";

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as coerce from "@sdxc/json-schema/coerce";

/** The `meta` every success carries; `requestId` identifies the one response. */
const META = {
	requestId: s.string().meta({ format: "uuid" }),
	timestamp: s.string().meta({ format: "date-time" }),
};

/** Where a page sits among its neighbours; `total` appears on the collections only. */
const PAGINATION = s
	.object({
		next: s.nullable(s.string()).meta({ description: "Cursor of the following page" }),
		prev: s.nullable(s.string()).meta({ description: "Cursor of the preceding page" }),
		perPage: s.integer(),
		total: s.optional(s.integer()),
	})
	.meta({ id: "Pagination" });

/**
 * A success body wrapping `data`, as `apiSuccess()` writes it.
 *
 * @param data The shape of `data`.
 * @example envelope({ monitor: MONITOR })
 */
export function envelope<Shape extends Record<string, s.DescribedSchema>>(data: Shape) {
	return s.object({ data: s.object(data), meta: s.object(META) });
}

/**
 * A page body, as `apiPage()` writes it: `meta.pagination` beside the envelope.
 *
 * @param data The shape of `data`.
 * @example pageEnvelope({ monitors: s.array(MONITOR) })
 */
export function pageEnvelope<Shape extends Record<string, s.DescribedSchema>>(data: Shape) {
	return s.object({
		data: s.object(data),
		meta: s.object({ ...META, pagination: PAGINATION }),
	});
}

/**
 * The response a paginated list answers with: the page body and the RFC 8288 `Link`
 * header naming the neighbouring pages, present whenever there is one.
 *
 * @param description What the page lists.
 * @param data The shape of `data`.
 */
export function pageResponse<Shape extends Record<string, s.DescribedSchema>>(
	description: string,
	data: Shape,
): ResponseSpec {
	return {
		description,
		body: pageEnvelope(data),
		headers: {
			Link: {
				schema: s.string(),
				description: "`next` and `prev` page URLs (RFC 8288), when those pages exist",
			},
		},
	};
}

/**
 * The query every paginated list reads, as `PAGING` in `app/services/pagination.ts`
 * parses it. `perPage` arrives as text, so it documents both forms a query string holds.
 */
export const PAGE_QUERY = s.object({
	perPage: s.optional(
		coerce
			.number()
			.pipe(checks.min(1), checks.max(200))
			.meta({ description: "Results per page (default 50)" }),
	),
	cursor: s.optional(s.string().meta({ description: "Page to fetch, from a `Link` header" })),
});
