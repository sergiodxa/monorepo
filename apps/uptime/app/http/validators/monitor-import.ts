/**
 * Form schema and line parser for bulk monitor creation from a pasted list of URLs.
 * Turns one textarea full of text into the monitors to create plus the lines that could not
 * become one, each with the reason why, so the action can create the good lines and hand the
 * bad ones back.
 *
 * The rules live here rather than in the action because they are the whole feature: what
 * counts as a blank line, when two lines are the same target, and when a bare host is a URL
 * are decisions that need testing on their own, without a request, a team, or a database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

import { normalizeTrialUrl } from "~/app/lib/trial-identity";

/**
 * How many non-blank lines one submission examines, and therefore the most
 * monitors it can create. Each accepted line runs its own unbatched
 * `INSERT`, so the cap keeps one submission inside the request's time budget.
 *
 * @see {@link MonitorImportPlan.overflow}
 */
export const MAX_IMPORT_LINES = 50;

/**
 * Longest single line that is looked at as a URL. Well past the longest URL anyone watches,
 * and short enough that a line this long is a paste accident rather than an address.
 */
export const MAX_IMPORT_LINE_LENGTH = 2048;

/**
 * Longest the whole textarea may be. {@link MAX_IMPORT_LINES} bounds what is *parsed*, and
 * this bounds what is *accepted at all*: a body larger than this is not somebody's list of
 * sites, so it is refused before the parser sees it instead of being counted as overflow.
 */
export const MAX_IMPORT_PAYLOAD_LENGTH = 64_000;

/**
 * How much of a rejected line is echoed back in the report. A rejected line is shown so it
 * can be recognised, not re-read in full, and the report is carried in the session between
 * the action and the page, so every entry has to stay small.
 */
const MAX_REPORTED_INPUT_LENGTH = 120;

/** Smallest and largest check interval, and the default — the same bounds the single-monitor form offers. */
const MIN_INTERVAL_SECONDS = 60;
const MAX_INTERVAL_SECONDS = 3600;
const DEFAULT_INTERVAL_SECONDS = 600;

/**
 * A line already carrying its own scheme, which is left alone. Anything else is a bare host
 * and gets `https://`, since a host is what people paste.
 */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * A hostname made of at least two non-empty dot-separated labels. Guards
 * against a spreadsheet's stray word — `Homepage` prefixed with `https://`
 * parses as a URL that cannot resolve, and it rejects single-label hosts too.
 */
const HOSTNAME_PATTERN = /^[^.]+(\.[^.]+)+$/;

/** Why one line of a pasted list did not become a monitor. */
export type MonitorImportRejectionReason = "invalidUrl" | "duplicate" | "tooLong";

/** One monitor a pasted list asked for, ready to be created. */
export interface MonitorImportCandidate {
	/** 1-based position in the pasted text, so the report points at a line somebody can find. */
	line: number;
	/** The monitor's name: the host, `www.` dropped. */
	name: string;
	/** The absolute http(s) URL to watch. */
	url: string;
}

/** One line that did not become a monitor, and why. */
export interface MonitorImportRejection {
	/** 1-based position in the pasted text. */
	line: number;
	/** The line as pasted (trimmed, and truncated for display). */
	input: string;
	reason: MonitorImportRejectionReason;
}

/**
 * What one pasted list amounts to: the monitors to create, the lines that
 * cannot become one, and how many were never looked at. A partial result —
 * some accepted, some rejected — is the expected outcome of a mixed paste.
 */
export interface MonitorImportPlan {
	accepted: MonitorImportCandidate[];
	rejected: MonitorImportRejection[];
	/**
	 * Non-blank lines past {@link MAX_IMPORT_LINES} that were counted and never
	 * examined, so the page can tell the user how much remains to paste again.
	 */
	overflow: number;
}

/**
 * What the import page shows after an import ran: how many monitors were
 * created, the rejected lines, and the overflow count. Carried in the
 * session between the action and the page, sized to fit there.
 */
export interface MonitorImportReport {
	created: number;
	rejected: MonitorImportRejection[];
	overflow: number;
}

/** Validates the `import-monitors` action form body: the pasted list plus one interval for all of it. */
export const ImportMonitorsSchema = f.object({
	urls: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(MAX_IMPORT_PAYLOAD_LENGTH))),
	interval_seconds: f.field(
		s.defaulted(
			coerce.number().pipe(checks.min(MIN_INTERVAL_SECONDS), checks.max(MAX_INTERVAL_SECONDS)),
			DEFAULT_INTERVAL_SECONDS,
		),
	),
});

export type ImportMonitorsValues = s.InferOutput<typeof ImportMonitorsSchema>;

/** The interval bounds and default the import form's control renders, so the schema and the control cannot disagree. */
export const IMPORT_INTERVAL = {
	min: MIN_INTERVAL_SECONDS,
	max: MAX_INTERVAL_SECONDS,
	default: DEFAULT_INTERVAL_SECONDS,
} as const;

/**
 * The name a pasted URL gets: its host with a leading `www.` dropped and
 * the path left out — the host is the only name a pasted list carries.
 * Total: a `URL` that fails to parse comes back unchanged.
 *
 * @param url - An absolute URL.
 * @returns A name for the monitor, never empty for a URL that parsed.
 * @example monitorImportName("https://www.example.com/health") // "example.com"
 */
export function monitorImportName(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/**
 * Resolves one trimmed line to an absolute http(s) URL, or `null` when it
 * isn't one. A bare host gets `https://`, matching what a person copies
 * from a browser bar, defaulting to the secure endpoint for a bare host.
 *
 * @param line - One trimmed, non-blank line.
 * @returns The parsed URL, or `null` when the line is not an http(s) URL with a real host.
 */
function resolveImportUrl(line: string): URL | null {
	let candidate = SCHEME_PATTERN.test(line) ? line : `https://${line}`;

	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return null;
	}

	/** A scheme this app cannot check is rejected as invalidUrl, giving the line its own explicit reason. */
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	if (!HOSTNAME_PATTERN.test(url.hostname)) return null;
	if (url.username || url.password) return null;

	return url;
}

/** Shortens a line for the report, so one pathological paste can't bloat the session. */
function forReport(line: string): string {
	if (line.length <= MAX_REPORTED_INPUT_LENGTH) return line;
	return line.slice(0, MAX_REPORTED_INPUT_LENGTH);
}

/**
 * Turns pasted text into the monitors to create and the lines to report
 * back, applying the trim, length, host and duplicate rules per line.
 * Duplicates share one endpoint however spelled, keeping one check per site.
 *
 * @param input - The raw contents of the paste box.
 * @returns The monitors to create, the lines that can't be, and the unexamined remainder.
 * @example parseMonitorImportList("example.com\n\nexample.com\nnope") // 1 accepted, 2 rejected
 */
export function parseMonitorImportList(input: string): MonitorImportPlan {
	let accepted: MonitorImportCandidate[] = [];
	let rejected: MonitorImportRejection[] = [];
	let overflow = 0;
	/** Endpoint keys already claimed, so the second spelling of one target is the duplicate. */
	let seen = new Set<string>();

	let lines = input.split(/\r?\n/);

	for (let index = 0; index < lines.length; index++) {
		let line = index + 1;
		let value = (lines[index] ?? "").trim();

		if (value.length === 0) continue;

		if (accepted.length + rejected.length >= MAX_IMPORT_LINES) {
			overflow += 1;
			continue;
		}

		if (value.length > MAX_IMPORT_LINE_LENGTH) {
			rejected.push({ line, input: forReport(value), reason: "tooLong" });
			continue;
		}

		let url = resolveImportUrl(value);
		if (!url) {
			rejected.push({ line, input: forReport(value), reason: "invalidUrl" });
			continue;
		}

		/**
		 * The normalized endpoint key is compared here: it collapses the trailing
		 * slash, the fragment and search-param order, the ways one target gets
		 * pasted twice.
		 */
		let key = normalizeTrialUrl(url.toString());
		if (seen.has(key)) {
			rejected.push({ line, input: forReport(value), reason: "duplicate" });
			continue;
		}
		seen.add(key);

		/**
		 * The parsed URL's own serialization is stored: it already passed `URL`
		 * to be accepted, may have gained a scheme along the way, and matches
		 * what will actually go out on the wire.
		 */
		let href = url.toString();
		accepted.push({ line, name: monitorImportName(href), url: href });
	}

	return { accepted, rejected, overflow };
}
