/**
 * Client-safe species-id rules shared by the species editor view and the
 * server-side export handler. Pure and filesystem-free so the browser bundle
 * can import them without pulling in the server-only export module, which
 * resolves paths at load time and would crash in the browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, success, type Result } from "@sdxc/result";

/**
 * Allowed shape for a species id: uppercase letters, digits, and single
 * underscores (e.g. `PIKACHU`, `NIDORAN_F`), no leading/trailing underscore.
 * Matches the authored roster's id convention and keeps the JSON key safe.
 */
export const SPECIES_ID_PATTERN = /^[A-Z0-9](?:[A-Z0-9_]*[A-Z0-9])?$/;

/** Maximum species id length, keeping the JSON key reasonable. */
export const MAX_SPECIES_ID_LENGTH = 64;

/** Error describing why a species id was rejected before any file work. */
export class SpeciesIdError extends Error {
	/**
	 * @param message Human-readable reason the id is invalid.
	 */
	constructor(message: string) {
		super(message);
		this.name = "SpeciesIdError";
	}
}

/**
 * Validates a species id against {@link SPECIES_ID_PATTERN}.
 *
 * @param rawId The candidate id (trimmed before checking).
 * @returns Success with the trimmed id, or failure with a {@link SpeciesIdError}.
 */
export function validateSpeciesId(rawId: string): Result<string, SpeciesIdError> {
	let id = rawId.trim();
	if (id.length === 0) return failure(new SpeciesIdError("Species id is required."));
	if (id.length > MAX_SPECIES_ID_LENGTH) {
		return failure(
			new SpeciesIdError(`Species id must be at most ${MAX_SPECIES_ID_LENGTH} characters.`),
		);
	}
	if (!SPECIES_ID_PATTERN.test(id)) {
		return failure(
			new SpeciesIdError(
				"Species id must be uppercase letters, digits, and single underscores (no leading or trailing underscore), 1–64 characters.",
			),
		);
	}
	return success(id);
}
