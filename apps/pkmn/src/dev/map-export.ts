/**
 * Map export: shapes a validated map into a `{ path, contents }` pair under
 * `src/content/maps`, writes it, and registers its id → served URL in
 * `src/content/manifest.json`. A conservative id slug keeps the derived path a
 * single safe segment, and the path-safety guard re-checks every write target.
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
 * hyphens. Stricter than the path-safety guard so an invalid id is rejected with a
 * clear message and the derived filename is always a single safe segment.
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
 * Validates a map id against {@link MAP_ID_PATTERN} and shapes the export payload,
 * so the derived path is always a single safe segment under {@link MAP_CONTENT_DIR}
 * and the body carries the trimmed id, keeping filename and contents in agreement.
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
 * The minimal manifest slice the map export reads and writes: `maps` is required
 * for registering a map, and every other kind carries through untouched. The shape
 * is structural, keeping this module independent of the presentation layer.
 */
export interface ManifestMaps {
	maps: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Returns a copy of the manifest with the map registered under `maps`
 * (id → served URL), leaving every other entry untouched. Pure: the input stays as
 * it was, so the caller decides when to persist the result.
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
 * Reads the manifest from disk, treating an absent file as empty so the first
 * export bootstraps it and coercing a missing `maps` to an empty object. A present
 * but invalid manifest fails hard, preserving whatever is already on disk.
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
 * Validates an untrusted map export payload with {@link loadMap}, writes it
 * under {@link APP_ROOT}, and registers it in `src/content/manifest.json`,
 * with every write target checked by {@link validateWritePath}.
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
