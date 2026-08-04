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
 * How many non-blank lines one submission is looked at, and therefore the most monitors it
 * can create.
 *
 * Every accepted line is its own `INSERT` in a request that has no transaction to batch them
 * into, so the work this endpoint does is linear in the length of the list and a long enough
 * list runs out of request budget half way down — leaving an import nobody can tell apart
 * from a finished one. Fifty bounds that to something a single request comfortably finishes,
 * covers the roster sizes this is for (an agency arriving with its client sites), and keeps
 * the report a person is expected to read and fix short enough to read. Past it lines are
 * counted, not examined, so a stray paste of a whole spreadsheet costs one count rather than
 * thousands of `URL` parses — {@link MonitorImportPlan.overflow} reports the remainder and
 * they go in a second paste.
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
 * A hostname made of at least two non-empty dot-separated labels.
 *
 * The dot is the guard against a spreadsheet's stray word: `Homepage` prefixed with
 * `https://` parses as a perfectly valid URL, so without this a column header would silently
 * become a monitor watching a host that cannot resolve — a worse outcome than telling
 * somebody line 1 isn't a URL. It also rejects the paste artifacts `example.`, `.example.com`
 * and `a..b`, and it rejects single-label hosts (`localhost`, a bracketed IPv6 literal),
 * which are not things this product can reach from an edge location anyway.
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
 * What one pasted list amounts to: the monitors to create, the lines that cannot become one,
 * and how many lines were never looked at.
 *
 * Both halves are expected to be non-empty at once. A partial result is the normal outcome of
 * pasting thirty lines off a spreadsheet, not an error state.
 */
export interface MonitorImportPlan {
	accepted: MonitorImportCandidate[];
	rejected: MonitorImportRejection[];
	/**
	 * Non-blank lines past {@link MAX_IMPORT_LINES} that were counted and never examined, so
	 * the page can say how much is left to paste again rather than dropping it silently.
	 */
	overflow: number;
}

/**
 * What the import page shows after an import ran: the rejected lines and the overflow count,
 * plus how many monitors were created.
 *
 * Carried in the session between the action and the page, which is why it holds only the
 * report and not the monitors themselves.
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
 * The name a pasted URL gets: its host with a leading `www.` dropped and the path left out.
 *
 * A pasted list carries no names, so the host is the only name available — and it is the one
 * a person recognises in a list, which a path would only make longer. A string `URL` cannot
 * parse comes back unchanged, so this is total; callers only reach it with a URL that already
 * parsed.
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
 * Resolves one trimmed line to an absolute http(s) URL, or `null` when it isn't one.
 *
 * A line with no scheme gets `https://` rather than being refused: a bare host is what a
 * person copies out of a browser bar or a spreadsheet cell, and refusing it would reject most
 * of a realistic paste. `https` and not `http`, because an unqualified host today means the
 * secure one and watching the plaintext port instead would silently monitor a different
 * endpoint than the one that was meant.
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

	/** A scheme this app cannot check is a rejection with a reason, not a silent coercion to one it can. */
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
 * Turns pasted text into the monitors to create and the lines to report back.
 *
 * The rules, in the order they apply to each line:
 *
 * - **Whitespace is trimmed** and **blank lines are skipped silently.** A blank line is not a
 *   mistake somebody needs told about — it is how pasted text ends, and how a spreadsheet
 *   separates blocks.
 * - **A line longer than {@link MAX_IMPORT_LINE_LENGTH}** is rejected without being parsed.
 * - **A bare host is normalised to `https://`**; anything that still isn't an http(s) URL
 *   with a real host is rejected as one, per line, so the rest of the list still lands.
 * - **A line naming a target an earlier line already named is rejected as a duplicate.**
 *   Sameness is the endpoint, not the spelling: `example.com`, `https://example.com/` and
 *   `https://example.com/#top` are one monitor written three ways, and creating three of them
 *   would triple somebody's check consumption for one site. The first spelling wins, so the
 *   report always points forward at the line to delete.
 * - **Only the first {@link MAX_IMPORT_LINES} non-blank lines are examined at all**; the rest
 *   are counted into {@link MonitorImportPlan.overflow}.
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
		 * The endpoint key, not the URL itself: it collapses the trailing slash, the fragment
		 * and search-param order, which are the ways one target gets pasted twice.
		 */
		let key = normalizeTrialUrl(url.toString());
		if (seen.has(key)) {
			rejected.push({ line, input: forReport(value), reason: "duplicate" });
			continue;
		}
		seen.add(key);

		/**
		 * The parsed URL's own serialization is stored rather than the line as pasted: the line
		 * had to go through `URL` to be accepted at all, may be missing the scheme entirely, and
		 * its serialization is the same request on the wire.
		 */
		let href = url.toString();
		accepted.push({ line, name: monitorImportName(href), url: href });
	}

	return { accepted, rejected, overflow };
}
