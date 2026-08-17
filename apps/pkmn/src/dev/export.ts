/**
 * Server-side export logic for the dev tools. It validates an export payload
 * with `remix/data-schema`, re-checks the target through the pure path-safety
 * guard, and writes the file scoped to the app root. Editors post here to
 * persist authored content into `src/content` / `src/assets`.
 *
 * Alongside the text export ({@link runExport}) it exposes a binary export
 * ({@link runBinaryExport}) that decodes a base64 body to bytes before writing —
 * used by the sprite tool to persist PNGs — and a sprite export
 * ({@link runSpriteExport}) that both writes the PNG and registers it in
 * `src/content/manifest.json`. All three share the same path-safety guard so no
 * export can escape the allow-list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { failure, isFailure, type Result, success } from "@pkg/result";
import { object, parseSafe, string } from "remix/data-schema";

import { validateWritePath } from "./path-safety";
import {
	deriveSpriteTarget,
	registerSpriteImage,
	SpriteNameError,
	type SpriteExportTarget,
	type ManifestImages,
} from "./sprite-export";

/**
 * Absolute path of the app root (the directory containing `src/`). Every export
 * write is resolved against this so a validated relative path can never point
 * outside the app even if the process cwd changes.
 */
export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Writes `contents` at `absolutePath`, creating any missing parent directory
 * first, and reports how many bytes landed on disk. Every export in the dev
 * tools persists through this so a fresh checkout can write into a directory
 * that does not exist yet, and so `bytesWritten` means the same thing
 * everywhere.
 *
 * @param absolutePath Destination already resolved against {@link APP_ROOT}.
 * @param contents UTF-8 text, or the decoded bytes of a binary asset.
 * @returns The byte count written.
 */
export function writeExportFile(absolutePath: string, contents: string | Uint8Array): number {
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, contents);
	return typeof contents === "string" ? Buffer.byteLength(contents) : contents.byteLength;
}

/**
 * Schema for an export request body. `path` is a relative destination under the
 * allow-list and `contents` is the UTF-8 text to write. Validation happens
 * before any path or disk work so malformed payloads are rejected early.
 */
export const ExportPayloadSchema = object({
	path: string(),
	contents: string(),
});

/**
 * Successful export outcome describing what was written and where. `path` is the
 * validated relative path; `absolutePath` is the resolved on-disk location and
 * `bytesWritten` is the byte count written to disk.
 */
export interface ExportResult {
	path: string;
	absolutePath: string;
	bytesWritten: number;
}

/**
 * Error thrown for an invalid export payload (wrong shape or missing fields),
 * distinct from a path-safety rejection so callers can map each to its own
 * response status.
 */
export class ExportValidationError extends Error {
	/**
	 * @param message Human-readable description of the invalid payload.
	 */
	constructor(message: string) {
		super(message);
		this.name = "ExportValidationError";
	}
}

/**
 * Validates an untrusted export payload and writes it to disk under {@link APP_ROOT}.
 *
 * The value is first parsed against {@link ExportPayloadSchema}; the destination
 * is then re-validated with {@link validateWritePath} (defense in depth) before
 * the write. The relative path is resolved against {@link APP_ROOT}, never the
 * process cwd, so the write cannot escape the app.
 *
 * @param payload The parsed JSON body from the export request (untrusted).
 * @returns Success with an {@link ExportResult}, or failure with a validation or
 *   path-safety error.
 */
export async function runExport(payload: unknown): Promise<Result<ExportResult, Error>> {
	let parsed = parseSafe(ExportPayloadSchema, payload);
	if (!parsed.success) {
		let issue = parsed.issues[0];
		return failure(new ExportValidationError(issue ? issue.message : "Invalid export payload."));
	}

	let safePath = validateWritePath(parsed.value.path);
	if (isFailure(safePath)) return failure(safePath.error);

	let absolutePath = resolve(APP_ROOT, safePath.data);
	let bytesWritten = writeExportFile(absolutePath, parsed.value.contents);

	return success({ path: safePath.data, absolutePath, bytesWritten });
}

/**
 * Schema for a binary export request body. `path` is a relative destination under
 * the allow-list and `contentsBase64` is the file's bytes encoded as standard
 * base64; decoding to bytes happens only after validation and path checks pass.
 */
export const BinaryExportPayloadSchema = object({
	path: string(),
	contentsBase64: string(),
});

/**
 * Standard base64 alphabet (with optional `=` padding). A body that does not
 * match is rejected as a validation error before any decode is attempted, so a
 * malformed field cannot reach `Buffer.from`.
 */
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Decodes a validated base64 string to bytes, rejecting anything that is not
 * well-formed base64 (wrong alphabet or length).
 *
 * @param base64 The base64-encoded body from a binary export payload.
 * @returns Success with the decoded bytes, or failure with a validation error.
 */
function decodeBase64(base64: string): Result<Buffer, ExportValidationError> {
	if (base64.length % 4 !== 0 || !BASE64_PATTERN.test(base64)) {
		return failure(new ExportValidationError("contentsBase64 is not valid base64."));
	}
	return success(Buffer.from(base64, "base64"));
}

/**
 * Validates a binary export payload and writes the decoded bytes to disk under
 * {@link APP_ROOT}. Mirrors {@link runExport} but the body is base64 bytes rather
 * than UTF-8 text, so tools can persist images and other binary assets through
 * the same path-safety guard.
 *
 * @param payload The parsed JSON body from a binary export request (untrusted).
 * @returns Success with an {@link ExportResult}, or failure with a validation or
 *   path-safety error.
 */
export async function runBinaryExport(payload: unknown): Promise<Result<ExportResult, Error>> {
	let parsed = parseSafe(BinaryExportPayloadSchema, payload);
	if (!parsed.success) {
		let issue = parsed.issues[0];
		return failure(
			new ExportValidationError(issue ? issue.message : "Invalid binary export payload."),
		);
	}

	let safePath = validateWritePath(parsed.value.path);
	if (isFailure(safePath)) return failure(safePath.error);

	let bytes = decodeBase64(parsed.value.contentsBase64);
	if (isFailure(bytes)) return failure(bytes.error);

	let absolutePath = resolve(APP_ROOT, safePath.data);
	let bytesWritten = writeExportFile(absolutePath, bytes.data);

	return success({ path: safePath.data, absolutePath, bytesWritten });
}

/**
 * Schema for a sprite export request body. `name` is the (untrusted) sprite name
 * the write path and manifest id are derived from; `pngBase64` is the PNG bytes
 * encoded as base64.
 */
export const SpriteExportPayloadSchema = object({
	name: string(),
	pngBase64: string(),
});

/** Relative path (under the app root) of the asset manifest the sprite is added to. */
export const MANIFEST_PATH = "src/content/manifest.json";

/** Successful sprite export: the written PNG plus the registered manifest id/url. */
export interface SpriteExportResult {
	/** Manifest image id the sprite was registered under. */
	id: string;
	/** Relative write path of the PNG under the app root. */
	path: string;
	/** Served URL the manifest maps the id to. */
	url: string;
	/** Byte count written for the PNG. */
	bytesWritten: number;
}

/**
 * Reads the manifest from disk, tolerating an absent file (treated as an empty
 * manifest) so the first export bootstraps it. A present-but-invalid manifest is
 * a hard error rather than being silently overwritten.
 *
 * @returns Success with the parsed manifest, or failure describing the problem.
 */
async function readManifest(): Promise<Result<ManifestImages, ExportValidationError>> {
	let manifestPath = resolve(APP_ROOT, MANIFEST_PATH);
	if (!existsSync(manifestPath)) return success({ images: {} });

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
	} catch {
		return failure(new ExportValidationError("Asset manifest is not valid JSON."));
	}

	if (typeof parsed !== "object" || parsed === null) {
		return failure(new ExportValidationError("Asset manifest is not an object."));
	}

	let manifest = parsed as Record<string, unknown>;
	if (typeof manifest.images !== "object" || manifest.images === null) manifest.images = {};
	return success(manifest as ManifestImages);
}

/**
 * Validates a sprite export payload, writes the PNG to `src/assets/<name>.png`,
 * and registers the sprite in `src/content/manifest.json` (id → served URL).
 *
 * The name is shaped by {@link deriveSpriteTarget} (so the path is a single safe
 * segment), re-checked by {@link validateWritePath} for defense in depth, and the
 * PNG bytes are base64-decoded before writing. The manifest write path is the
 * fixed {@link MANIFEST_PATH}, itself run through the path-safety guard. Either
 * write failing surfaces as a failure result rather than a partial export.
 *
 * @param payload The parsed JSON body from a sprite export request (untrusted).
 * @returns Success with a {@link SpriteExportResult}, or failure with a
 *   validation or path-safety error.
 */
export async function runSpriteExport(
	payload: unknown,
): Promise<Result<SpriteExportResult, Error>> {
	let parsed = parseSafe(SpriteExportPayloadSchema, payload);
	if (!parsed.success) {
		let issue = parsed.issues[0];
		return failure(
			new ExportValidationError(issue ? issue.message : "Invalid sprite export payload."),
		);
	}

	let target: Result<SpriteExportTarget, SpriteNameError> = deriveSpriteTarget(parsed.value.name);
	if (isFailure(target)) return failure(target.error);

	// Write the PNG through the binary export so it shares the same path-safety
	// guard and base64 decode as every other binary write.
	let pngResult = await runBinaryExport({
		path: target.data.path,
		contentsBase64: parsed.value.pngBase64,
	});
	if (isFailure(pngResult)) return failure(pngResult.error);

	let manifest = await readManifest();
	if (isFailure(manifest)) return failure(manifest.error);

	let nextManifest = registerSpriteImage(manifest.data, target.data);
	let manifestPath = validateWritePath(MANIFEST_PATH);
	if (isFailure(manifestPath)) return failure(manifestPath.error);

	writeExportFile(
		resolve(APP_ROOT, manifestPath.data),
		`${JSON.stringify(nextManifest, null, "\t")}\n`,
	);

	return success({
		id: target.data.name,
		path: pngResult.data.path,
		url: target.data.url,
		bytesWritten: pngResult.data.bytesWritten,
	});
}
