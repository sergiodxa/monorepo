/**
 * Prints typed record data back to canonical presentation format, the inverse of
 * `parseRecordData`, so two spellings of one record (a zone file's text and a resolver's
 * RFC 3597 generic form) print to one string a diff can key on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type * as ZoneFile from "./types.js";

import { absoluteName } from "./names.js";

/** Encodes a character-string into the octets `\DDD` escapes stand for. */
const ENCODER = new TextEncoder();

/**
 * Prints a record's data in canonical presentation format. Names print absolute with the
 * trailing dot (the root stays `"."`), TXT and CAA values print quoted with `"` and `\`
 * escaped and every octet outside printable ASCII as `\DDD`, and untyped data prints as is.
 * `parseRecordData(data.type, formatRecordData(data))` gives back `data`.
 *
 * @param data - Record data, as `parseRecordData` produces it.
 * @returns The RDATA in presentation format.
 * @example formatRecordData({ type: "MX", preference: 10, exchange: "mx.example.com" }) // "10 mx.example.com."
 * @example formatRecordData({ type: "CAA", flags: 0, critical: false, tag: "issue", value: "pki.goog" }) // '0 issue "pki.goog"'
 */
export function formatRecordData(data: ZoneFile.RecordData<ZoneFile.RecordType>): string {
	return printRecordData(data, absoluteName);
}

/**
 * Prints record data with every name written by `printName`, which lets a zone file write
 * names relative to its origin while the data's other fields print as `formatRecordData`
 * prints them.
 *
 * @param data - Typed or untyped record data.
 * @param printName - Writes one canonical name as it appears in the output.
 */
export function printRecordData(
	data: { type: string },
	printName: (name: string) => string,
): string {
	switch (data.type) {
		case "A":
		case "AAAA":
			return (data as ZoneFile.AData).address;
		case "CNAME":
		case "PTR":
		case "DNAME":
			return printName((data as ZoneFile.CNAMEData).target);
		case "NS":
			return printName((data as ZoneFile.NSData).host);
		case "MX": {
			let { preference, exchange } = data as ZoneFile.MXData;
			return `${preference} ${printName(exchange)}`;
		}
		case "TXT": {
			let { strings } = data as ZoneFile.TXTData;
			return strings.length === 0 ? "\\# 0" : strings.map(quote).join(" ");
		}
		case "CAA": {
			let { flags, tag, value } = data as ZoneFile.CAAData;
			return `${flags} ${tag.toLowerCase()} ${quote(value)}`;
		}
		case "SRV": {
			let { priority, weight, port, target } = data as ZoneFile.SRVData;
			return `${priority} ${weight} ${port} ${printName(target)}`;
		}
		case "SOA": {
			let soa = data as ZoneFile.SOAData;
			return [
				printName(soa.primary),
				printName(soa.mailbox),
				soa.serial,
				soa.refresh,
				soa.retry,
				soa.expire,
				soa.minimum,
			].join(" ");
		}
		default:
			return String((data as ZoneFile.UnknownData).data);
	}
}

/**
 * One quoted character-string: `"` and `\` escaped, every octet outside printable ASCII
 * written `\DDD`, so the text reads back to the same UTF-8 whatever the reader's encoding.
 */
function quote(text: string): string {
	let printed = "";
	for (let octet of ENCODER.encode(text)) {
		if (octet === 0x22 || octet === 0x5c) printed += `\\${String.fromCharCode(octet)}`;
		else if (octet >= 0x20 && octet <= 0x7e) printed += String.fromCharCode(octet);
		else printed += `\\${String(octet).padStart(3, "0")}`;
	}
	return `"${printed}"`;
}
