/**
 * Writes records as an RFC 1035 master file, one tab-separated line per record, with names
 * absolute by default or relative to the origin, so a zone built in code or read with
 * `parse` prints to text any BIND-compatible tool reads back to the same records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type * as ZoneFile from "./types.js";

import { printRecordData } from "./format-record-data.js";
import { absoluteName, canonicalName, relativeName } from "./names.js";
import { isTypedType } from "./record-types.js";

/**
 * Writes a zone. `$ORIGIN` and `$TTL` lead when the input names them, a record's TTL is
 * left out when it equals `$TTL`, and an untyped record read under another origin gets an
 * `$ORIGIN` line first so the relative names in its verbatim data keep their meaning.
 *
 * For any `zone` that `parse` produced, `parse(stringify(zone))` yields the same records —
 * name, TTL, class, type, fields and comment; spacing, standalone comments and
 * parentheses are not kept.
 *
 * @param zone - The origin, default TTL and records to write.
 * @param options - `relative: true` writes names under the origin relative to it.
 * @returns The zone file, ending in a newline.
 * @example stringify({ origin: "example.com", records: [{ name: "www.example.com", ttl: 300, type: "A", address: "192.0.2.1" }] }, { relative: true }) // "$ORIGIN example.com.\nwww\t300\tIN\tA\t192.0.2.1\n"
 */
export function stringify(
	zone: ZoneFile.ZoneInput,
	options: ZoneFile.StringifyOptions = {},
): string {
	let lines: string[] = [];
	let origin = zone.origin === undefined ? null : canonical(zone.origin);
	let ttl = zone.ttl ?? null;

	if (origin !== null) lines.push(`$ORIGIN ${absoluteName(origin)}`);
	if (ttl !== null) lines.push(`$TTL ${ttl}`);

	for (let record of zone.records) {
		if (!isTypedType(record.type) && "origin" in record && record.origin !== undefined) {
			let recordOrigin = canonical(record.origin);
			if (recordOrigin !== origin) {
				origin = recordOrigin;
				lines.push(`$ORIGIN ${absoluteName(origin)}`);
			}
		}

		let current = origin;
		let printName = (name: string) =>
			options.relative && current !== null
				? relativeName(canonical(name), current)
				: absoluteName(canonical(name));

		let fields = [printName(record.name)];
		if (record.ttl != null && record.ttl !== ttl) fields.push(String(record.ttl));
		fields.push(record.class ?? "IN", record.type, printRecordData(record, printName));

		let line = fields.join("\t");
		if (record.comment) line += ` ; ${record.comment.replace(/[\r\n]+/g, " ")}`;
		lines.push(line);
	}

	return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

/** A name in canonical form, or as given when it is not a valid name. */
function canonical(name: string): string {
	return canonicalName(name) ?? name;
}
