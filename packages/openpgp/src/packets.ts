/**
 * Packet framing (RFC 9580 §4.2): splits a binary OpenPGP stream into typed packet
 * bodies and writes them back, reading both header formats and every length encoding
 * while writing only the current format with definite lengths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import { OpenPgpError } from "./errors.js";
import { Reader, u32 } from "./lib/bytes.js";

/** One packet: its type ID and body, header removed and partial lengths joined. */
export interface Packet {
	type: number;
	body: Bytes;
}

/**
 * A packet's body length in the current format: 1, 2 or 5 octets (§4.2.1).
 *
 * @param length - The body length in octets.
 */
export function encodeLength(length: number): Bytes {
	if (length < 192) return Uint8Array.of(length);
	if (length < 8384) {
		let value = length - 192;
		return Uint8Array.of((value >> 8) + 192, value & 0xff);
	}
	return concatBytes(Uint8Array.of(0xff), u32(length));
}

/**
 * Frames a body as one packet in the current format with a definite length.
 *
 * @param type - The packet type ID.
 * @param body - The packet body.
 * @example
 * writePacket(PACKET_TYPE.userId, utf8("Alice <alice@example.com>"));
 */
export function writePacket(type: number, body: Uint8Array): Bytes {
	return concatBytes(Uint8Array.of(0xc0 | type), encodeLength(body.length), body);
}

/**
 * Reads one current-format body, joining partial-length chunks (§4.2.1.4).
 *
 * @param reader - Positioned after the header octet.
 */
function readCurrentBody(reader: Reader): Bytes {
	let chunks: Uint8Array[] = [];
	while (!reader.overrun) {
		let first = reader.u8();
		if (first < 192) return concatBytes(...chunks, reader.take(first));
		if (first < 224)
			return concatBytes(...chunks, reader.take(((first - 192) << 8) + reader.u8() + 192));
		if (first === 255) return concatBytes(...chunks, reader.take(reader.u32()));
		chunks.push(reader.take(1 << (first & 0x1f)));
	}
	return new Uint8Array(0);
}

/**
 * Reads one legacy-format body (§4.2.2), where the header's low bits give the length
 * width and 3 means the packet runs to the end of the stream.
 *
 * @param reader - Positioned after the header octet.
 * @param lengthType - Bits 1-0 of the header octet.
 */
function readLegacyBody(reader: Reader, lengthType: number): Bytes {
	if (lengthType === 0) return reader.take(reader.u8());
	if (lengthType === 1) return reader.take(reader.u16());
	if (lengthType === 2) return reader.take(reader.u32());
	return reader.rest();
}

/**
 * Splits a binary stream into packets. A header without bit 7, a length running past the
 * end, or an empty stream fails the whole read, since every later boundary depends on it.
 *
 * @param bytes - Binary OpenPGP data, such as a dearmored key or signature.
 * @example
 * let packets = readPackets(dearmored.data);
 */
export function readPackets(bytes: Uint8Array): Result<Packet[], OpenPgpError> {
	let reader = new Reader(Uint8Array.from(bytes));
	let packets: Packet[] = [];
	while (reader.remaining > 0) {
		let header = reader.u8();
		if ((header & 0x80) === 0) {
			return failure(
				new OpenPgpError("malformed", `Octet ${reader.offset - 1} is not a packet header.`),
			);
		}
		let current = (header & 0x40) !== 0;
		let type = current ? header & 0x3f : (header >> 2) & 0x0f;
		let body = current ? readCurrentBody(reader) : readLegacyBody(reader, header & 0x03);
		if (reader.overrun) {
			return failure(
				new OpenPgpError("malformed", `A type ${type} packet runs past the end of the data.`),
			);
		}
		packets.push({ type, body: Uint8Array.from(body) });
	}
	if (packets.length === 0)
		return failure(new OpenPgpError("malformed", "The data holds no packets."));
	return success(packets);
}
