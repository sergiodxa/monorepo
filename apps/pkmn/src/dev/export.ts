/**
 * Server-side export logic for the dev tools. It validates an export payload
 * with `remix/data-schema`, re-checks the target through the pure path-safety
 * guard, and writes the file with `Bun.write` scoped to the app root. Editors
 * post here to persist authored content into `src/content` / `src/assets`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resolve } from "node:path";

import { failure, isFailure, type Result, success } from "@pkg/result";
import { object, parseSafe, string } from "remix/data-schema";

import { validateWritePath } from "./path-safety";

/**
 * Absolute path of the app root (the directory containing `src/`). Every export
 * write is resolved against this so a validated relative path can never point
 * outside the app even if the process cwd changes.
 */
export const APP_ROOT = resolve(import.meta.dir, "..", "..");

/**
 * Schema for an export request body. `path` is a relative destination under the
 * allow-list and `contents` is the UTF-8 text to write. Validation happens
 * before any path or disk work so malformed payloads are rejected early.
 */
export const ExportPayloadSchema = object({
	path: string(),
	contents: string(),
});

/**
 * Successful export outcome describing what was written and where. `path` is the
 * validated relative path; `absolutePath` is the resolved on-disk location and
 * `bytesWritten` is the byte count reported by `Bun.write`.
 */
export interface ExportResult {
	path: string;
	absolutePath: string;
	bytesWritten: number;
}

/**
 * Error thrown for an invalid export payload (wrong shape or missing fields),
 * distinct from a path-safety rejection so callers can map each to its own
 * response status.
 */
export class ExportValidationError extends Error {
	/**
	 * @param message Human-readable description of the invalid payload.
	 */
	constructor(message: string) {
		super(message);
		this.name = "ExportValidationError";
	}
}

/**
 * Validates an untrusted export payload and writes it to disk under {@link APP_ROOT}.
 *
 * The value is first parsed against {@link ExportPayloadSchema}; the destination
 * is then re-validated with {@link validateWritePath} (defense in depth) before
 * the write. The relative path is resolved against {@link APP_ROOT}, never the
 * process cwd, so the write cannot escape the app.
 *
 * @param payload The parsed JSON body from the export request (untrusted).
 * @returns Success with an {@link ExportResult}, or failure with a validation or
 *   path-safety error.
 */
export async function runExport(payload: unknown): Promise<Result<ExportResult, Error>> {
	let parsed = parseSafe(ExportPayloadSchema, payload);
	if (!parsed.success) {
		let issue = parsed.issues[0];
		return failure(new ExportValidationError(issue ? issue.message : "Invalid export payload."));
	}

	let safePath = validateWritePath(parsed.value.path);
	if (isFailure(safePath)) return failure(safePath.error);

	let absolutePath = resolve(APP_ROOT, safePath.data);
	let bytesWritten = await Bun.write(absolutePath, parsed.value.contents);

	return success({ path: safePath.data, absolutePath, bytesWritten });
}
