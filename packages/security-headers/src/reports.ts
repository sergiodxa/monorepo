/**
 * Reads the CSP violation reports a browser POSTs to a policy's report endpoint, in both the
 * Reporting API's `application/reports+json` batches and the legacy `application/csp-report`
 * document, into one shape an app's report route logs or stores.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

import { CSPReportParseError } from "./lib/errors.js";

export { CSPReportParseError };

/**
 * The shared shape both report formats are read into.
 */
export namespace CSPReport {
	/** One blocked (or, under Report-Only, observed) load. */
	export interface Violation {
		documentURL: string;
		/** `null` when the browser reports none; `inline` and `eval` name the kind of script. */
		blockedURL: string | null;
		/** The directive that matched, such as `script-src-elem`. */
		effectiveDirective: string;
		/** `report` for a violation of a Report-Only policy, which the browser allowed. */
		disposition: "enforce" | "report";
		/** The first characters of an inline script or style, when `'report-sample'` asked for it. */
		sample: string | null;
		sourceFile: string | null;
		lineNumber: number | null;
	}
}

/** Media types a report arrives under; some browsers label legacy reports `application/json`. */
const REPORT_MEDIA_TYPES: ReadonlySet<string> = new Set([
	"application/reports+json",
	"application/csp-report",
	"application/json",
]);

/**
 * A field a browser either leaves out or sends as `null`.
 *
 * @param schema - The field's schema when present
 * @returns The schema, also accepting an absent or `null` value
 */
function maybe<Output>(
	schema: Schema<unknown, Output>,
): Schema<unknown, Output | null | undefined> {
	return s.optional(s.nullable(schema));
}

/** A Reporting API `csp-violation` report body. */
const REPORTING_API_BODY_SCHEMA = s.object({
	documentURL: s.string(),
	blockedURL: maybe(s.string()),
	effectiveDirective: s.string(),
	disposition: maybe(s.enum_(["enforce", "report"])),
	sample: maybe(s.string()),
	sourceFile: maybe(s.string()),
	lineNumber: maybe(s.number()),
});

/** One member of a Reporting API batch, whose `type` says whether it is a CSP violation. */
const REPORTING_API_ENTRY_SCHEMA = s.object({ type: s.string(), body: s.any() });

/** The legacy `csp-report` document; `effective-directive` is absent from older browsers. */
const LEGACY_REPORT_SCHEMA = s.object({
	"csp-report": s.object({
		"document-uri": s.string(),
		"blocked-uri": maybe(s.string()),
		"effective-directive": maybe(s.string()),
		"violated-directive": maybe(s.string()),
		disposition: maybe(s.enum_(["enforce", "report"])),
		"script-sample": maybe(s.string()),
		"source-file": maybe(s.string()),
		"line-number": maybe(s.number()),
	}),
});

/**
 * Reads either report format into one shape; wire names such as `blocked-uri` stay internal.
 * Within a Reporting API batch, reports of other types and malformed CSP reports are skipped,
 * since a batch mixes every report type a document produced.
 *
 * @param request - The report POST, whose body is read
 * @returns The violations, or why the request carries no reports
 */
export async function parseReports(
	request: Request,
): Promise<Result<CSPReport.Violation[], CSPReportParseError>> {
	let mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
	if (!REPORT_MEDIA_TYPES.has(mediaType)) {
		return failure(new CSPReportParseError(`Unsupported report media type "${mediaType}"`));
	}

	let body = await wrap((): Promise<unknown> => request.json());
	if (isFailure(body)) return failure(new CSPReportParseError("Report body is not JSON"));

	if (Array.isArray(body.data)) return success(readBatch(body.data));
	return readLegacy(body.data);
}

/**
 * @param entries - A Reporting API batch
 * @returns Its CSP violations, in batch order
 */
function readBatch(entries: unknown[]): CSPReport.Violation[] {
	let violations: CSPReport.Violation[] = [];
	for (let entry of entries) {
		let parsed = s.parseSafe(REPORTING_API_ENTRY_SCHEMA, entry);
		if (!parsed.success || parsed.value.type !== "csp-violation") continue;
		let report = s.parseSafe(REPORTING_API_BODY_SCHEMA, parsed.value.body);
		if (!report.success) continue;
		violations.push({
			documentURL: report.value.documentURL,
			blockedURL: report.value.blockedURL || null,
			effectiveDirective: report.value.effectiveDirective,
			disposition: report.value.disposition ?? "enforce",
			sample: report.value.sample || null,
			sourceFile: report.value.sourceFile || null,
			lineNumber: report.value.lineNumber ?? null,
		});
	}
	return violations;
}

/**
 * Reads a legacy report. Older browsers send only `violated-directive`, whose first token is
 * the directive name.
 *
 * @param body - The parsed JSON body
 * @returns The one violation, or a failure when the body is not a legacy report
 */
function readLegacy(body: unknown): Result<CSPReport.Violation[], CSPReportParseError> {
	let parsed = s.parseSafe(LEGACY_REPORT_SCHEMA, body);
	if (!parsed.success) return failure(new CSPReportParseError("Body is not a CSP report"));

	let report = parsed.value["csp-report"];
	let directive =
		report["effective-directive"] || report["violated-directive"]?.trim().split(/\s+/)[0];
	if (!directive) return failure(new CSPReportParseError("Report names no directive"));

	return success([
		{
			documentURL: report["document-uri"],
			blockedURL: report["blocked-uri"] || null,
			effectiveDirective: directive,
			disposition: report.disposition ?? "enforce",
			sample: report["script-sample"] || null,
			sourceFile: report["source-file"] || null,
			lineNumber: report["line-number"] ?? null,
		},
	]);
}
