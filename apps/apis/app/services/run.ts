/**
 * Dispatches a catalog operation to the `@sdxc/*` package that implements it.
 * Controllers and MCP tools share this so HTTP and agents stay in lockstep.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { SemVerComparison } from "@sdxc/semver";

import { tokenize } from "@sdxc/highlight";
import { apply as applyPatch, diff as diffPatch } from "@sdxc/json-patch";
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { QR } from "@sdxc/qr";
import { failure, isFailure, success } from "@sdxc/result";
import { satisfies } from "@sdxc/semver";
import { parse as parseZoneFile } from "@sdxc/zone-file";

import type { OperationId } from "~/config/catalog";

/** Comparisons {@link satisfies} accepts. */
const SEMVER_COMPARISONS = new Set<SemVerComparison>(["=", "!=", "<", "<=", ">", ">=", "~", "^"]);

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
