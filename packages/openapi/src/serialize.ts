/**
 * Reading and writing OpenAPI documents as JSON or YAML. Reading checks the version and
 * the top-level shape, so a caller holding the result knows it is a 3.1 document; YAML
 * goes through `@sdxc/yaml`, and every failure is a `Result`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import * as yaml from "@sdxc/yaml";

import type { OpenAPI } from "./types.js";

import { OpenAPIParseError, OpenAPIStringifyError } from "./errors.js";

/** The media type of a JSON document. */
export const MEDIA_TYPE_JSON = "application/json";

/** The media type of a YAML document, registered by RFC 9512. */
export const MEDIA_TYPE_YAML = "application/yaml";

/** How `stringify` writes a document. */
export interface StringifyOptions {
	/** @default "json" */
	format?: "json" | "yaml";
	/** Spaces per nesting level. @default 2 */
	indent?: number;
}

/**
 * Reads a JSON or YAML OpenAPI 3.1 document. Text starting with `{` is JSON, anything else
 * YAML. The document must declare `openapi: 3.1.x` and an `info` with `title` and
 * `version`; `paths`, `components` and `servers` must have their shapes when present.
 *
 * @param text - The document's source.
 * @example let result = parse(await response.text());
 */
export function parse(text: string): Result<OpenAPI.Document, OpenAPIParseError> {
	let value = readValue(text);
	if (value.status === "failure") return value;

	let document = value.data;
	if (!isRecord(document)) return parseFailure("An OpenAPI document is an object");
	if (typeof document.openapi !== "string" || !/^3\.1\.\d+$/.test(document.openapi)) {
		return parseFailure(`Expected openapi 3.1.x, found ${JSON.stringify(document.openapi)}`);
	}

	let info = document.info;
	if (!isRecord(info) || typeof info.title !== "string" || typeof info.version !== "string") {
		return parseFailure("info must be an object with a string title and version");
	}
	for (let key of ["paths", "components", "webhooks"]) {
		if (document[key] !== undefined && !isRecord(document[key])) {
			return parseFailure(`${key} must be an object`);
		}
	}
	for (let key of ["servers", "security", "tags"]) {
		if (document[key] !== undefined && !Array.isArray(document[key])) {
			return parseFailure(`${key} must be an array`);
		}
	}
	return success(document as unknown as OpenAPI.Document);
}

/**
 * Writes a document as JSON, the default, or as YAML, ending with a newline either way.
 *
 * @param document - The document.
 * @param options - The format and indentation.
 * @example let yamlText = stringify(document, { format: "yaml" });
 */
export function stringify(
	document: OpenAPI.Document,
	options: StringifyOptions = {},
): Result<string, OpenAPIStringifyError> {
	let indent = options.indent ?? 2;
	if (options.format === "yaml") {
		let written = yaml.stringify(document, { indent });
		if (written.status === "failure") {
			return failure(new OpenAPIStringifyError(written.error.message, { cause: written.error }));
		}
		return success(written.data.endsWith("\n") ? written.data : `${written.data}\n`);
	}

	try {
		return success(`${JSON.stringify(document, null, indent)}\n`);
	} catch (error) {
		let message = error instanceof Error ? error.message : String(error);
		return failure(new OpenAPIStringifyError(message, { cause: error }));
	}
}

/** Decodes the source as JSON or YAML. `JSON.parse` throws on malformed text, which becomes a failure. */
function readValue(text: string): Result<unknown, OpenAPIParseError> {
	if (text.trimStart().startsWith("{")) {
		try {
			return success(JSON.parse(text));
		} catch (error) {
			let message = error instanceof Error ? error.message : String(error);
			return failure(new OpenAPIParseError(`Invalid JSON: ${message}`, { cause: error }));
		}
	}
	let parsed = yaml.parse(text);
	if (parsed.status === "failure") {
		return failure(
			new OpenAPIParseError(`Invalid YAML: ${parsed.error.message}`, { cause: parsed.error }),
		);
	}
	return success(parsed.data);
}

/** Whether a value is a plain JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A failed read. */
function parseFailure(message: string): Result<never, OpenAPIParseError> {
	return failure(new OpenAPIParseError(message));
}
