/**
 * security.txt (RFC 9116): a line-based reader enforcing the §2.5 cardinalities and
 * `https` rules, reading a cleartext-signed file from its signed body, and a writer,
 * so every app publishes where a researcher reports a vulnerability.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";

import { WellKnownParseError } from "./parse-error.js";

export const NAME = "security.txt";
export const MEDIA_TYPE = "text/plain; charset=utf-8";

/** The fields RFC 9116 §2.5 defines, with unknown ones kept under `extensions`. */
export interface SecurityTxt {
	/** `mailto:`, `tel:` or `https:` URIs, in the order a researcher should try them. */
	contact: [URL, ...URL[]];
	expires: Date;
	encryption: URL[];
	acknowledgments: URL[];
	/** Language tags, written as one comma-separated field. */
	preferredLanguages: string[];
	canonical: URL[];
	policy: URL[];
	hiring: URL[];
	/** Fields outside RFC 9116 §2.5, keyed by lowercased name, kept in order. */
	extensions: Record<string, string[]>;
}

export interface ParsedSecurityTxt extends SecurityTxt {
	/** Whether the text arrived inside an OpenPGP cleartext signature (RFC 9116 §2). */
	signed: boolean;
}

export interface StringifyOptions {
	/** `#` comment lines written before the first field. */
	comments?: string[];
}

/** The URI-valued fields, by lowercased field name, and whether a web URI is all they take. */
const URI_FIELDS = {
	contact: { key: "contact", httpsOnly: false },
	encryption: { key: "encryption", httpsOnly: false },
	acknowledgments: { key: "acknowledgments", httpsOnly: true },
	canonical: { key: "canonical", httpsOnly: true },
	policy: { key: "policy", httpsOnly: true },
	hiring: { key: "hiring", httpsOnly: true },
} as const;

/** A field line: a name of visible characters other than `:`, then its value (§3). */
const FIELD_LINE = /^([!-9;-~]+):[ \t]*(.*?)[ \t]*$/;

/** An RFC 3339 `date-time`, which §2.5.5 requires of `Expires`. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/** The armor line opening an OpenPGP cleartext signature (RFC 4880 §7). */
const SIGNED_HEADER = "-----BEGIN PGP SIGNED MESSAGE-----";

/** The armor line closing the signed body. */
const SIGNATURE_HEADER = "-----BEGIN PGP SIGNATURE-----";

/** One line of the file with its 1-based number in the original text. */
interface Line {
	number: number;
	text: string;
}

/**
 * The lines to read: every line of an unsigned file, or the dash-unescaped signed body
 * of a cleartext-signed one, each keeping its number in the original text.
 *
 * @param text - The served text.
 * @param issues - Where a signature with no body end is reported.
 */
function bodyLines(
	text: string,
	issues: WellKnownParseError.Issue[],
): { lines: Line[]; signed: boolean } {
	let all = text
		.replace(/^﻿/, "")
		.split(/\r?\n/)
		.map((line, index) => ({ number: index + 1, text: line }));

	let start = all.findIndex((line) => line.text.trim() !== "");
	if (all[start]?.text.trim() !== SIGNED_HEADER) return { lines: all, signed: false };

	let headersEnd = all.findIndex((line, index) => index > start && line.text.trim() === "");
	let end = all.findIndex(
		(line, index) => index > headersEnd && line.text.trim() === SIGNATURE_HEADER,
	);
	if (headersEnd === -1 || end === -1) {
		issues.push({
			at: all[start]?.number ?? 0,
			message: "The signed message has no signature block.",
		});
		return { lines: [], signed: true };
	}

	let lines = all.slice(headersEnd + 1, end).map((line) => ({
		...line,
		text: line.text.startsWith("- ") ? line.text.slice(2) : line.text,
	}));
	return { lines, signed: true };
}

/**
 * Reads a URI field's value, enforcing §2.5's rule that a web URI uses `https` and, for
 * the fields that take only a web URI, that it is one.
 *
 * @param value - The field value.
 * @param field - The field name as written.
 * @param httpsOnly - Whether the field takes nothing but an `https` URI.
 * @param line - The line number, for the issue.
 * @param issues - Where problems are collected.
 */
function readUri(
	value: string,
	field: string,
	httpsOnly: boolean,
	line: number,
	issues: WellKnownParseError.Issue[],
): URL | null {
	if (!URL.canParse(value)) {
		issues.push({ at: line, message: `${field} is not a URI.` });
		return null;
	}
	let url = new URL(value);
	if (url.protocol === "http:" || (httpsOnly && url.protocol !== "https:")) {
		issues.push({ at: line, message: `${field} must use https.` });
		return null;
	}
	return url;
}

/**
 * Reads a security.txt file. It fails on a missing `Contact`, a missing or repeated
 * `Expires`, a repeated `Preferred-Languages`, an `http` URI (or a non-`https` one where
 * §2.5 asks for a web URI), and a line that is neither a field, a comment nor blank.
 * An expired file parses; `isExpired` answers staleness.
 *
 * @param text - The served text, signed or not; the signature is left unverified.
 */
export function parse(text: string): Result<ParsedSecurityTxt, WellKnownParseError> {
	let issues: WellKnownParseError.Issue[] = [];
	let { lines, signed } = bodyLines(text, issues);

	let uris: Record<keyof typeof URI_FIELDS, URL[]> = {
		contact: [],
		encryption: [],
		acknowledgments: [],
		canonical: [],
		policy: [],
		hiring: [],
	};
	let expires: Date[] = [];
	let expiresFields = 0;
	let languages: string[][] = [];
	let extensions: Record<string, string[]> = {};

	for (let line of lines) {
		let trimmed = line.text.trim();
		if (trimmed === "" || trimmed.startsWith("#")) continue;

		let match = FIELD_LINE.exec(line.text);
		if (!match) {
			issues.push({ at: line.number, message: "The line is not a field, a comment or blank." });
			continue;
		}
		let field = match[1] ?? "";
		let value = match[2] ?? "";
		let key = field.toLowerCase();

		if (key in URI_FIELDS) {
			let spec = URI_FIELDS[key as keyof typeof URI_FIELDS];
			let url = readUri(value, field, spec.httpsOnly, line.number, issues);
			if (url) uris[spec.key].push(url);
		} else if (key === "expires") {
			expiresFields += 1;
			let date = new Date(value);
			if (DATE_TIME.test(value) && !Number.isNaN(date.getTime())) expires.push(date);
			else issues.push({ at: line.number, message: "Expires is not an RFC 3339 date-time." });
			if (expiresFields > 1)
				issues.push({ at: line.number, message: "Expires appears more than once." });
		} else if (key === "preferred-languages") {
			languages.push(
				value
					.split(",")
					.map((tag) => tag.trim())
					.filter((tag) => tag !== ""),
			);
			if (languages.length > 1) {
				issues.push({ at: line.number, message: "Preferred-Languages appears more than once." });
			}
		} else {
			(extensions[key] ??= []).push(value);
		}
	}

	let [firstContact, ...otherContacts] = uris.contact;
	let [expiry] = expires;
	if (firstContact === undefined) issues.push({ at: 0, message: "The file has no Contact field." });
	if (expiresFields === 0) issues.push({ at: 0, message: "The file has no Expires field." });

	if (issues.length > 0 || firstContact === undefined || expiry === undefined) {
		return failure(new WellKnownParseError(NAME, issues));
	}

	return success({
		contact: [firstContact, ...otherContacts],
		expires: expiry,
		encryption: uris.encryption,
		acknowledgments: uris.acknowledgments,
		preferredLanguages: languages[0] ?? [],
		canonical: uris.canonical,
		policy: uris.policy,
		hiring: uris.hiring,
		extensions,
		signed,
	});
}

/**
 * A field value safe to write on one line, so a value carrying a line break can never
 * start a field of its own.
 *
 * @param value - The value to write.
 */
function oneLine(value: string): string {
	return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * The canonical form of a field name for writing: each hyphenated word capitalized, as
 * RFC 9116 writes its own fields.
 *
 * @param key - A lowercased field name.
 */
function fieldName(key: string): string {
	return key.replace(
		/(^|-)([a-z])/g,
		(_, dash: string, letter: string) => `${dash}${letter.toUpperCase()}`,
	);
}

/**
 * Writes unsigned security.txt text: comments first, then the §2.5 fields, then the
 * extensions, one per line with LF endings. `Expires` is written in UTC to the second.
 *
 * @param document - The fields to publish.
 * @param options - Comment lines to write before the fields.
 * @example
 * stringify({ ...fields, expires: new Date("2027-01-01T00:00:00Z") }, { comments: ["Report issues here"] });
 */
export function stringify(document: SecurityTxt, options: StringifyOptions = {}): string {
	let lines: string[] = [];
	for (let comment of options.comments ?? []) {
		for (let part of comment.split(/\r?\n/)) lines.push(part === "" ? "#" : `# ${part}`);
	}

	let write = (field: string, values: Array<URL | string>) => {
		for (let value of values) lines.push(`${field}: ${oneLine(String(value))}`);
	};

	write("Contact", document.contact);
	lines.push(`Expires: ${document.expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`);
	write("Encryption", document.encryption);
	write("Acknowledgments", document.acknowledgments);
	if (document.preferredLanguages.length > 0) {
		write("Preferred-Languages", [document.preferredLanguages.join(", ")]);
	}
	write("Canonical", document.canonical);
	write("Policy", document.policy);
	write("Hiring", document.hiring);
	for (let [key, values] of Object.entries(document.extensions)) write(fieldName(key), values);

	return `${lines.join("\n")}\n`;
}

/**
 * RFC 9116 §2.5.5: a file past its `Expires` is stale and SHOULD be ignored.
 *
 * @param document - The file's fields.
 * @param now - The moment to judge against.
 */
export function isExpired(document: SecurityTxt, now: Date = new Date()): boolean {
	return document.expires.getTime() <= now.getTime();
}

/** security.txt as a servable format. */
export const securityTxt: WellKnownFormat<SecurityTxt> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: false,
	stringify: (document) => stringify(document),
	parse,
};
