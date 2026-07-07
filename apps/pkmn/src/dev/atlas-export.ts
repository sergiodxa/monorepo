/**
 * Sprite-into-atlas export flow for the dev tools. Where the plain sprite export
 * (see `sprite-export.ts`) registers a drawn PNG as a flat `images` entry, this
 * module additionally assigns it as a NAMED REGION of a sprite atlas in
 * `src/content/manifest.json`, so renderers can blit it by region name via the
 * presentation's `Atlas` (see `src/presentation/render/atlas.ts`) rather than
 * loading the whole file as one image.
 *
 * It is split into a pure half and a server half. The pure half
 * ({@link deriveAtlasTarget} + {@link registerAtlasRegion}) validates the atlas
 * id, region name, and rect, then shapes the manifest mutation — registering the
 * image under `images` and adding/updating the region under
 * `atlases[atlasId].regions[region]` — without touching disk, so the mapping can
 * be unit-tested directly. The server half ({@link runAtlasExport}) writes the
 * PNG and persists the updated manifest behind the shared path-safety guard and
 * `Bun.write`. It reuses `deriveSpriteTarget` for the image name/path/url and the
 * binary export for the PNG so it shares the exact same safety checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resolve } from "node:path";

import { failure, isFailure, type Result, success } from "@pkg/result";

import { APP_ROOT, ExportValidationError, MANIFEST_PATH, runBinaryExport } from "./export";
import { validateWritePath } from "./path-safety";
import { deriveSpriteTarget, SpriteNameError, type SpriteExportTarget } from "./sprite-export";

/**
 * Allowed shape for an atlas id and a region name: a slug of lowercase letters,
 * digits, and single hyphens, optionally in dotted segments (e.g. `hero.down`,
 * `tile.grass`) to match the region-naming convention the presentation atlas
 * uses. No leading/trailing hyphen or dot, no empty segment.
 */
export const ATLAS_NAME_PATTERN =
	/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;

/** Maximum length for an atlas id or region name, keeping manifest keys sane. */
export const MAX_ATLAS_NAME_LENGTH = 64;

/** A rectangular sub-region of an atlas image, in source pixels. */
export interface AtlasRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** The validated destination for assigning a sprite as an atlas region. */
export interface AtlasExportTarget {
	/** The underlying image export target (name, write path, served URL). */
	image: SpriteExportTarget;
	/** Validated atlas id the region is added to. */
	atlasId: string;
	/** Validated region name within the atlas. */
	region: string;
	/** Validated region rect in source pixels. */
	rect: AtlasRect;
}

/** Error describing why an atlas assignment was rejected before any path work. */
export class AtlasExportError extends Error {
	/**
	 * @param message Human-readable reason the atlas assignment is invalid.
	 */
	constructor(message: string) {
		super(message);
		this.name = "AtlasExportError";
	}
}

/** Validates one atlas id / region name against {@link ATLAS_NAME_PATTERN}. */
function validateName(label: string, raw: string): Result<string, AtlasExportError> {
	let value = raw.trim();
	if (value.length === 0) return failure(new AtlasExportError(`${label} is required.`));
	if (value.length > MAX_ATLAS_NAME_LENGTH) {
		return failure(
			new AtlasExportError(`${label} must be at most ${MAX_ATLAS_NAME_LENGTH} characters.`),
		);
	}
	if (!ATLAS_NAME_PATTERN.test(value)) {
		return failure(
			new AtlasExportError(
				`${label} must be a lowercase slug of letters, digits, and single hyphens, optionally dotted (e.g. "hero.down").`,
			),
		);
	}
	return success(value);
}

/**
 * Validates a rect: every field must be a non-negative integer and both
 * dimensions must be positive, so a region can never be zero-sized or fractional.
 */
function validateRect(rect: AtlasRect): Result<AtlasRect, AtlasExportError> {
	let fields: Array<[label: string, value: number, positive: boolean]> = [
		["x", rect.x, false],
		["y", rect.y, false],
		["w", rect.w, true],
		["h", rect.h, true],
	];
	for (let [label, value, positive] of fields) {
		if (!Number.isInteger(value) || value < 0) {
			return failure(new AtlasExportError(`Region ${label} must be a non-negative integer.`));
		}
		if (positive && value < 1) {
			return failure(new AtlasExportError(`Region ${label} must be at least 1.`));
		}
	}
	return success({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
}

/** The raw fields an atlas assignment is derived from (all untrusted). */
export interface AtlasAssignment {
	/** Untrusted sprite name; the image id/path/url are derived from it. */
	name: string;
	/** Untrusted atlas id the region is added to. */
	atlasId: string;
	/** Untrusted region name within the atlas. */
	region: string;
	/** Untrusted region rect in source pixels. */
	rect: AtlasRect;
}

/**
 * Validates an atlas assignment and derives its export target: the image target
 * (via {@link deriveSpriteTarget}) plus the validated atlas id, region name, and
 * rect. Pure — no disk, canvas, or network — so the mapping is unit-testable.
 *
 * @param assignment The untrusted assignment fields.
 * @returns Success with an {@link AtlasExportTarget}, or failure with a
 *   {@link SpriteNameError} (bad image name) or {@link AtlasExportError}.
 */
export function deriveAtlasTarget(
	assignment: AtlasAssignment,
): Result<AtlasExportTarget, SpriteNameError | AtlasExportError> {
	let image = deriveSpriteTarget(assignment.name);
	if (isFailure(image)) return failure(image.error);

	let atlasId = validateName("Atlas id", assignment.atlasId);
	if (isFailure(atlasId)) return failure(atlasId.error);

	let region = validateName("Region name", assignment.region);
	if (isFailure(region)) return failure(region.error);

	let rect = validateRect(assignment.rect);
	if (isFailure(rect)) return failure(rect.error);

	return success({
		image: image.data,
		atlasId: atlasId.data,
		region: region.data,
		rect: rect.data,
	});
}

/** One atlas declaration in the manifest: an image URL plus its named regions. */
export interface ManifestAtlasEntry {
	/** URL of the sheet image the regions are sliced from. */
	image: string;
	/** Static regions keyed by name, in source pixels. */
	regions: Record<string, AtlasRect>;
	/** Any other fields (e.g. `animations`) carried through untouched. */
	[key: string]: unknown;
}

/**
 * The minimal manifest slice this export reads and writes: `images` (for the
 * flat image registration) and `atlases` (for the region assignment). Other
 * kinds are carried through untouched. Kept structural (not importing the
 * presentation type) so this module has no cross-layer dependency.
 */
export interface ManifestAtlases {
	images: Record<string, string>;
	atlases: Record<string, ManifestAtlasEntry>;
	[key: string]: unknown;
}

/**
 * Returns a copy of the manifest with the sprite registered both as a flat
 * `images` entry (id → served URL) and as a named region of an atlas
 * (`atlases[atlasId]`), creating the atlas entry when absent and adding/updating
 * just the one region otherwise. The atlas's `image` is set to the sprite's URL:
 * the drawn sprite IS the atlas sheet, so a renderer blits the region straight
 * from it. Pure — never mutates the input — so the caller decides when to persist.
 *
 * @param manifest The current manifest contents.
 * @param target The derived atlas export target (image + atlas id + region + rect).
 * @returns A new manifest object with the image and atlas region registered.
 */
export function registerAtlasRegion(
	manifest: ManifestAtlases,
	target: AtlasExportTarget,
): ManifestAtlases {
	let existing = manifest.atlases[target.atlasId];
	let nextEntry: ManifestAtlasEntry = {
		...existing,
		image: target.image.url,
		regions: { ...existing?.regions, [target.region]: { ...target.rect } },
	};
	return {
		...manifest,
		images: { ...manifest.images, [target.image.name]: target.image.url },
		atlases: { ...manifest.atlases, [target.atlasId]: nextEntry },
	};
}

/** Successful atlas export: the written PNG plus the registered image + region. */
export interface AtlasExportResult {
	/** Manifest image id the sprite was registered under. */
	id: string;
	/** Relative write path of the PNG under the app root. */
	path: string;
	/** Served URL the manifest maps the id to. */
	url: string;
	/** Atlas id the region was added to. */
	atlasId: string;
	/** Region name the sprite was assigned within the atlas. */
	region: string;
	/** The region rect in source pixels. */
	rect: AtlasRect;
	/** Byte count reported by `Bun.write` for the PNG. */
	bytesWritten: number;
}

/**
 * Reads the manifest from disk, tolerating an absent file (treated as an empty
 * manifest) so the first export bootstraps it, and coercing missing `images` /
 * `atlases` maps to empty objects. A present-but-invalid manifest is a hard
 * error rather than being silently overwritten.
 *
 * @returns Success with the parsed manifest, or failure describing the problem.
 */
async function readManifest(): Promise<Result<ManifestAtlases, ExportValidationError>> {
	let file = Bun.file(resolve(APP_ROOT, MANIFEST_PATH));
	if (!(await file.exists())) return success({ images: {}, atlases: {} });

	let parsed: unknown;
	try {
		parsed = await file.json();
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

/** Shape of the JSON body {@link runAtlasExport} accepts (all fields untrusted). */
interface AtlasExportPayload {
	name: unknown;
	pngBase64: unknown;
	atlasId: unknown;
	region: unknown;
	x: unknown;
	y: unknown;
	w: unknown;
	h: unknown;
}

/** Reads a required string field off an untrusted payload, or returns `null`. */
function readString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** Reads a required finite-number field off an untrusted payload, or `null`. */
function readNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Validates an atlas export payload, writes the PNG to `src/assets/<name>.png`,
 * and registers it in `src/content/manifest.json` both as a flat image and as a
 * named region of the chosen atlas.
 *
 * The name/atlas-id/region/rect are validated by {@link deriveAtlasTarget}; the
 * PNG bytes are written through {@link runBinaryExport} so they share the same
 * path-safety guard and base64 decode as every other binary write; and the
 * manifest write path is the fixed {@link MANIFEST_PATH}, itself re-checked by
 * {@link validateWritePath}. Any step failing surfaces as a failure result rather
 * than a partial export.
 *
 * @param payload The parsed JSON body from an atlas export request (untrusted).
 * @returns Success with an {@link AtlasExportResult}, or failure with a
 *   validation or path-safety error.
 */
export async function runAtlasExport(payload: unknown): Promise<Result<AtlasExportResult, Error>> {
	if (typeof payload !== "object" || payload === null) {
		return failure(new ExportValidationError("Invalid atlas export payload."));
	}

	let body = payload as AtlasExportPayload;
	let name = readString(body.name);
	let pngBase64 = readString(body.pngBase64);
	let atlasId = readString(body.atlasId);
	let region = readString(body.region);
	let x = readNumber(body.x);
	let y = readNumber(body.y);
	let w = readNumber(body.w);
	let h = readNumber(body.h);
	if (
		name === null ||
		pngBase64 === null ||
		atlasId === null ||
		region === null ||
		x === null ||
		y === null ||
		w === null ||
		h === null
	) {
		return failure(new ExportValidationError("Invalid atlas export payload."));
	}

	let target = deriveAtlasTarget({ name, atlasId, region, rect: { x, y, w, h } });
	if (isFailure(target)) return failure(target.error);

	// Write the PNG through the binary export so it shares the same path-safety
	// guard and base64 decode as every other binary write.
	let pngResult = await runBinaryExport({
		path: target.data.image.path,
		contentsBase64: pngBase64,
	});
	if (isFailure(pngResult)) return failure(pngResult.error);

	let manifest = await readManifest();
	if (isFailure(manifest)) return failure(manifest.error);

	let nextManifest = registerAtlasRegion(manifest.data, target.data);
	let manifestPath = validateWritePath(MANIFEST_PATH);
	if (isFailure(manifestPath)) return failure(manifestPath.error);

	await Bun.write(
		resolve(APP_ROOT, manifestPath.data),
		`${JSON.stringify(nextManifest, null, "\t")}\n`,
	);

	return success({
		id: target.data.image.name,
		path: pngResult.data.path,
		url: target.data.image.url,
		atlasId: target.data.atlasId,
		region: target.data.region,
		rect: target.data.rect,
		bytesWritten: pngResult.data.bytesWritten,
	});
}
