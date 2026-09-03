/**
 * Pure payload-shaping for the sprite export flow: derives the on-disk write
 * path, manifest image id, and served URL from a user-supplied name, staying
 * free of disk and network work so the mapping is unit-testable.
 * {@link SPRITE_NAME_PATTERN} is a conservative slug so the derived path can
 * never smuggle a traversal, extension, or separator past the path-safety check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, type Result, success } from "@sdxc/result";

/**
 * Allowed shape for a sprite name: a lowercase slug of letters, digits, and
 * single hyphens, no leading or trailing hyphen. Rejected early, before any
 * path is constructed, so an invalid name never reaches the file system.
 */
export const SPRITE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Maximum sprite name length, keeping the derived filename reasonable. */
export const MAX_SPRITE_NAME_LENGTH = 64;

/** Directory (under the app root) sprite PNGs are written into. */
export const SPRITE_ASSET_DIR = "src/assets";

/** URL prefix the game loads registered sprite images from. */
export const SPRITE_URL_PREFIX = "/assets";

/** The shaped destination for a sprite export, derived from its name. */
export interface SpriteExportTarget {
	/** Sanitized sprite name (the manifest image id). */
	name: string;
	/** Relative write path under the app root, e.g. `src/assets/hero.png`. */
	path: string;
	/** Served URL the manifest maps the id to, e.g. `/assets/hero.png`. */
	url: string;
}

/** Error describing why a sprite name was rejected before any path work. */
export class SpriteNameError extends Error {
	/**
	 * @param message Human-readable reason the name is invalid.
	 */
	constructor(message: string) {
		super(message);
		this.name = "SpriteNameError";
	}
}

/**
 * Validates a sprite name and derives its export target (write path, manifest
 * id, served URL). The derived path is always a single safe segment under
 * {@link SPRITE_ASSET_DIR}.
 *
 * @param rawName The user-supplied sprite name (untrusted, un-trimmed).
 * @returns Success with a {@link SpriteExportTarget}, or failure with a
 *   {@link SpriteNameError}.
 */
export function deriveSpriteTarget(rawName: string): Result<SpriteExportTarget, SpriteNameError> {
	let name = rawName.trim();
	if (name.length === 0) return failure(new SpriteNameError("Sprite name is required."));
	if (name.length > MAX_SPRITE_NAME_LENGTH) {
		return failure(
			new SpriteNameError(`Sprite name must be at most ${MAX_SPRITE_NAME_LENGTH} characters.`),
		);
	}
	if (!SPRITE_NAME_PATTERN.test(name)) {
		return failure(
			new SpriteNameError(
				"Sprite name must be a lowercase slug: letters, digits, and single hyphens (no leading or trailing hyphen), 1–64 characters.",
			),
		);
	}

	return success({
		name,
		path: `${SPRITE_ASSET_DIR}/${name}.png`,
		url: `${SPRITE_URL_PREFIX}/${name}.png`,
	});
}

/**
 * The minimal manifest slice the sprite export reads and writes: only `images`
 * is required for registering a sprite; other kinds pass through untouched.
 * Described structurally, keeping this module free of a presentation dependency.
 */
export interface ManifestImages {
	images: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Returns a copy of the manifest with the sprite registered under `images`
 * (id → served URL), leaving every other entry and the input manifest
 * untouched, so the caller decides when to persist the result.
 *
 * @param manifest The current manifest contents.
 * @param target The derived export target whose name/url is registered.
 * @returns A new manifest object with the sprite added under `images`.
 */
export function registerSpriteImage(
	manifest: ManifestImages,
	target: SpriteExportTarget,
): ManifestImages {
	return {
		...manifest,
		images: { ...manifest.images, [target.name]: target.url },
	};
}
