/**
 * Prints typed record data back to canonical presentation format, the inverse of
 * `parseRecordData`, so two spellings of one record (a zone file's text and a resolver's
 * RFC 3597 generic form) print to one string a diff can key on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DoH } from "./types.js";

/** Encodes a character-string into the octets `\DDD` escapes stand for. */
const ENCODER = new TextEncoder();

/**
 * Prints a record's data in canonical presentation format. Names print absolute with the
 * trailing dot (the root stays `"."`), TXT and CAA values print quoted with `"` and `\`
 * escaped and every octet outside printable ASCII as `\DDD`, and untyped data prints as is.
 * `parseRecordData(data.type, formatRecordData(data))` gives back `data`.
 *
 * @param data - Record data, as `parseRecordData` or `resolve` produce it.
 * @returns The RDATA in presentation format.
 * @template Type - The record type.
 * @example formatRecordData({ type: "MX", preference: 10, exchange: "mx.example.com" }) // "10 mx.example.com."
 * @example formatRecordData({ type: "CAA", flags: 0, critical: false, tag: "issue", value: "pki.goog" }) // '0 issue "pki.goog"'
 */
export function formatRecordData<Type extends DoH.RecordType>(
	data: DoH.RecordData<Type> & { type: Type },
): string {
	let record = data as { type: string };
	switch (record.type) {
		case "A":
		case "AAAA": {
			let { address } = record as DoH.RecordData<"A">;
			return address;
		}
		case "CNAME":
			return absoluteName((record as DoH.RecordData<"CNAME">).target);
		case "NS":
			return absoluteName((record as DoH.RecordData<"NS">).host);
		case "MX": {
			let { preference, exchange } = record as DoH.RecordData<"MX">;
			return `${preference} ${absoluteName(exchange)}`;
		}
		case "TXT":
			return (record as DoH.RecordData<"TXT">).strings.map(quote).join(" ");
		case "CAA": {
			let { flags, tag, value } = record as DoH.RecordData<"CAA">;
			return `${flags} ${tag.toLowerCase()} ${quote(value)}`;
		}
		case "SRV": {
			let { priority, weight, port, target } = record as DoH.RecordData<"SRV">;
			return `${priority} ${weight} ${port} ${absoluteName(target)}`;
		}
		case "SOA": {
			let soa = record as DoH.RecordData<"SOA">;
			return [
				absoluteName(soa.primary),
				absoluteName(soa.mailbox),
				soa.serial,
				soa.refresh,
				soa.retry,
				soa.expire,
				soa.minimum,
			].join(" ");
		}
		default:
			return String((record as DoH.RecordData<"HTTPS">).data);
	}
}

/** A name in absolute form: the trailing dot added, the root kept as `"."`. */
function absoluteName(name: string): string {
	return name === "." || name.endsWith(".") ? name : `${name}.`;
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
