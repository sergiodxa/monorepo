/**
 * Map export flow: a pure payload-shaper plus a server-side write handler.
 *
 * The shaper ({@link shapeMapExport}) turns a validated {@link MapData} into a
 * `{ path, contents }` pair — the relative write path `src/content/maps/<id>.json`
 * and the pretty-printed JSON body — with no disk, canvas, or network concerns, so
 * the mapping can be unit-tested directly. A single {@link MAP_ID_PATTERN} governs
 * which ids are acceptable (a conservative slug) so the derived path can never
 * smuggle a traversal, extension, or separator past the path-safety guard.
 *
 * The handler ({@link runMapExport}) validates an untrusted payload with the map
 * loader (schema shape plus the cross-field invariants — layer lengths, tile refs),
 * shapes it, re-checks the target through the shared path-safety guard (defense in
 * depth), writes the JSON scoped to the app root, and registers
 * the map id → served URL in `src/content/manifest.json` (read/update/write,
 * tolerant of an absent or partial manifest). It reuses the same guard every other
 * dev-tools export uses so no write can escape the allow-list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { failure, isFailure, type Result, success } from "@pkg/result";

import type { MapData } from "~/presentation/render/map-schema";

import { loadMap } from "~/presentation/overworld/map-loader";

import { APP_ROOT, ExportValidationError, MANIFEST_PATH, writeExportFile } from "./export";
import { validateWritePath } from "./path-safety";

/** Directory (under the app root) map JSON files are written into. */
export const MAP_CONTENT_DIR = "src/content/maps";

/** URL prefix the game loads registered maps from (matches the manifest `maps`). */
export const MAP_URL_PREFIX = "/content/maps";

/**
 * Allowed shape for a map id: a lowercase slug of letters, digits, and single
 * hyphens, no leading/trailing hyphen. Deliberately stricter than the path-safety
 * guard so an invalid id is rejected with a clear message before any path is
 * constructed and the derived filename is always a single safe segment.
 */
export const MAP_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Maximum map id length, keeping the derived filename reasonable. */
export const MAX_MAP_ID_LENGTH = 64;

/** The shaped destination and body for a map export. */
export interface MapExportPayload {
	/** Sanitized map id (the manifest map key). */
	id: string;
	/** Relative write path under the app root, e.g. `src/content/maps/route-1.json`. */
	path: string;
	/** Served URL the manifest maps the id to, e.g. `/content/maps/route-1.json`. */
	url: string;
	/** Pretty-printed JSON body (tab-indented, trailing newline) to write. */
	contents: string;
}

/** Successful map export: what was written, where, and the registered id/url. */
export interface MapExportResult {
	/** The map id the file and manifest entry are keyed by. */
	id: string;
	/** The validated relative path the JSON was written to. */
	path: string;
	/** Served URL the manifest maps the id to. */
	url: string;
	/** The resolved on-disk location of the map JSON. */
	absolutePath: string;
	/** Byte count written for the map JSON. */
	bytesWritten: number;
}

/** Error describing why a map id was rejected before any path work. */
export class MapIdError extends Error {
	/** @param message Human-readable reason the id is invalid. */
	constructor(message: string) {
		super(message);
		this.name = "MapIdError";
	}
}

/**
 * Validates a map id and shapes the export payload (write path, served URL, JSON
 * body). The id is validated against {@link MAP_ID_PATTERN} so the derived path is
 * always a single safe segment under {@link MAP_CONTENT_DIR}; the JSON body is the
 * map serialized tab-indented with a trailing newline (matching the repo's JSON
 * style), with the trimmed id so the filename and contents agree.
 *
 * @param map The validated map to write.
 * @returns Success with a {@link MapExportPayload}, or failure with a {@link MapIdError}.
 */
export function shapeMapExport(map: MapData): Result<MapExportPayload, MapIdError> {
	let id = map.id.trim();
	if (id.length === 0) return failure(new MapIdError("Map id is required."));
	if (id.length > MAX_MAP_ID_LENGTH) {
		return failure(new MapIdError(`Map id must be at most ${MAX_MAP_ID_LENGTH} characters.`));
	}
	if (!MAP_ID_PATTERN.test(id)) {
		return failure(
			new MapIdError(
				"Map id must be a lowercase slug: letters, digits, and single hyphens (no leading or trailing hyphen), 1–64 characters.",
			),
		);
	}

	let contents = `${JSON.stringify({ ...map, id }, null, "\t")}\n`;
	return success({
		id,
		path: `${MAP_CONTENT_DIR}/${id}.json`,
		url: `${MAP_URL_PREFIX}/${id}.json`,
		contents,
	});
}

/**
 * The minimal manifest slice the map export reads and writes: only `maps` is
 * required for registering a map; other kinds are carried through untouched. Kept
 * structural (not importing the presentation type) so this module has no
 * cross-layer dependency.
 */
export interface ManifestMaps {
	maps: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Returns a copy of the manifest with the map registered under `maps`
 * (id → served URL), leaving every other entry untouched. Pure: it never mutates
 * the input, so the caller decides when to persist the result.
 *
 * @param manifest The current manifest contents.
 * @param payload The shaped export payload whose id/url is registered.
 * @returns A new manifest object with the map added under `maps`.
 */
export function registerMap(manifest: ManifestMaps, payload: MapExportPayload): ManifestMaps {
	return {
		...manifest,
		maps: { ...manifest.maps, [payload.id]: payload.url },
	};
}

/**
 * Reads the manifest from disk, tolerating an absent file (treated as an empty
 * manifest) so the first export bootstraps it, and coercing a missing `maps` map
 * to an empty object. A present-but-invalid manifest is a hard error rather than
 * being silently overwritten.
 *
 * @returns Success with the parsed manifest, or failure describing the problem.
 */
async function readManifest(): Promise<Result<ManifestMaps, ExportValidationError>> {
	let manifestFile = resolve(APP_ROOT, MANIFEST_PATH);
	if (!existsSync(manifestFile)) return success({ maps: {} });

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(manifestFile, "utf8"));
	} catch {
		return failure(new ExportValidationError("Asset manifest is not valid JSON."));
	}

	if (typeof parsed !== "object" || parsed === null) {
		return failure(new ExportValidationError("Asset manifest is not an object."));
	}

	let manifest = parsed as Record<string, unknown>;
	if (typeof manifest.maps !== "object" || manifest.maps === null) manifest.maps = {};
	return success(manifest as ManifestMaps);
}

/**
 * Validates an untrusted map export payload and writes it to disk under
 * {@link APP_ROOT}, then registers it in `src/content/manifest.json`.
 *
 * The value is first validated with {@link loadMap} (schema shape plus the loader's
 * cross-field invariants: every layer and the collision grid is exactly
 * `width * height` cells and every tile ref names a declared tileset); the map is
 * then shaped by {@link shapeMapExport} and the destination re-validated with
 * {@link validateWritePath} (defense in depth) before the write. The map JSON write
 * path is resolved against {@link APP_ROOT}, never the process cwd, so the write
 * cannot escape the app. The manifest write path is the fixed {@link MANIFEST_PATH},
 * itself re-checked by the guard. Any step failing surfaces as a failure result
 * rather than a partial export.
 *
 * @param payload The parsed JSON body from the export request (untrusted).
 * @returns Success with a {@link MapExportResult}, or failure with a validation,
 *   id, or path-safety error.
 */
export async function runMapExport(payload: unknown): Promise<Result<MapExportResult, Error>> {
	let map = loadMap(payload);
	if (isFailure(map)) return failure(map.error);

	let shaped = shapeMapExport(map.data);
	if (isFailure(shaped)) return failure(shaped.error);

	let safePath = validateWritePath(shaped.data.path);
	if (isFailure(safePath)) return failure(safePath.error);

	let absolutePath = resolve(APP_ROOT, safePath.data);
	let bytesWritten = writeExportFile(absolutePath, shaped.data.contents);

	// Register the map id → served URL in the manifest, tolerating an absent one.
	let manifest = await readManifest();
	if (isFailure(manifest)) return failure(manifest.error);

	let nextManifest = registerMap(manifest.data, shaped.data);
	let manifestPath = validateWritePath(MANIFEST_PATH);
	if (isFailure(manifestPath)) return failure(manifestPath.error);

	writeExportFile(
		resolve(APP_ROOT, manifestPath.data),
		`${JSON.stringify(nextManifest, null, "\t")}\n`,
	);

	return success({
		id: shaped.data.id,
		path: safePath.data,
		url: shaped.data.url,
		absolutePath,
		bytesWritten,
	});
}
