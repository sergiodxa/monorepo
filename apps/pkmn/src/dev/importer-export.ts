/**
 * Importer export for the dev tools: takes an existing PNG plus a set of
 * pre-computed regions and registers it in `src/content/manifest.json` as an
 * image URL plus EVERY region at once, so the game can blit any tile by name.
 * The pure half ({@link deriveImporterTarget} + {@link registerAtlas}) shapes the
 * manifest mutation off-disk, so the mapping stays unit-testable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { failure, isFailure, type Result, success } from "@sdxc/result";

import type { Rect } from "~/presentation/render/atlas";

import {
	type AtlasRect,
	AtlasExportError,
	ATLAS_NAME_PATTERN,
	MAX_ATLAS_NAME_LENGTH,
	type ManifestAtlases,
	registerAtlasRegion,
} from "./atlas-export";
import {
	APP_ROOT,
	ExportValidationError,
	MANIFEST_PATH,
	runBinaryExport,
	writeExportFile,
} from "./export";
import { validateWritePath } from "./path-safety";
import { deriveSpriteTarget, type SpriteExportTarget, SpriteNameError } from "./sprite-export";

/** The validated destination for importing a PNG as a full named atlas. */
export interface ImporterExportTarget {
	/** The underlying image export target (name/id, write path, served URL). */
	image: SpriteExportTarget;
	/** Validated atlas id (equals the image id). */
	atlasId: string;
	/** Validated region map (name → source rect), at least one entry. */
	regions: Record<string, AtlasRect>;
}

/**
 * Validates one region name against {@link ATLAS_NAME_PATTERN} (the same slug
 * rule atlas region keys use). Trims first so a padded name is accepted.
 *
 * @param raw The untrusted region name.
 * @returns Success with the trimmed name, or failure with an {@link AtlasExportError}.
 */
function validateRegionName(raw: string): Result<string, AtlasExportError> {
	let value = raw.trim();
	if (value.length === 0) return failure(new AtlasExportError("Region name is required."));
	if (value.length > MAX_ATLAS_NAME_LENGTH) {
		return failure(
			new AtlasExportError(`Region name must be at most ${MAX_ATLAS_NAME_LENGTH} characters.`),
		);
	}
	if (!ATLAS_NAME_PATTERN.test(value)) {
		return failure(
			new AtlasExportError(
				`Region name ${JSON.stringify(value)} must be a lowercase slug of letters, digits, and single hyphens, optionally dotted (e.g. "tile.0").`,
			),
		);
	}
	return success(value);
}

/**
 * Validates one region rect: every field a non-negative integer and both
 * dimensions positive, so every region keeps a whole, positive-sized rect.
 *
 * @param name The region name, echoed into any error message.
 * @param rect The candidate rect.
 * @returns Success with the rect, or failure with an {@link AtlasExportError}.
 */
function validateRect(name: string, rect: Rect): Result<AtlasRect, AtlasExportError> {
	let fields: Array<[label: string, value: number, positive: boolean]> = [
		["x", rect.x, false],
		["y", rect.y, false],
		["w", rect.w, true],
		["h", rect.h, true],
	];
	for (let [label, value, positive] of fields) {
		if (!Number.isInteger(value) || value < 0) {
			return failure(
				new AtlasExportError(
					`Region ${JSON.stringify(name)} ${label} must be a non-negative integer.`,
				),
			);
		}
		if (positive && value < 1) {
			return failure(
				new AtlasExportError(`Region ${JSON.stringify(name)} ${label} must be at least 1.`),
			);
		}
	}
	return success({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
}

/**
 * Validates the atlas id against {@link ATLAS_NAME_PATTERN}. The id doubles as the
 * image name, so it must also satisfy the sprite-name shaping applied later.
 *
 * @param raw The untrusted atlas id.
 * @returns Success with the trimmed id, or failure with an {@link AtlasExportError}.
 */
function validateAtlasId(raw: string): Result<string, AtlasExportError> {
	let value = raw.trim();
	if (value.length === 0) return failure(new AtlasExportError("Atlas id is required."));
	if (value.length > MAX_ATLAS_NAME_LENGTH) {
		return failure(
			new AtlasExportError(`Atlas id must be at most ${MAX_ATLAS_NAME_LENGTH} characters.`),
		);
	}
	if (!ATLAS_NAME_PATTERN.test(value)) {
		return failure(
			new AtlasExportError(
				'Atlas id must be a lowercase slug of letters, digits, and single hyphens, optionally dotted (e.g. "world.tiles").',
			),
		);
	}
	return success(value);
}

/** The raw fields an importer export is derived from (all untrusted). */
export interface ImporterAssignment {
	/** Untrusted atlas id; the image id/path/url are derived from it too. */
	id: string;
	/** Untrusted region map (name → rect); must hold at least one region. */
	regions: Record<string, Rect>;
}

/**
 * Validates an importer assignment (an id plus at least one well-formed region)
 * and derives its export target. The id doubles as the image name and is shaped
 * by {@link deriveSpriteTarget}, so the PNG lands beside every sprite export.
 *
 * @param assignment The untrusted assignment (atlas id + region map).
 * @returns Success with an {@link ImporterExportTarget}, or failure with a
 *   {@link SpriteNameError} (bad id as an image name) or {@link AtlasExportError}.
 */
export function deriveImporterTarget(
	assignment: ImporterAssignment,
): Result<ImporterExportTarget, SpriteNameError | AtlasExportError> {
	let atlasId = validateAtlasId(assignment.id);
	if (isFailure(atlasId)) return failure(atlasId.error);

	let image = deriveSpriteTarget(atlasId.data);
	if (isFailure(image)) return failure(image.error);

	let names = Object.keys(assignment.regions);
	if (names.length === 0) {
		return failure(new AtlasExportError("An atlas needs at least one region."));
	}

	let regions: Record<string, AtlasRect> = {};
	for (let name of names) {
		let validName = validateRegionName(name);
		if (isFailure(validName)) return failure(validName.error);

		let rect = validateRect(validName.data, assignment.regions[name]!);
		if (isFailure(rect)) return failure(rect.error);

		regions[validName.data] = rect.data;
	}

	return success({ image: image.data, atlasId: atlasId.data, regions });
}

/**
 * Returns a copy of the manifest with the image registered under `images` and
 * the WHOLE atlas under `atlases[atlasId]`. Folds {@link registerAtlasRegion}
 * over each region, so merge semantics match a single-region registration.
 *
 * @param manifest The current manifest contents.
 * @param target The derived importer export target (image + atlas id + regions).
 * @returns A new manifest with the image and full atlas registered.
 */
export function registerAtlas(
	manifest: ManifestAtlases,
	target: ImporterExportTarget,
): ManifestAtlases {
	let next = manifest;
	for (let [region, rect] of Object.entries(target.regions)) {
		next = registerAtlasRegion(next, {
			image: target.image,
			atlasId: target.atlasId,
			region,
			rect,
		});
	}
	return next;
}

/** Successful importer export: the written PNG plus the registered image + atlas. */
export interface ImporterExportResult {
	/** Manifest image id the PNG was registered under (equals the atlas id). */
	id: string;
	/** Relative write path of the PNG under the app root. */
	path: string;
	/** Served URL the manifest maps the id to. */
	url: string;
	/** Atlas id the regions were registered under. */
	atlasId: string;
	/** The names of every region registered in the atlas. */
	regions: string[];
	/** Byte count written for the PNG. */
	bytesWritten: number;
}

/**
 * Reads the manifest from disk, treating an absent file as empty so the first
 * import bootstraps it and coercing missing `images` / `atlases` maps to empty
 * objects. A present-but-invalid manifest fails hard, leaving disk intact.
 *
 * @returns Success with the parsed manifest, or failure describing the problem.
 */
async function readManifest(): Promise<Result<ManifestAtlases, ExportValidationError>> {
	let manifestFile = resolve(APP_ROOT, MANIFEST_PATH);
	if (!existsSync(manifestFile)) return success({ images: {}, atlases: {} });

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
	if (typeof manifest.images !== "object" || manifest.images === null) manifest.images = {};
	if (typeof manifest.atlases !== "object" || manifest.atlases === null) manifest.atlases = {};
	return success(manifest as ManifestAtlases);
}

/** Shape of the JSON body {@link runImporterExport} accepts (all fields untrusted). */
interface ImporterExportPayload {
	id: unknown;
	pngBase64: unknown;
	regions: unknown;
}

/**
 * Reads an untrusted region map off a payload, verifying it is an object of
 * name → numeric `{x,y,w,h}` rects. Structural only; the per-region name and
 * bounds rules are enforced later by {@link deriveImporterTarget}.
 *
 * @param value The untrusted `regions` field.
 * @returns Success with the region map, or failure with an
 *   {@link ExportValidationError}.
 */
function readRegions(value: unknown): Result<Record<string, Rect>, ExportValidationError> {
	if (typeof value !== "object" || value === null) {
		return failure(new ExportValidationError("regions must be an object of name → rect."));
	}
	let regions: Record<string, Rect> = {};
	for (let [name, raw] of Object.entries(value as Record<string, unknown>)) {
		if (typeof raw !== "object" || raw === null) {
			return failure(new ExportValidationError(`Region ${JSON.stringify(name)} must be a rect.`));
		}
		let rect = raw as Record<string, unknown>;
		let x = rect.x;
		let y = rect.y;
		let w = rect.w;
		let h = rect.h;
		if (
			typeof x !== "number" ||
			typeof y !== "number" ||
			typeof w !== "number" ||
			typeof h !== "number" ||
			!Number.isFinite(x) ||
			!Number.isFinite(y) ||
			!Number.isFinite(w) ||
			!Number.isFinite(h)
		) {
			return failure(
				new ExportValidationError(`Region ${JSON.stringify(name)} must have numeric x/y/w/h.`),
			);
		}
		regions[name] = { x, y, w, h };
	}
	return success(regions);
}

/**
 * Validates an importer export payload, writes the PNG to `src/assets/<id>.png`,
 * and registers it in the manifest as a flat image AND as a full atlas. The PNG
 * goes through {@link runBinaryExport} to reuse its path guard and base64 decode.
 *
 * @param payload The parsed JSON body from an importer export request (untrusted).
 * @returns Success with an {@link ImporterExportResult}, or failure with a
 *   validation or path-safety error.
 */
export async function runImporterExport(
	payload: unknown,
): Promise<Result<ImporterExportResult, Error>> {
	if (typeof payload !== "object" || payload === null) {
		return failure(new ExportValidationError("Invalid importer export payload."));
	}

	let body = payload as ImporterExportPayload;
	if (typeof body.id !== "string" || typeof body.pngBase64 !== "string") {
		return failure(new ExportValidationError("Invalid importer export payload."));
	}

	let regions = readRegions(body.regions);
	if (isFailure(regions)) return failure(regions.error);

	let target = deriveImporterTarget({ id: body.id, regions: regions.data });
	if (isFailure(target)) return failure(target.error);

	let pngResult = await runBinaryExport({
		path: target.data.image.path,
		contentsBase64: body.pngBase64,
	});
	if (isFailure(pngResult)) return failure(pngResult.error);

	let manifest = await readManifest();
	if (isFailure(manifest)) return failure(manifest.error);

	let nextManifest = registerAtlas(manifest.data, target.data);
	let manifestPath = validateWritePath(MANIFEST_PATH);
	if (isFailure(manifestPath)) return failure(manifestPath.error);

	writeExportFile(
		resolve(APP_ROOT, manifestPath.data),
		`${JSON.stringify(nextManifest, null, "\t")}\n`,
	);

	return success({
		id: target.data.image.name,
		path: pngResult.data.path,
		url: target.data.image.url,
		atlasId: target.data.atlasId,
		regions: Object.keys(target.data.regions),
		bytesWritten: pngResult.data.bytesWritten,
	});
}
