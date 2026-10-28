/**
 * Dispatches a catalog operation to the `@sdxc/*` package that implements it.
 * Controllers and MCP tools share this so HTTP and agents stay in lockstep.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { SemVerComparison } from "@sdxc/semver";

import { EPUB } from "@sdxc/epub";
import { Feed } from "@sdxc/feed";
import { tokenize } from "@sdxc/highlight";
import { apply as applyPatch, diff as diffPatch } from "@sdxc/json-patch";
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { PDF } from "@sdxc/pdf";
import { QR } from "@sdxc/qr";
import { failure, isFailure, success } from "@sdxc/result";
import { satisfies } from "@sdxc/semver";
import { parse as parseZoneFile } from "@sdxc/zone-file";

import type { OperationId } from "~/config/catalog";

/** Comparisons {@link satisfies} accepts. */
const SEMVER_COMPARISONS = new Set<SemVerComparison>(["=", "!=", "<", "<=", ">", ">=", "~", "^"]);

/** Hard cap on a client-supplied TrueType font for `pdf.build` (500 KiB). */
const PDF_FONT_MAX_BYTES = 500 * 1024;

/** Hard cap on outbound feed bodies for `feed.normalize` (1 MiB). */
const FEED_MAX_BYTES = 1 * 1024 * 1024;

/** Hard cap on feed source text when the client posts the document inline. */
const FEED_SOURCE_MAX_CHARS = 1 * 1024 * 1024;

/** A refused operation with a stable machine code. */
export class OperationError extends Error {
	override name = "OperationError";

	/**
	 * @param code - Stable code for problem documents
	 * @param message - Human description
	 */
	constructor(
		readonly code: "invalid_input" | "failed" | "unknown_operation",
		message: string,
	) {
		super(message);
	}
}

/**
 * Runs one catalog operation.
 *
 * @param id - Operation id from the catalog
 * @param input - JSON body the client sent
 */
export async function runOperation(
	id: string,
	input: unknown,
): Promise<Result<unknown, OperationError>> {
	switch (id as OperationId) {
		case "qr.encode":
			return runQrEncode(input);
		case "highlight":
			return runHighlight(input);
		case "markdown.plain":
			return runMarkdownPlain(input);
		case "semver.satisfies":
			return runSemverSatisfies(input);
		case "zone-file.parse":
			return runZoneParse(input);
		case "json-patch.apply":
			return runJsonPatchApply(input);
		case "json-patch.diff":
			return runJsonPatchDiff(input);
		case "pdf.build":
			return runPdfBuild(input);
		case "epub.build":
			return runEpubBuild(input);
		case "feed.normalize":
			return runFeedNormalize(input);
		default:
			return failure(new OperationError("unknown_operation", `Unknown operation "${id}"`));
	}
}

/** Reads a required string field from a JSON object. */
function stringField(input: unknown, name: string): Result<string, OperationError> {
	if (typeof input !== "object" || input === null) {
		return failure(new OperationError("invalid_input", "Body must be a JSON object"));
	}
	let value = (input as Record<string, unknown>)[name];
	if (typeof value !== "string") {
		return failure(new OperationError("invalid_input", `Field "${name}" must be a string`));
	}
	return success(value);
}

function runQrEncode(input: unknown): Result<unknown, OperationError> {
	let text = stringField(input, "text");
	if (isFailure(text)) return text;

	let level: "L" | "M" | "Q" | "H" | undefined;
	if (
		typeof input === "object" &&
		input !== null &&
		typeof (input as Record<string, unknown>).level === "string"
	) {
		level = (input as Record<string, unknown>).level as "L" | "M" | "Q" | "H";
	}

	let encoded = QR.encode(text.data, level === undefined ? undefined : { level });
	if (isFailure(encoded)) {
		return failure(new OperationError("failed", encoded.error.message));
	}

	let path = encoded.data.toSVGPath();
	return success({
		version: encoded.data.version,
		size: encoded.data.size,
		level: encoded.data.level,
		mask: encoded.data.mask,
		svgPath: path.d,
		viewBox: path.viewBox,
	});
}

function runHighlight(input: unknown): Result<unknown, OperationError> {
	let source = stringField(input, "source");
	if (isFailure(source)) return source;
	let language = stringField(input, "language");
	if (isFailure(language)) return language;

	try {
		let tokens = tokenize(source.data, language.data);
		return success({ language: language.data, tokens });
	} catch (error) {
		return failure(
			new OperationError("failed", error instanceof Error ? error.message : "Highlighting failed"),
		);
	}
}

function runMarkdownPlain(input: unknown): Result<unknown, OperationError> {
	let markdown = stringField(input, "markdown");
	if (isFailure(markdown)) return markdown;

	let code =
		typeof input === "object" && input !== null && (input as Record<string, unknown>).code === true;

	let parsed = Markdown.parse(markdown.data);
	if (isFailure(parsed)) {
		return failure(new OperationError("failed", parsed.error.message));
	}

	return success({ text: toPlainText(parsed.data.document, { code }) });
}

function runSemverSatisfies(input: unknown): Result<unknown, OperationError> {
	let version = stringField(input, "version");
	if (isFailure(version)) return version;
	let against = stringField(input, "against");
	if (isFailure(against)) return against;
	let comparisonField = stringField(input, "comparison");
	if (isFailure(comparisonField)) return comparisonField;

	if (!SEMVER_COMPARISONS.has(comparisonField.data as SemVerComparison)) {
		return failure(
			new OperationError("invalid_input", 'Field "comparison" must be one of = != < <= > >= ~ ^'),
		);
	}

	return success({
		version: version.data,
		comparison: comparisonField.data,
		against: against.data,
		satisfies: satisfies(version.data, comparisonField.data as SemVerComparison, against.data),
	});
}

function runZoneParse(input: unknown): Result<unknown, OperationError> {
	let zone = stringField(input, "zone");
	if (isFailure(zone)) return zone;
	let origin = stringField(input, "origin");
	if (isFailure(origin)) return origin;

	let parsed = parseZoneFile(zone.data, { origin: origin.data });
	if (isFailure(parsed)) {
		return failure(new OperationError("failed", parsed.error.message));
	}

	return success(parsed.data);
}

function runJsonPatchApply(input: unknown): Result<unknown, OperationError> {
	if (typeof input !== "object" || input === null) {
		return failure(new OperationError("invalid_input", "Body must be a JSON object"));
	}
	let record = input as Record<string, unknown>;
	if (!("document" in record) || !("patch" in record)) {
		return failure(new OperationError("invalid_input", 'Body needs "document" and "patch" fields'));
	}

	let applied = applyPatch(record.document as never, record.patch as never);
	if (isFailure(applied)) {
		return failure(new OperationError("failed", applied.error.message));
	}
	return success({ document: applied.data });
}

function runJsonPatchDiff(input: unknown): Result<unknown, OperationError> {
	if (typeof input !== "object" || input === null) {
		return failure(new OperationError("invalid_input", "Body must be a JSON object"));
	}
	let record = input as Record<string, unknown>;
	if (!("before" in record) || !("after" in record)) {
		return failure(new OperationError("invalid_input", 'Body needs "before" and "after" fields'));
	}

	return success({ patch: diffPatch(record.before as never, record.after as never) });
}

async function runPdfBuild(input: unknown): Promise<Result<unknown, OperationError>> {
	let text = stringField(input, "text");
	if (isFailure(text)) return text;
	let fontBase64 = stringField(input, "fontBase64");
	if (isFailure(fontBase64)) return fontBase64;

	let title: string | undefined;
	if (
		typeof input === "object" &&
		input !== null &&
		typeof (input as Record<string, unknown>).title === "string"
	) {
		title = (input as Record<string, unknown>).title as string;
	}

	let fontBytes = decodeBase64(fontBase64.data, PDF_FONT_MAX_BYTES);
	if (isFailure(fontBytes)) return fontBytes;

	let pdf = new PDF(title === undefined ? {} : { title });
	let font = pdf.font(fontBytes.data);
	if (isFailure(font)) {
		return failure(new OperationError("failed", font.error.message));
	}

	let page = pdf.page();
	if (title !== undefined && title.trim() !== "") {
		page.text(title, { x: 40, y: 40, font: font.data, size: 18 });
		page.text(text.data, { x: 40, y: 72, font: font.data, size: 12 });
	} else {
		page.text(text.data, { x: 40, y: 40, font: font.data, size: 12 });
	}

	let bytes = await pdf.bytes();
	return success({
		mediaType: "application/pdf",
		encoding: "base64",
		bytes: encodeBase64(bytes),
		byteLength: bytes.byteLength,
	});
}

async function runEpubBuild(input: unknown): Promise<Result<unknown, OperationError>> {
	if (typeof input !== "object" || input === null) {
		return failure(new OperationError("invalid_input", "Body must be a JSON object"));
	}
	let record = input as Record<string, unknown>;
	let metadata = record.metadata;
	let chapters = record.chapters;
	if (typeof metadata !== "object" || metadata === null) {
		return failure(new OperationError("invalid_input", 'Field "metadata" must be an object'));
	}
	if (!Array.isArray(chapters) || chapters.length === 0) {
		return failure(
			new OperationError("invalid_input", 'Field "chapters" must be a non-empty array'),
		);
	}

	let meta = metadata as Record<string, unknown>;
	let identifier = meta.identifier;
	let title = meta.title;
	let language = meta.language;
	if (typeof identifier !== "string" || typeof title !== "string" || typeof language !== "string") {
		return failure(
			new OperationError(
				"invalid_input",
				'metadata needs string "identifier", "title" and "language"',
			),
		);
	}

	let built = EPUB.build({
		metadata: {
			identifier,
			title,
			language,
			modified:
				typeof meta.modified === "string"
					? new Date(meta.modified)
					: new Date("2026-01-01T00:00:00Z"),
		},
		chapters: chapters as EPUB.Chapter[],
	});
	if (isFailure(built)) {
		return failure(new OperationError("failed", built.error.message));
	}

	let bytes = await built.data.bytes();
	if (isFailure(bytes)) {
		return failure(new OperationError("failed", bytes.error.message));
	}

	return success({
		mediaType: "application/epub+zip",
		encoding: "base64",
		bytes: encodeBase64(bytes.data),
		byteLength: bytes.data.byteLength,
	});
}

async function runFeedNormalize(input: unknown): Promise<Result<unknown, OperationError>> {
	if (typeof input !== "object" || input === null) {
		return failure(new OperationError("invalid_input", "Body must be a JSON object"));
	}
	let record = input as Record<string, unknown>;
	let source = record.source;
	let url = record.url;

	if (typeof source === "string") {
		if (source.length > FEED_SOURCE_MAX_CHARS) {
			return failure(
				new OperationError(
					"invalid_input",
					`Field "source" exceeds ${FEED_SOURCE_MAX_CHARS} characters`,
				),
			);
		}
		let parsed = Feed.parse(source, typeof url === "string" ? { url } : {});
		if (isFailure(parsed)) {
			return failure(new OperationError("failed", parsed.error.message));
		}
		return success(parsed.data.toJSON());
	}

	if (typeof url === "string") {
		let fetched = await Feed.fetch(url, { maxBytes: FEED_MAX_BYTES });
		if (isFailure(fetched)) {
			return failure(new OperationError("failed", fetched.error.message));
		}
		if (fetched.data.notModified || fetched.data.feed === undefined) {
			return failure(
				new OperationError("failed", "Feed was not modified; send source text instead"),
			);
		}
		return success({
			...fetched.data.feed.toJSON(),
			fetchedUrl: fetched.data.url,
			status: fetched.data.status,
		});
	}

	return failure(
		new OperationError("invalid_input", 'Body needs a string "source" or a string "url"'),
	);
}

/**
 * Decodes a base64 string into bytes, refusing payloads past `maxBytes`.
 *
 * @param value - Base64 text
 * @param maxBytes - Inclusive byte ceiling
 */
function decodeBase64(value: string, maxBytes: number): Result<Uint8Array, OperationError> {
	let binary: string;
	try {
		binary = atob(value);
	} catch {
		return failure(new OperationError("invalid_input", "Field must be valid base64"));
	}
	if (binary.length > maxBytes) {
		return failure(
			new OperationError("invalid_input", `Decoded payload exceeds ${maxBytes} bytes`),
		);
	}
	let bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return success(bytes);
}

/**
 * Encodes bytes as standard base64 for JSON responses.
 *
 * @param bytes - Binary payload
 */
function encodeBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let index = 0; index < bytes.length; index++) {
		binary += String.fromCharCode(bytes[index]!);
	}
	return btoa(binary);
}
