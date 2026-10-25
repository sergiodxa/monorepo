/**
 * Name-based UUIDs (RFC 9562 version 5), computed synchronously so converting a calendar
 * stays a plain function. The iCalendar mapping keys locations, links and participants by
 * the UUIDv5 of their value, so converting the same data twice yields the same keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The namespace the JSCalendar-iCalendar mapping derives its keys in. */
export const MAPPING_NAMESPACE = "7f1e1965-ae73-4454-b088-232c90730ce2";

/**
 * SHA-1 of a byte string. Used only to derive identifiers, where its collision weakness
 * does not matter.
 *
 * @param bytes - The message
 * @returns The 20-byte digest
 */
function sha1(bytes: Uint8Array): Uint8Array {
	let length = bytes.length;
	let padded = new Uint8Array((((length + 8) >> 6) + 1) * 64);
	padded.set(bytes);
	padded[length] = 0x80;
	let view = new DataView(padded.buffer);
	view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
	view.setUint32(padded.length - 4, (length * 8) >>> 0);

	let h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
	let w = new Uint32Array(80);
	for (let offset = 0; offset < padded.length; offset += 64) {
		for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
		for (let i = 16; i < 80; i++) {
			let x =
				(w[i - 3] as number) ^ (w[i - 8] as number) ^ (w[i - 14] as number) ^ (w[i - 16] as number);
			w[i] = (x << 1) | (x >>> 31);
		}
		let [a, b, c, d, e] = h as [number, number, number, number, number];
		for (let i = 0; i < 80; i++) {
			let f: number;
			let k: number;
			if (i < 20) [f, k] = [(b & c) | (~b & d), 0x5a827999];
			else if (i < 40) [f, k] = [b ^ c ^ d, 0x6ed9eba1];
			else if (i < 60) [f, k] = [(b & c) | (b & d) | (c & d), 0x8f1bbcdc];
			else [f, k] = [b ^ c ^ d, 0xca62c1d6];
			let next = (((a << 5) | (a >>> 27)) + f + e + k + (w[i] as number)) >>> 0;
			[e, d, c, b, a] = [d, c, (b << 30) | (b >>> 2), a, next];
		}
		h = [
			((h[0] as number) + a) >>> 0,
			((h[1] as number) + b) >>> 0,
			((h[2] as number) + c) >>> 0,
			((h[3] as number) + d) >>> 0,
			((h[4] as number) + e) >>> 0,
		];
	}
	let digest = new Uint8Array(20);
	let out = new DataView(digest.buffer);
	h.forEach((word, index) => out.setUint32(index * 4, word));
	return digest;
}

/**
 * The version-5 UUID of a name in a namespace.
 *
 * @param namespace - A UUID in its canonical form
 * @param name - The name, hashed as UTF-8
 * @returns The lowercase canonical UUID
 * @example uuidv5(MAPPING_NAMESPACE, "mailto:organizer@example.com"); // "251d3e9f-d83f-534c-8c45-c2896c75670c"
 */
export function uuidv5(namespace: string, name: string): string {
	let hex = namespace.replaceAll("-", "");
	let namespaceBytes = Uint8Array.from({ length: 16 }, (_, i) =>
		Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16),
	);
	let nameBytes = new TextEncoder().encode(name);
	let message = new Uint8Array(16 + nameBytes.length);
	message.set(namespaceBytes);
	message.set(nameBytes, 16);

	let bytes = sha1(message).slice(0, 16);
	bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
	bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
	let text = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}
