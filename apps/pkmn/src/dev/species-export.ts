/**
 * Species export flow: a pure whole-file shaper plus a server-side write handler.
 *
 * The species roster lives in a SINGLE `src/content/species.json` map, so an
 * export replaces one entry inside the whole file rather than writing a
 * per-species file. The shaper ({@link shapeSpeciesExport}) is pure: given the
 * current parsed index, an id, and a validated species record, it returns the
 * full updated `species.json` contents (the current map with that one entry
 * replaced, re-serialized tab-indented with a trailing newline) with no disk,
 * canvas, or network concerns, so the mapping can be unit-tested directly. A
 * single {@link SPECIES_ID_PATTERN} governs which ids are acceptable so a bad id
 * is rejected before any write.
 *
 * The handler ({@link runSpeciesExport}) validates the incoming id and species
 * with the species schema, reads and validates the current `species.json`, shapes
 * the updated contents, re-checks the fixed write path through the shared
 * path-safety guard (defense in depth), and writes with `Bun.write` scoped to the
 * app root. It reuses the same guard every other dev-tools export uses so no write
 * can escape the allow-list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resolve } from "node:path";

import { failure, isFailure, type Result, success } from "@pkg/result";

import type { Species, SpeciesId } from "~/game/data/species";

import { parseSpecies } from "~/content/species-schema";

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
export const APP_ROOT = resolve(import.meta.dir, "..", "..");

/** Relative path (under the app root) of the single species data file. */
export const SPECIES_CONTENT_PATH = "src/content/species.json";

// Re-exported from ./species-id (browser-safe) so existing importers of this
// server module keep working while the editor view imports the rules directly.
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
	/** The resolved on-disk location. */
	absolutePath: string;
	/** The species id whose entry was replaced. */
	id: string;
	/** Byte count reported by `Bun.write`. */
	bytesWritten: number;
}

/**
 * Replaces one entry in the whole species map and shapes the updated
 * `species.json` contents.
 *
 * Pure and disk-free: the caller supplies the current parsed index, the id to
 * write under, and the species record. The id is validated so a bad key never
 * reaches the file; the returned contents are the current map with that one entry
 * set to `species`, serialized tab-indented with a trailing newline (matching the
 * repo's JSON style). All other entries are preserved unchanged.
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
 * `species.json` to disk under {@link APP_ROOT}.
 *
 * The id is validated first, then the species record with the species schema;
 * the current on-disk `species.json` is read and validated with
 * {@link parseSpecies} so a corrupt file fails before any write. The updated
 * contents are shaped by {@link shapeSpeciesExport}, the fixed write path is
 * re-validated with {@link validateWritePath} (defense in depth), and the file is
 * written. The relative path is resolved against {@link APP_ROOT}, never the
 * process cwd, so the write cannot escape the app.
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

	// Validate the incoming record against the species schema (throws on malformed).
	let species: Species;
	try {
		species = parseSpecies({ [id]: request.species })[id]!;
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}

	// Read and validate the current whole file so a corrupt file fails before writing.
	let absolutePath = resolve(APP_ROOT, SPECIES_CONTENT_PATH);
	let currentIndex: Record<SpeciesId, Species>;
	try {
		let current = await Bun.file(absolutePath).json();
		currentIndex = parseSpecies(current);
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}

	let shaped = shapeSpeciesExport(currentIndex, id, species);
	if (isFailure(shaped)) return failure(shaped.error);

	let safePath = validateWritePath(shaped.data.path);
	if (isFailure(safePath)) return failure(safePath.error);

	let bytesWritten = await Bun.write(resolve(APP_ROOT, safePath.data), shaped.data.contents);

	return success({
		path: safePath.data,
		absolutePath,
		id,
		bytesWritten,
	});
}
