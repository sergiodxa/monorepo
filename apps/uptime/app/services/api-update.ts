/**
 * Reads an API update as an RFC 7396 JSON Merge Patch: the patch is applied to the
 * resource's writable members and the result validated with the resource's own schema,
 * so create and update share one set of limits and `null` removes a member everywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONObject, JSONValue } from "@sdxc/merge-patch";

import { apply, applyValidated, diff } from "@sdxc/merge-patch";
import { ACCEPT_PATCH_HEADER, readMergePatch } from "@sdxc/merge-patch/request";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";

import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";

/** A validated update: the resource after the patch, and the members the patch changed. */
export interface ApiUpdate<Output> {
	value: Output;
	/** Top-level members whose value differs from the resource before the patch. */
	changed: ReadonlySet<string>;
}

/**
 * The resource's writable members as a merge patch target. A `null` or absent member is
 * left out, which is how a merge patch represents an unset member.
 *
 * @param current - The members as the API serializes them.
 */
function toTarget(current: Record<string, JSONValue | undefined>): JSONObject {
	let target: JSONObject = {};
	for (let [key, value] of Object.entries(current)) {
		if (value !== null && value !== undefined) target[key] = value;
	}
	return target;
}

/**
 * Reads the request's body as a merge patch document, `application/json` included, so
 * integrations that already send JSON keep working against `PATCH`.
 *
 * @param request - The request, with its body unread.
 * @returns The patch, or the problem response to answer with: `415 unsupported-media-type`
 *   (with `Accept-Patch`) or `400 validation-error` for a body that is not JSON.
 */
async function readApiPatch(request: Request): Promise<JSONValue | Response> {
	let patch = await readMergePatch(request, { alsoAccept: ["application/json"] });
	if (!isFailure(patch)) return patch.data;
	if (patch.error.reason === "invalid-json") return invalidField("Invalid JSON in request body");
	return apiProblems.unsupportedMediaType(
		{ detail: patch.error.message, instance: problemInstance() },
		{ headers: [[...ACCEPT_PATCH_HEADER]] },
	);
}

/**
 * Reads a `PATCH` body as a merge patch over `current` and validates the result with
 * `schema`; `application/json` bodies are read the same way. A `null` member is removed,
 * which clears a nullable member and gives a defaulted one its default.
 *
 * @param request - The update request, with its body unread.
 * @param current - The resource's writable members, in the shape `schema` reads.
 * @param schema - The schema a whole resource must satisfy, usually the create body's.
 * @returns The update, or the problem response to answer with: `415 unsupported-media-type`
 *   (with `Accept-Patch`) or `400 validation-error`.
 * @example
 * let update = await readApiUpdate(ctx.request, writableMonitor(row), WRITABLE_MONITOR);
 * if (update instanceof Response) return update;
 */
export async function readApiUpdate<Output>(
	request: Request,
	current: Record<string, JSONValue | undefined>,
	schema: Parameters<typeof applyValidated<Output>>[2],
): Promise<ApiUpdate<Output> | Response> {
	let patch = await readApiPatch(request);
	if (patch instanceof Response) return patch;

	let target = toTarget(current);
	let result = applyValidated(target, patch, schema);
	if (isFailure(result)) {
		return apiProblems.validationError({
			instance: problemInstance(),
			extensions: { errors: issuesFrom(result.error.issues) },
		});
	}

	let patched = apply(target, patch);
	let changes = diff(target, patched);
	let changed = new Set(
		isFailure(changes) || typeof changes.data !== "object" || changes.data === null
			? Object.keys(target)
			: Object.keys(changes.data),
	);
	return { value: result.data, changed };
}
