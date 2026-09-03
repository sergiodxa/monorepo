/**
 * Species export: a pure whole-file shaper plus the server-side write handler.
 * The roster lives in a single `src/content/species.json` map, so an export
 * replaces one entry inside the whole file; the shaper works from its input
 * alone so the mapping is unit-testable, and the handler re-checks the fixed
 * write path through the path-safety guard and resolves it against the app root.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { failure, isFailure, type Result, success } from "@sdxc/result";

import type { Species, SpeciesId } from "~/game/data/species";

import { parseSpecies } from "~/content/species-schema";

import { writeExportFile } from "./export";
import { validateWritePath } from "./path-safety";
import {
	MAX_SPECIES_ID_LENGTH,
	SPECIES_ID_PATTERN,
	SpeciesIdError,
	validateSpeciesId,
} from "./species-id";

/**
 * Absolute path of the app root (the directory containing `src/`). Every export
 * write is resolved against this so the validated relative path can never point
 * outside the app even if the process cwd changes.
 */
export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Relative path (under the app root) of the single species data file. */
export const SPECIES_CONTENT_PATH = "src/content/species.json";

/**
 * Re-exported from the browser-safe id module so importers of this server module
 * keep a single entry point while the editor view imports the rules directly.
 */
export { MAX_SPECIES_ID_LENGTH, SPECIES_ID_PATTERN, SpeciesIdError, validateSpeciesId };

/** The shaped destination and body for a species export. */
export interface SpeciesExportPayload {
	/** Relative write path under the app root ({@link SPECIES_CONTENT_PATH}). */
	path: string;
	/** Pretty-printed JSON body (tab-indented, trailing newline) for the whole file. */
	contents: string;
}

/** Successful species export: what was written and where. */
export interface SpeciesExportResult {
	/** The validated relative path the JSON was written to. */
	path: string;
	absolutePath: string;
	/** The species id whose entry was replaced. */
	id: string;
	bytesWritten: number;
}

/**
 * Replaces one entry in the whole species map and shapes the updated
 * `species.json` contents, serialized tab-indented with a trailing newline to
 * match the repo's JSON style. Every other entry is preserved unchanged.
 *
 * @param currentIndex The current parsed `species.json` map (all existing species).
 * @param rawId The species id to write the record under.
 * @param species The validated species record to store.
 * @returns Success with a {@link SpeciesExportPayload}, or failure with a
 *   {@link SpeciesIdError}.
 */
export function shapeSpeciesExport(
	currentIndex: Record<SpeciesId, Species>,
	rawId: string,
	species: Species,
): Result<SpeciesExportPayload, SpeciesIdError> {
	let validated = validateSpeciesId(rawId);
	if (isFailure(validated)) return failure(validated.error);

	let next: Record<SpeciesId, Species> = { ...currentIndex, [validated.data]: species };
	let contents = `${JSON.stringify(next, null, "\t")}\n`;
	return success({ path: SPECIES_CONTENT_PATH, contents });
}

/** The untrusted payload the export action receives. */
export interface SpeciesExportRequest {
	/** The species id whose `species.json` entry to replace. */
	id: string;
	/** The species record to store (validated with the species schema). */
	species: unknown;
}

/**
 * Validates an untrusted species export payload and writes the updated
 * `species.json` under {@link APP_ROOT}: the id, the record, the current
 * on-disk file, and the write path are all checked before anything is written.
 *
 * @param payload The parsed JSON body from the export request (untrusted).
 * @returns Success with a {@link SpeciesExportResult}, or failure with a
 *   validation, id, or path-safety error.
 */
export async function runSpeciesExport(
	payload: unknown,
): Promise<Result<SpeciesExportResult, Error>> {
	if (typeof payload !== "object" || payload === null) {
		return failure(new SpeciesIdError("Species export payload must be an object."));
	}

	let request = payload as Partial<SpeciesExportRequest>;
	if (typeof request.id !== "string") {
		return failure(new SpeciesIdError("Species export payload must include an id string."));
	}

	let validatedId = validateSpeciesId(request.id);
	if (isFailure(validatedId)) return failure(validatedId.error);
	let id = validatedId.data;

	let species: Species;
	try {
		species = parseSpecies({ [id]: request.species })[id]!;
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}

	let absolutePath = resolve(APP_ROOT, SPECIES_CONTENT_PATH);
	let currentIndex: Record<SpeciesId, Species>;
	try {
		let current = JSON.parse(readFileSync(absolutePath, "utf8"));
		currentIndex = parseSpecies(current);
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}

	let shaped = shapeSpeciesExport(currentIndex, id, species);
	if (isFailure(shaped)) return failure(shaped.error);

	let safePath = validateWritePath(shaped.data.path);
	if (isFailure(safePath)) return failure(safePath.error);

	let bytesWritten = writeExportFile(resolve(APP_ROOT, safePath.data), shaped.data.contents);

	return success({
		path: safePath.data,
		absolutePath,
		id,
		bytesWritten,
	});
}
