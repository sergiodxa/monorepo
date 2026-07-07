/**
 * Trainer export flow: a pure payload-shaper plus a server-side write handler.
 *
 * The shaper ({@link shapeTrainerExport}) turns a validated
 * {@link TrainerDefinition} into a `{ path, contents }` pair — the relative write
 * path `src/content/trainers/<id>.json` and the pretty-printed JSON body — with
 * no disk, canvas, or network concerns, so the mapping can be unit-tested
 * directly. A single {@link TRAINER_ID_PATTERN} governs which ids are acceptable
 * (a conservative slug) so the derived path can never smuggle a traversal,
 * extension, or separator past the path-safety guard.
 *
 * The handler ({@link runTrainerExport}) validates an untrusted payload with the
 * trainer schema, shapes it, re-checks the target through the shared path-safety
 * guard (defense in depth), and writes the JSON with `Bun.write` scoped to the
 * app root. It reuses the same guard every other dev-tools export uses so no
 * write can escape the allow-list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resolve } from "node:path";

import { failure, isFailure, type Result, success } from "@pkg/result";

import type { TrainerDefinition } from "~/content/trainers";

import { parseTrainer } from "~/content/trainers";

import { validateWritePath } from "./path-safety";

/**
 * Absolute path of the app root (the directory containing `src/`). Every export
 * write is resolved against this so a validated relative path can never point
 * outside the app even if the process cwd changes.
 */
export const APP_ROOT = resolve(import.meta.dir, "..", "..");

/** Directory (under the app root) trainer JSON files are written into. */
export const TRAINER_CONTENT_DIR = "src/content/trainers";

/**
 * Allowed shape for a trainer id: a lowercase slug of letters, digits, and single
 * hyphens, no leading/trailing hyphen. Deliberately stricter than the path-safety
 * guard so an invalid id is rejected with a clear message before any path is
 * constructed and the derived filename is always a single safe segment.
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
	/** The resolved on-disk location. */
	absolutePath: string;
	/** Byte count reported by `Bun.write`. */
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
 * Validates a trainer id and shapes the export payload (write path + JSON body).
 * The id is validated against {@link TRAINER_ID_PATTERN} so the derived path is
 * always a single safe segment under {@link TRAINER_CONTENT_DIR}; the JSON body
 * is the definition serialized tab-indented with a trailing newline (matching the
 * repo's JSON style).
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

	// Serialize with the trimmed id so the file contents and filename agree.
	let contents = `${JSON.stringify({ ...definition, id }, null, "\t")}\n`;
	return success({ path: `${TRAINER_CONTENT_DIR}/${id}.json`, contents });
}

/**
 * Validates an untrusted trainer export payload and writes it to disk under
 * {@link APP_ROOT}.
 *
 * The value is first validated with {@link parseTrainer}; the definition is then
 * shaped by {@link shapeTrainerExport} and the destination re-validated with
 * {@link validateWritePath} (defense in depth) before the write. The relative
 * path is resolved against {@link APP_ROOT}, never the process cwd, so the write
 * cannot escape the app.
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
	let bytesWritten = await Bun.write(absolutePath, shaped.data.contents);

	return success({ path: safePath.data, absolutePath, bytesWritten });
}
