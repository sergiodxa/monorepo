/**
 * Hex and base64 codecs for the binary fields of DNSSEC, DANE and SVCB records, which the
 * presentation format writes as text a zone file may split across whitespace and lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Hex text in pairs, with any whitespace between digits already removed. */
const HEX_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;

/** Canonical base64: complete quads, padding only at the end. */
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** The octets a hex string spells, whitespace ignored; `null` for an odd or non-hex run, or none. */
export function decodeHex(text: string): Uint8Array | null {
	let hex = text.replace(/\s+/g, "");
	if (!HEX_PATTERN.test(hex)) return null;
	let octets = new Uint8Array(hex.length / 2);
	for (let index = 0; index < octets.length; index++)
		octets[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	return octets;
}

/** Octets as lowercase hex, the spelling DS digests and TLSA data compare in. */
export function encodeHex(octets: Uint8Array): string {
	return Array.from(octets, (octet) => octet.toString(16).padStart(2, "0")).join("");
}

/** The octets a base64 string spells, whitespace ignored; `null` for text that is not base64, or none. */
export function decodeBase64(text: string): Uint8Array | null {
	let base64 = text.replace(/\s+/g, "");
	if (base64.length === 0 || !BASE64_PATTERN.test(base64)) return null;
	let binary = atob(base64);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Octets as padded base64, the spelling DNSKEY keys and SVCB `ech` print in. */
export function encodeBase64(octets: Uint8Array): string {
	return btoa(Array.from(octets, (octet) => String.fromCharCode(octet)).join(""));
}
