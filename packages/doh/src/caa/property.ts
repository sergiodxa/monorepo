/**
 * Reads what one CAA record asks of a CA: the issuer and parameters of an `issue` or
 * `issuewild` value under RFC 8659 §4.2's grammar, the report URL of an `iodef`, and any
 * other tag kept as is, so a policy decision works on meanings instead of strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CAA } from "./types.js";

/** RFC 8659 §4.2's `label`, which is also the grammar of a parameter `tag`. */
const LABEL = "[A-Za-z0-9](?:-*[A-Za-z0-9])*";

/** One `tag = value` parameter; a value is any printable ASCII but space and `;`. */
const PARAMETER = `${LABEL}[ \\t]*=[ \\t]*[\\x21-\\x3A\\x3C-\\x7E]*`;

/**
 * The whole `issue-value`: an optional issuer domain (a trailing dot tolerated), then an
 * optional `;` with an optional parameter list. Group 1 is the domain, group 2 the list.
 */
const ISSUE_VALUE = new RegExp(
	`^[ \\t]*(?:(${LABEL}(?:\\.${LABEL})*)\\.?[ \\t]*)?` +
		`(?:;[ \\t]*(?:(${PARAMETER}(?:[ \\t]*;[ \\t]*${PARAMETER})*)[ \\t]*)?)?$`,
);

/** The URL schemes RFC 8659 §4.4 allows an `iodef` to report to. */
const IODEF_SCHEMES = new Set(["mailto:", "http:", "https:"]);

/**
 * Reads what one CAA record asks of a CA. An `issue` value that fails the grammar reads
 * as `issuer: null, malformed: true`, which forbids issuance as RFC 8659 says it does;
 * issuers are lowercased without a trailing dot, parameters are kept as written.
 *
 * @param record - The record's data, from `resolve` or `parseRecordData`.
 * @returns The property, with `kind: "unknown"` for any tag other than `issue`, `issuewild` and `iodef`.
 * @example parseCaaProperty({ type: "CAA", flags: 0, critical: false, tag: "issue", value: ";" }) // { kind: "issue", critical: false, issuer: null, malformed: false, parameters: [] }
 */
export function parseCaaProperty(record: CAA.Record): CAA.Property {
	let tag = record.tag.toLowerCase();
	let critical = record.critical;

	if (tag === "issue" || tag === "issuewild") {
		return { kind: tag, critical, ...readIssueValue(record.value) };
	}
	if (tag === "iodef") return { kind: "iodef", critical, url: readIodefUrl(record.value) };
	return { kind: "unknown", critical, tag, value: record.value };
}

/** The issuer and parameters of an `issue` value, or the malformed reading when the grammar fails. */
function readIssueValue(value: string): Omit<CAA.IssueProperty, "kind" | "critical"> {
	let match = ISSUE_VALUE.exec(value);
	if (!match) return { issuer: null, malformed: true, parameters: [] };

	let parameters = (match[2] ?? "")
		.split(";")
		.filter((parameter) => parameter.trim().length > 0)
		.map((parameter) => {
			let separator = parameter.indexOf("=");
			return {
				key: parameter.slice(0, separator).trim(),
				value: parameter.slice(separator + 1).trim(),
			};
		});

	return { issuer: match[1]?.toLowerCase() ?? null, malformed: false, parameters };
}

/** The `iodef` value when it is a URL in one of RFC 8659's schemes, `null` otherwise. */
function readIodefUrl(value: string): string | null {
	let trimmed = value.trim();
	let url = URL.parse(trimmed);
	return url && IODEF_SCHEMES.has(url.protocol) ? trimmed : null;
}
