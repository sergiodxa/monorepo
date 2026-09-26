/**
 * Reads a delivered message (a raw `.eml`, e.g. Gmail's "Show original" download) and
 * reports which headers each DKIM-Signature covers, answering whether the RFC 8058
 * one-click headers are signed, which mailbox providers require before they honor them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/// <reference types="bun" />

import { readFile } from "node:fs/promises";

import { isFailure, wrap } from "@sdxc/result";

/** The headers RFC 8058 §3.3 requires a valid DKIM signature to cover, lowercased. */
const REQUIRED_HEADERS = ["list-unsubscribe", "list-unsubscribe-post"] as const;

/** One unfolded header field, in the order it appears in the message. */
export interface HeaderField {
	name: string;
	value: string;
}

/** How one signature treats one of the required headers. */
export interface HeaderCoverage {
	/** Lowercased header field name. */
	name: string;
	/** Occurrences of the field in the message. */
	present: number;
	/** Occurrences of the name in the signature's `h=` tag. */
	listed: number;
	/**
	 * Every present instance is signed. RFC 6376 §5.4.2 signs instances bottom-up, so an
	 * `h=` listing the name fewer times than it appears leaves the topmost copies unsigned.
	 */
	covered: boolean;
	/** `h=` names the field more times than it appears, so an added copy breaks the signature. */
	overSigned: boolean;
}

/** What one DKIM-Signature header claims, before any cryptographic verification. */
export interface SignatureReport {
	/** Signing domain, `null` when the tag is missing. */
	domain: string | null;
	/** Selector, whose key lives at `<s>._domainkey.<d>`. */
	selector: string | null;
	algorithm: string | null;
	/** The `h=` list lowercased, in signing order, duplicates kept. */
	signedHeaders: string[];
	/** Whether `d=` is the From domain or one of its parents, as DMARC relaxed alignment needs. */
	alignedWithFrom: boolean;
	coverage: HeaderCoverage[];
}

/** The whole analysis of one message. */
export interface MessageReport {
	fromDomain: string | null;
	signatures: SignatureReport[];
	/** `Authentication-Results` values, where the receiving provider says which signature passed. */
	authenticationResults: string[];
	/** Every required header is present and covered by at least one aligned signature. */
	ok: boolean;
}

/**
 * Splits the header section off at the first empty line and unfolds continuation lines
 * (RFC 5322 §2.2.3), accepting CRLF or LF since a download may have either.
 *
 * @param raw - The full message source.
 * @returns Every header field in order; a message with no blank line is all headers.
 */
export function parseHeaders(raw: string): HeaderField[] {
	let lines = raw.split(/\r?\n/);
	let fields: HeaderField[] = [];
	for (let line of lines) {
		if (line === "") break;
		let last = fields.at(-1);
		if (/^[ \t]/.test(line)) {
			if (last) last.value += ` ${line.trim()}`;
			continue;
		}
		let colon = line.indexOf(":");
		if (colon <= 0) continue;
		fields.push({ name: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() });
	}
	return fields;
}

/**
 * Parses a DKIM tag-list (RFC 6376 §3.2): `;`-separated `tag=value` pairs where folding
 * whitespace inside a value is insignificant for `h=` and `b=`, so it is stripped.
 *
 * @param value - The DKIM-Signature header value.
 * @returns Tag names mapped to their whitespace-free values; a repeated tag keeps the first.
 */
export function parseTagList(value: string): Map<string, string> {
	let tags = new Map<string, string>();
	for (let part of value.split(";")) {
		let equals = part.indexOf("=");
		if (equals < 0) continue;
		let tag = part.slice(0, equals).trim().toLowerCase();
		if (tag === "" || tags.has(tag)) continue;
		tags.set(tag, part.slice(equals + 1).replace(/\s+/g, ""));
	}
	return tags;
}

/**
 * The domain of the first address in a From value, lowercased, taken from the last
 * `<…>` when a display name is present.
 *
 * @param from - The From header value.
 * @returns The domain, or `null` when no address can be found.
 */
export function addressDomain(from: string): string | null {
	let angle = from.match(/<([^<>]*)>\s*$/);
	let address = angle?.[1] ?? from;
	let at = address.lastIndexOf("@");
	if (at < 0) return null;
	let domain = address
		.slice(at + 1)
		.trim()
		.replace(/[>,\s].*$/, "")
		.toLowerCase();
	return domain === "" ? null : domain;
}

/**
 * Analyzes every DKIM-Signature in a message for coverage of the RFC 8058 headers.
 * Only the `h=` claim is checked; whether the signature verifies is what the receiving
 * provider's `Authentication-Results` reports, so those lines are returned alongside.
 *
 * @param raw - The full message source.
 * @returns The per-signature coverage and an overall verdict.
 */
export function analyzeMessage(raw: string): MessageReport {
	let fields = parseHeaders(raw);
	let count = (name: string) => fields.filter((field) => field.name.toLowerCase() === name).length;
	let from = fields.find((field) => field.name.toLowerCase() === "from");
	let fromDomain = from ? addressDomain(from.value) : null;

	let signatures = fields
		.filter((field) => field.name.toLowerCase() === "dkim-signature")
		.map((field): SignatureReport => {
			let tags = parseTagList(field.value);
			let domain = tags.get("d")?.toLowerCase() ?? null;
			let signedHeaders = (tags.get("h") ?? "")
				.split(":")
				.map((name) => name.trim().toLowerCase())
				.filter((name) => name !== "");
			let coverage = REQUIRED_HEADERS.map((name): HeaderCoverage => {
				let present = count(name);
				let listed = signedHeaders.filter((signed) => signed === name).length;
				return {
					name,
					present,
					listed,
					covered: present > 0 && listed >= present,
					overSigned: listed > present,
				};
			});
			let alignedWithFrom =
				domain !== null &&
				fromDomain !== null &&
				(fromDomain === domain || fromDomain.endsWith(`.${domain}`));
			return {
				domain,
				selector: tags.get("s") ?? null,
				algorithm: tags.get("a") ?? null,
				signedHeaders,
				alignedWithFrom,
				coverage,
			};
		});

	let authenticationResults = fields
		.filter((field) => field.name.toLowerCase() === "authentication-results")
		.map((field) => field.value);

	let ok = signatures.some(
		(signature) =>
			signature.alignedWithFrom && signature.coverage.every((header) => header.covered),
	);

	return { fromDomain, signatures, authenticationResults, ok };
}

/**
 * Renders a report as the lines the command prints, ending in a PASS or FAIL verdict
 * that says what to do next.
 *
 * @param report - The analysis of one message.
 * @returns The printable lines.
 */
export function formatReport(report: MessageReport): string[] {
	let lines = [`From domain: ${report.fromDomain ?? "(none)"}`];
	if (report.signatures.length === 0) lines.push("No DKIM-Signature header found.");
	report.signatures.forEach((signature, index) => {
		lines.push(
			"",
			`DKIM-Signature #${index + 1}: d=${signature.domain ?? "?"} s=${signature.selector ?? "?"} a=${signature.algorithm ?? "?"}` +
				(signature.alignedWithFrom ? " (aligned with From)" : " (not aligned with From)"),
			`  h=${signature.signedHeaders.join(":")}`,
		);
		for (let header of signature.coverage) {
			let state =
				header.present === 0 ? "absent from message" : header.covered ? "signed" : "NOT signed";
			let extra = header.overSigned ? ", over-signed" : "";
			lines.push(
				`  ${header.name}: ${state} (present ${header.present}, listed ${header.listed}${extra})`,
			);
		}
	});
	for (let result of report.authenticationResults)
		lines.push("", `Authentication-Results: ${result}`);
	lines.push(
		"",
		report.ok
			? "PASS: an aligned DKIM signature covers List-Unsubscribe and List-Unsubscribe-Post. Confirm dkim=pass above."
			: "FAIL: no aligned DKIM signature covers both List-Unsubscribe and List-Unsubscribe-Post.",
	);
	return lines;
}

/**
 * Reads the `.eml` named on the command line and prints its report; the exit code is 0
 * on PASS, 1 on FAIL, and 2 when the file cannot be read.
 *
 * @param argv - Command-line arguments after the script path.
 */
async function main(argv: string[]): Promise<void> {
	let path = argv[0];
	if (!path) {
		process.stderr.write("Usage: bun scripts/verify-dkim-headers.ts <message.eml>\n");
		process.exitCode = 2;
		return;
	}
	let raw = await wrap(() => readFile(path, "utf8"));
	if (isFailure(raw)) {
		process.stderr.write(`Cannot read ${path}: ${String(raw.error)}\n`);
		process.exitCode = 2;
		return;
	}
	let report = analyzeMessage(raw.data);
	process.stdout.write(`${formatReport(report).join("\n")}\n`);
	process.exitCode = report.ok ? 0 : 1;
}

if (import.meta.main) await main(process.argv.slice(2));
