/**
 * Domain names in presentation form (RFC 1035 section 5.1): reads `\.` and `\DDD` escapes
 * into label octets, qualifies relative names against an origin, and prints one canonical
 * spelling, lowercased with every special octet escaped, so equal names compare equal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Encodes literal characters into the octets they stand for. */
const ENCODER = new TextEncoder();

/**
 * Octets printed with a backslash: the label separator, the escape itself, and the
 * characters a zone file reads as syntax (`"`, `$`, `(`, `)`, `;`, `@`).
 */
const SPECIAL_OCTETS = new Set([0x22, 0x24, 0x28, 0x29, 0x2e, 0x3b, 0x40, 0x5c]);

/** The longest label RFC 1035 allows, in octets. */
const MAX_LABEL_OCTETS = 63;

/** The longest name RFC 1035 allows, in wire octets: each label plus its length, plus the root. */
const MAX_NAME_OCTETS = 255;

/** How relative names are read; see `ZoneFile.ParseOptions.relativeNames`. */
export type RelativeNames = "rfc1035" | "origin-suffix";

/** A name read into its labels, and whether a trailing unescaped dot made it absolute. */
interface ReadName {
	labels: Uint8Array[];
	absolute: boolean;
}

/**
 * Reads presentation text into label octets. Fails on an empty label, a label over 63
 * octets, a decimal escape above 255 and a lone trailing backslash.
 */
function readName(text: string): ReadName | null {
	if (text === ".") return { labels: [], absolute: true };

	let chars = Array.from(text);
	let labels: Uint8Array[] = [];
	let label: number[] = [];
	let absolute = false;

	for (let index = 0; index < chars.length; index++) {
		let char = chars[index] ?? "";

		if (char === "\\") {
			let digits = chars.slice(index + 1, index + 4).join("");
			if (/^\d{3}$/.test(digits)) {
				let octet = Number(digits);
				if (octet > 255) return null;
				label.push(octet);
				index += 3;
				continue;
			}
			let next = chars[index + 1];
			if (next === undefined) return null;
			label.push(...ENCODER.encode(next));
			index += 1;
			continue;
		}

		if (char === ".") {
			if (label.length === 0) return null;
			labels.push(Uint8Array.from(label));
			label = [];
			if (index === chars.length - 1) absolute = true;
			continue;
		}

		label.push(...ENCODER.encode(char));
	}

	if (!absolute) {
		if (label.length === 0) return null;
		labels.push(Uint8Array.from(label));
	}

	return labels.every((part) => part.length <= MAX_LABEL_OCTETS) ? { labels, absolute } : null;
}

/** Whether labels fit in the 255 wire octets of one name. */
function fits(labels: Uint8Array[]): boolean {
	return labels.reduce((total, label) => total + label.length + 1, 1) <= MAX_NAME_OCTETS;
}

/** One label in canonical form: ASCII letters lowercased, specials and non-printables escaped. */
function printLabel(label: Uint8Array): string {
	let printed = "";
	for (let octet of label) {
		let folded = octet >= 0x41 && octet <= 0x5a ? octet + 0x20 : octet;
		if (SPECIAL_OCTETS.has(folded)) printed += `\\${String.fromCharCode(folded)}`;
		else if (folded > 0x20 && folded < 0x7f) printed += String.fromCharCode(folded);
		else printed += `\\${String(folded).padStart(3, "0")}`;
	}
	return printed;
}

/**
 * Prints labels as a canonical name without the trailing dot, the root as `"."`. Wire
 * labels from RFC 3597 generic data print through here too, so both spellings agree.
 */
export function printLabels(labels: readonly Uint8Array[]): string {
	return labels.length === 0 ? "." : labels.map(printLabel).join(".");
}

/** The labels of a canonical name, as `canonicalName` prints it. */
function labelsOf(canonical: string): Uint8Array[] {
	return readName(canonical === "." ? "." : `${canonical}.`)?.labels ?? [];
}

/** Whether `labels` end with every label of `suffix`, compared in canonical form. */
function endsWithLabels(labels: Uint8Array[], suffix: Uint8Array[]): boolean {
	if (suffix.length > labels.length) return false;
	let offset = labels.length - suffix.length;
	return suffix.every(
		(label, index) => printLabel(label) === printLabel(labels[offset + index] ?? new Uint8Array()),
	);
}

/**
 * Reads a name as written, absolute or not, into its canonical spelling: lowercased, no
 * trailing dot, the root as `"."`. `null` when the text is not a valid name.
 *
 * @example canonicalName("Mail.Example.COM.") // "mail.example.com"
 * @example canonicalName("a\\065b.example.com") // "aab.example.com"
 */
export function canonicalName(text: string): string | null {
	let name = readName(text);
	return name && fits(name.labels) ? printLabels(name.labels) : null;
}

/**
 * Resolves a name as a zone file writes it to its absolute canonical spelling: `@` is the
 * origin, a trailing dot marks an absolute name, and any other name gets the origin
 * appended. `null` when the text, or the qualified name, is not a valid name.
 *
 * @param text - The name as written.
 * @param origin - The current origin, in canonical form.
 * @param mode - `"origin-suffix"` reads a relative name already ending in the origin as absolute.
 * @example qualifyName("www", "example.com", "rfc1035") // "www.example.com"
 */
export function qualifyName(text: string, origin: string, mode: RelativeNames): string | null {
	if (text === "@") return origin;

	let name = readName(text);
	if (!name) return null;
	if (name.absolute) return fits(name.labels) ? printLabels(name.labels) : null;

	let originLabels = labelsOf(origin);
	if (mode === "origin-suffix" && originLabels.length > 0) {
		if (endsWithLabels(name.labels, originLabels)) return printLabels(name.labels);
	}

	let labels = [...name.labels, ...originLabels];
	return fits(labels) ? printLabels(labels) : null;
}

/**
 * Writes a canonical name relative to `origin` when it is the origin (`@`) or below it, and
 * absolute with its trailing dot otherwise.
 *
 * @example relativeName("www.example.com", "example.com") // "www"
 * @example relativeName("example.net", "example.com") // "example.net."
 */
export function relativeName(name: string, origin: string): string {
	if (name === origin) return "@";
	let labels = labelsOf(name);
	let originLabels = labelsOf(origin);
	if (labels.length > originLabels.length && endsWithLabels(labels, originLabels))
		return printLabels(labels.slice(0, labels.length - originLabels.length));
	return absoluteName(name);
}

/**
 * Writes a name absolute: the trailing dot added unless it is the root or already ends in
 * an unescaped dot.
 *
 * @example absoluteName("mx.example.com") // "mx.example.com."
 */
export function absoluteName(name: string): string {
	let trailing = /(\\*)\.$/.exec(name);
	let absolute = name === "." || (trailing !== null && (trailing[1] ?? "").length % 2 === 0);
	return absolute ? name : `${name}.`;
}
