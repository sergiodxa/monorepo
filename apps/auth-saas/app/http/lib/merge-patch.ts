/**
 * Reads a management `PATCH` body as an RFC 7396 merge patch and applies it to the
 * resource's writable projection, validating the patched result with the resource's
 * own schema, so one schema's limits govern both create and update.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/merge-patch";
import type { Schema } from "remix/data-schema";

import { applyValidated, diff } from "@sdxc/merge-patch";
import { mergePatchProblem, readMergePatch } from "@sdxc/merge-patch/request";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";

import type { ParsedBody } from "~/app/http/lib/parse-body";

import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";

/** The patched resource and the smallest patch between it and the current one, or the refusal. */
export type PatchedResource<Output> =
	| { ok: true; next: Output; changes: JSONValue }
	| { ok: false; response: Response };

/**
 * Reads the merge patch, applies it to `current`, and validates the result. The body is
 * accepted as `application/merge-patch+json` and, for callers written before that media
 * type was advertised, `application/json`; any other type is a `415` naming the patch type.
 *
 * @param request - The `PATCH` request, its body unread.
 * @param current - The resource's writable projection, holding no `null` members.
 * @param schema - The schema the patched resource must satisfy.
 * @returns The validated result and `changes`, the merge patch from `current` to it (a
 * removed member is `null`), or the `problem+json` refusal.
 * @example
 * let patched = await patchResource(ctx.request, writableClient(record), ClientBodySchema);
 * if (!patched.ok) return patched.response;
 */
export async function patchResource<Output>(
	request: Request,
	current: JSONValue,
	schema: Schema<unknown, Output>,
): Promise<PatchedResource<Output>> {
	let patch = await readMergePatch(request, { alsoAccept: ["application/json"] });
	if (isFailure(patch)) return { ok: false, response: mergePatchProblem(patch.error) };

	let next = applyValidated(current, patch.data, schema);
	if (isFailure(next)) {
		return {
			ok: false,
			response: managementProblem("validationFailed", {
				detail: "The patched resource did not pass validation.",
				extensions: { errors: issuesFrom(next.error) },
			}),
		};
	}

	let changes = diff(current, next.data as JSONValue);
	if (isFailure(changes)) {
		return {
			ok: false,
			response: managementProblem("validationFailed", {
				detail: "The patched resource holds a null a merge patch cannot write.",
				extensions: {
					errors: [
						{ pointer: changes.error.pointer, code: "invalid", message: changes.error.message },
					],
				},
			}),
		};
	}

	return { ok: true, next: next.data, changes: changes.data };
}

/**
 * Reads a `PATCH` body whose every accepted form is already a valid merge patch — a
 * one-field rename, a role's own members — and validates the patch itself, for a route
 * whose store writes the named members directly.
 *
 * @param request - The `PATCH` request, its body unread.
 * @param schema - The schema the patch document must satisfy.
 * @returns The parsed patch, or the `415`, `400` JSON or validation refusal.
 * @example
 * let parsed = await readPatchBody(ctx.request, RenamePasskeyBodySchema);
 * if (!parsed.ok) return parsed.response;
 */
export async function readPatchBody<Output>(
	request: Request,
	schema: Schema<unknown, Output>,
): Promise<ParsedBody<Output>> {
	let patch = await readMergePatch(request, { alsoAccept: ["application/json"] });
	if (isFailure(patch)) return { ok: false, response: mergePatchProblem(patch.error) };
	return parseBody(schema, patch.data);
}
