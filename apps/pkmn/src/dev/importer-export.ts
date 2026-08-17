/**
 * Importer export flow for the dev tools. Where the atlas export
 * (`atlas-export.ts`) assigns a single drawn sprite as ONE named region of an
 * atlas, this module takes an existing PNG plus a whole set of pre-computed
 * regions (from the pure {@link sliceGrid}/manual helpers in `atlas-slicer.ts`)
 * and registers the image as a full atlas in `src/content/manifest.json` — image
 * URL plus EVERY region at once — so the game can blit any tile/sprite by region
 * name.
 *
 * It is split into a pure half and a server half. The pure half
 * ({@link deriveImporterTarget} + {@link registerAtlas}) validates the atlas id
 * and its regions, derives the image write path/url from the id (reusing the same
 * `src/assets/<id>.png` shaping as `deriveSpriteTarget`), and shapes the manifest
 * mutation — registering the image under `images` and the whole atlas under
 * `atlases[id]` — without touching disk, so the mapping is unit-testable. The
 * server half ({@link runImporterExport}) writes the PNG through the shared
 * {@link runBinaryExport} (so it reuses the exact path-safety guard and base64
 * decode) and persists the updated manifest behind {@link validateWritePath}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { failure, isFailure, type Result, success } from "@pkg/result";

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
 * dimensions positive, so a region can never be zero-sized or fractional.
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
 * Validates an importer assignment and derives its export target: the image
 * target (via {@link deriveSpriteTarget}, so the write path/url match every other
 * sprite export) plus the validated atlas id and its full region map. The atlas
 * id doubles as the image name. Rejects an empty region map, an invalid region
 * name, or a bad rect. Pure — no disk, canvas, or network — so it is unit-testable.
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

	// The id also names the image file; reuse the sprite shaping for path/url so an
	// importer atlas lands beside every other sprite export.
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
 * Returns a copy of the manifest with the imported image registered under
 * `images` (id → url) and the WHOLE atlas registered under `atlases[atlasId]`
 * (image url + every region). Built by folding {@link registerAtlasRegion} over
 * each region so it shares the exact merge semantics — creating the atlas entry
 * when absent, adding/updating each region otherwise, and carrying through
 * unrelated manifest kinds and atlas fields untouched. Pure: never mutates the
 * input.
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
 * Reads the manifest from disk, tolerating an absent file (treated as an empty
 * manifest) so the first import bootstraps it, and coercing missing `images` /
 * `atlases` maps to empty objects. A present-but-invalid manifest is a hard error
 * rather than being silently overwritten.
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
 * name → `{x,y,w,h}` numeric rects. Structural only — the per-region name and
 * bounds rules are enforced later by {@link deriveImporterTarget}. Rejects a
 * non-object or a malformed rect entry.
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
 * and registers it in `src/content/manifest.json` as a flat image AND as a full
 * atlas with every region.
 *
 * The id/regions are validated by {@link deriveImporterTarget}; the PNG bytes are
 * written through {@link runBinaryExport} so they share the same path-safety guard
 * and base64 decode as every other binary write; and the manifest write path is
 * the fixed {@link MANIFEST_PATH}, itself re-checked by {@link validateWritePath}.
 * Any step failing surfaces as a failure result rather than a partial import.
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

	// Write the PNG through the binary export so it shares the same path-safety
	// guard and base64 decode as every other binary write.
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
