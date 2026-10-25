/**
 * Tests for ASCII armor: the CRC24 check value, the footer written only on request,
 * the decoder tolerating a missing or wrong footer and stray whitespace, and the packet
 * framer's length encodings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { utf8 } from "./lib/bytes.js";

import { armor, crc24, dearmor, readPackets, writePacket } from "./index.js";

describe("crc24", () => {
	test("matches the CRC-24/OPENPGP check value and initial value", () => {
		expect(crc24(utf8("123456789"))).toBe(0x21cf02);
		expect(crc24(new Uint8Array(0))).toBe(0xb704ce);
	});
});

describe("armor", () => {
	test("round-trips data with headers, and writes the footer only on request", () => {
		let data = Uint8Array.from({ length: 100 }, (_, index) => index);
		let text = armor("signature", data, { headers: [["Comment", "test"]] });
		expect(text).toMatch(/^-----BEGIN PGP SIGNATURE-----\nComment: test\n\n/);
		expect(text).not.toMatch(/^=/m);
		expect(text.endsWith("-----END PGP SIGNATURE-----\n")).toBe(true);
		expect(unwrap(dearmor(text))).toEqual({
			type: "signature",
			headers: [["Comment", "test"]],
			data,
			checksum: "missing",
		});

		let withFooter = armor("public-key", data, { checksum: true });
		expect(unwrap(dearmor(withFooter)).checksum).toBe("valid");
	});

	test("reports a wrong footer without refusing the data", () => {
		let data = utf8("OpenPGP");
		let text = armor("message", data, { checksum: true }).replace(/^=.*$/m, "=AAAA");
		expect(unwrap(dearmor(text))).toMatchObject({ data, checksum: "mismatch" });
	});

	test("skips surrounding text and whitespace inside the body", () => {
		let data = utf8("hello world, this is armored");
		let body = armor("message", data).replace(/\n([A-Za-z0-9+/=]+)\n/, "\n  $1  \n");
		expect(unwrap(dearmor(`Some preamble\n${body}trailing`)).data).toEqual(data);
	});

	test("fails without a tail line or on an unknown label", () => {
		expect(dearmor("-----BEGIN PGP MESSAGE-----\n\nAAAA\n").status).toBe("failure");
		let unknown = dearmor(
			"-----BEGIN PGP ARMORED FILE-----\n\nAAAA\n-----END PGP ARMORED FILE-----\n",
		);
		expect(unknown.status === "failure" && unknown.error.code).toBe("unsupported");
	});
});

describe("packets", () => {
	test("frames 1-, 2- and 5-octet lengths and reads them back", () => {
		for (let length of [0, 191, 192, 1723, 8383, 8384, 100_000]) {
			let body = new Uint8Array(length).fill(7);
			let framed = writePacket(13, body);
			expect(unwrap(readPackets(framed))).toEqual([{ type: 13, body }]);
		}
		expect(writePacket(13, new Uint8Array(1723)).subarray(0, 3)).toEqual(
			Uint8Array.of(0xcd, 0xc5, 0xfb),
		);
	});

	test("joins partial body lengths", () => {
		let body = new Uint8Array(512 + 3).map((_, index) => index & 0xff);
		let stream = Uint8Array.of(0xcb, 0xe9, ...body.subarray(0, 512), 3, ...body.subarray(512));
		expect(unwrap(readPackets(stream))).toEqual([{ type: 11, body }]);
	});

	test("fails on a length past the end", () => {
		let packets = readPackets(Uint8Array.of(0xcd, 10, 1, 2));
		expect(packets.status === "failure" && packets.error.code).toBe("malformed");
	});
});
