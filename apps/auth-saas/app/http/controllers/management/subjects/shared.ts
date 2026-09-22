/**
 * What every single-subject route in this directory shares: reading the
 * `:subjectId` path param, and the `problem+json` response for a subject the
 * tenant does not hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import { problem } from "~/app/http/lib/problem";

/** Parses and requires the `:subjectId` path param every single-subject route matches. */
export function subjectIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ subjectId: s.string() }), ctx.params).subjectId;
}

/** A subject the tenant does not hold, for a route naming one in its path. */
export function subjectNotFound(): Response {
	return problem({
		type: "https://docs.example.com/errors/not-found",
		title: "No such subject exists",
		status: 404,
	});
}

/** Parses and requires the `:runId` path param every import-run route matches. */
export function importRunIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ runId: s.string() }), ctx.params).runId;
}

/** An import run the caller's own tenant does not hold, for a route naming one in its path. */
export function importRunNotFound(): Response {
	return problem({
		type: "https://docs.example.com/errors/not-found",
		title: "No such import run exists for this tenant",
		status: 404,
	});
}

/** Parses and requires the `:runId` path param every export-run route matches. */
export function exportRunIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ runId: s.string() }), ctx.params).runId;
}

/** An export run the caller's own tenant does not hold, for a route naming one in its path. */
export function exportRunNotFound(): Response {
	return problem({
		type: "https://docs.example.com/errors/not-found",
		title: "No such export run exists for this tenant",
		status: 404,
	});
}
