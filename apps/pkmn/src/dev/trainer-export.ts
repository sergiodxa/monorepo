/**
 * Trainer export: a pure payload shaper plus a server-side write handler. The
 * shaper stays free of disk and network concerns so the mapping is unit-testable,
 * and one conservative id pattern keeps every derived path a single safe segment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { failure, isFailure, type Result, success } from "@pkg/result";

import type { TrainerDefinition } from "~/content/trainers";

import { parseTrainer } from "~/content/trainers";

import { writeExportFile } from "./export";
import { validateWritePath } from "./path-safety";

/**
 * Absolute path of the app root (the directory containing `src/`). Every export
 * write is resolved against this so a validated relative path can never point
 * outside the app even if the process cwd changes.
 */
export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Directory (under the app root) trainer JSON files are written into. */
export const TRAINER_CONTENT_DIR = "src/content/trainers";

/**
 * Allowed shape for a trainer id: a lowercase slug of letters, digits, and inner
 * hyphens. Stricter than the path-safety guard, so a bad id fails with a clear
 * message before any path work and the filename stays one safe segment.
 */
export const TRAINER_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Maximum trainer id length, keeping the derived filename reasonable. */
export const MAX_TRAINER_ID_LENGTH = 64;

/** The shaped destination and body for a trainer export. */
export interface TrainerExportPayload {
	/** Relative write path under the app root, e.g. `src/content/trainers/rival.json`. */
	path: string;
	/** Pretty-printed JSON body (tab-indented, trailing newline) to write. */
	contents: string;
}

/** Successful trainer export: what was written and where. */
export interface TrainerExportResult {
	/** The validated relative path the JSON was written to. */
	path: string;
	absolutePath: string;
	bytesWritten: number;
}

/** Error describing why a trainer id was rejected before any path work. */
export class TrainerIdError extends Error {
	/**
	 * @param message Human-readable reason the id is invalid.
	 */
	constructor(message: string) {
		super(message);
		this.name = "TrainerIdError";
	}
}

/**
 * Validates the trimmed id against {@link TRAINER_ID_PATTERN} so the derived path
 * is one safe segment under {@link TRAINER_CONTENT_DIR}, then serializes with that
 * same trimmed id so filename and contents agree.
 *
 * @param definition The validated trainer definition to write.
 * @returns Success with a {@link TrainerExportPayload}, or failure with a
 *   {@link TrainerIdError}.
 */
export function shapeTrainerExport(
	definition: TrainerDefinition,
): Result<TrainerExportPayload, TrainerIdError> {
	let id = definition.id.trim();
	if (id.length === 0) return failure(new TrainerIdError("Trainer id is required."));
	if (id.length > MAX_TRAINER_ID_LENGTH) {
		return failure(
			new TrainerIdError(`Trainer id must be at most ${MAX_TRAINER_ID_LENGTH} characters.`),
		);
	}
	if (!TRAINER_ID_PATTERN.test(id)) {
		return failure(
			new TrainerIdError(
				"Trainer id must be a lowercase slug: letters, digits, and single hyphens (no leading or trailing hyphen), 1–64 characters.",
			),
		);
	}

	let contents = `${JSON.stringify({ ...definition, id }, null, "\t")}\n`;
	return success({ path: `${TRAINER_CONTENT_DIR}/${id}.json`, contents });
}

/**
 * Validates an untrusted payload with {@link parseTrainer}, shapes it, and
 * re-checks the destination with {@link validateWritePath} before writing. The
 * path resolves against {@link APP_ROOT}, keeping every write inside the app.
 *
 * @param payload The parsed JSON body from the export request (untrusted).
 * @returns Success with a {@link TrainerExportResult}, or failure with a
 *   validation, id, or path-safety error.
 */
export async function runTrainerExport(
	payload: unknown,
): Promise<Result<TrainerExportResult, Error>> {
	let definition = parseTrainer(payload);
	if (isFailure(definition)) return failure(definition.error);

	let shaped = shapeTrainerExport(definition.data);
	if (isFailure(shaped)) return failure(shaped.error);

	let safePath = validateWritePath(shaped.data.path);
	if (isFailure(safePath)) return failure(safePath.error);

	let absolutePath = resolve(APP_ROOT, safePath.data);
	let bytesWritten = writeExportFile(absolutePath, shaped.data.contents);

	return success({ path: safePath.data, absolutePath, bytesWritten });
}
