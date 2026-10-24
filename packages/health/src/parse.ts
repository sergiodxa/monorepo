/**
 * Reading a report another service sent: recognizing the media type, and turning the body
 * into a validated report with normalized statuses. A caller that also matches the body
 * against other rules reads it once and hands the text here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { parseSafe } from "@sdxc/json-schema";
import { failure, success } from "@sdxc/result";

import type { Health } from "./types.js";

import HEALTH_REPORT from "./schema.js";

/** The media type a health report is served as. */
export const HEALTH_MEDIA_TYPE = "application/health+json";

/**
 * Whether `response` declares itself a health report. Parameters such as `charset` and the
 * case of the type are ignored, as media types compare.
 *
 * @example if (isHealthResponse(response)) parseHealth(await response.text());
 */
export function isHealthResponse(response: Response): boolean {
	let type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
	return type === HEALTH_MEDIA_TYPE;
}

/**
 * A report read from its JSON text, validated against the format, with `ok`/`up`,
 * `error`/`down` and any casing reduced to `pass`, `warn` or `fail`. A body that is not
 * JSON, or not a report, is a failure saying which.
 *
 * @param body The response body as text.
 * @example let report = parseHealth(await response.text());
 */
export function parseHealth(body: string): Result<Health.Report, Error> {
	let json: unknown;
	try {
		json = JSON.parse(body);
	} catch {
		return failure(new SyntaxError("The health report is not valid JSON"));
	}

	let parsed = parseSafe(HEALTH_REPORT, json);
	if (parsed.success) return success(parsed.value);

	let issues = parsed.issues.map((issue) => {
		let path = issue.path?.map((key) => (typeof key === "object" ? key.key : key)).join(".");
		return path ? `${path}: ${issue.message}` : issue.message;
	});
	return failure(new TypeError(`The health report is invalid: ${issues.join("; ")}`));
}
