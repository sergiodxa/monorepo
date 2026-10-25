/**
 * Covers DS, DNSKEY and their child-side CDS and CDNSKEY copies against the RFC 4034 and
 * RFC 8078 examples, including the key tag that ties a DS to the key it digests, and TLSA
 * against the RFC 6698 examples.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { formatRecordData } from "./format-record-data.js";
import { parseRecordData } from "./parse-record-data.js";
import { parse } from "./parse.js";

/** The key of `dskey.example.com.` in RFC 4034 section 5.4, which the DS beside it digests. */
const DSKEY = `256 3 5 ( AQOeiiR0GOMYkDshWoSKz9Xz
	fwJr1AYtsmx3TGkJaNXVbfi/
	2pHm822aJ5iI9BMzNXxeYCmZ
	DRD99WYwYqUSdjMmmAphXdvx
	egXd/M5+X7OrzKBaMbCVdFLU
	Uh6DhweJBjEVv5f2wwjM9Xzc
	nOf+EPbtG9DMBmADjFDc2w/r
	ljwvFw==
	) ; key id = 60485`;

/** The DS record of RFC 4034 section 5.4. */
const DS = `60485 5 1 ( 2BB183AF5F22588179A53B0A
	98631FAD1A292118 )`;

/** The DNSKEY record of RFC 4034 section 2.3. */
const EXAMPLE_KEY = `256 3 5 ( AQPSKmynfzW4kyBv015MUG2DeIQ3
	Cbl+BBZH4b/0PY1kxkmvHjcZc8no
	kfzj31GajIQKY+5CptLr3buXA10h
	WqTkF7H6RfoRqXQeogmMHfpftf6z
	Mv1LyBUgia7za6ZEzOJBOztyvhjL
	742iU/TpPSEDhm2SNKLijfUppn1U
	aNvv4w== )`;

/** Reads one zone-file line at `example.com` and returns its only record. */
function only(text: string) {
	let zone = unwrap(parse(text, { origin: "example.com" }));
	expect(zone.rejected).toEqual([]);
	let [record] = zone.records;
	if (!record) throw new Error("The zone has no record");
	return record;
}

describe("DS and DNSKEY data", () => {
	test("reads the RFC 4034 section 5.4 DS and the key it names by tag", () => {
		let key = only(`dskey 86400 IN DNSKEY ${DSKEY}`);
		let ds = only(`dskey 86400 IN DS ${DS}`);

		expect(ds).toMatchObject({
			type: "DS",
			keyTag: 60485,
			algorithm: 5,
			digestType: 1,
			digest: "2bb183af5f22588179a53b0a98631fad1a292118",
		});
		expect(key).toMatchObject({
			type: "DNSKEY",
			flags: 256,
			zoneKey: true,
			secureEntryPoint: false,
			protocol: 3,
			algorithm: 5,
			keyTag: 60485,
			publicKey: expect.stringMatching(/^AQOeiiR0GOMY.*ljwvFw==$/),
		});
	});

	test("matches the RFC 4034 DS digest: SHA-1 over the owner and the key's RDATA", async () => {
		let key = unwrap(parseRecordData("DNSKEY", DSKEY.replace(/[();]|key id = \d+/g, "")));
		let encode = (text: string) => new TextEncoder().encode(text);
		let owner = [5, ...encode("dskey"), 7, ...encode("example"), 3, ...encode("com"), 0];
		let publicKey = Uint8Array.from(atob(key.publicKey), (char) => char.charCodeAt(0));
		let signed = Uint8Array.of(
			...owner,
			key.flags >> 8,
			key.flags & 0xff,
			key.protocol,
			key.algorithm,
			...publicKey,
		);
		let digest = new Uint8Array(await crypto.subtle.digest("SHA-1", signed));
		let hex = Array.from(digest, (octet) => octet.toString(16).padStart(2, "0")).join("");
		expect(hex).toBe("2bb183af5f22588179a53b0a98631fad1a292118");
	});

	test("reads the RFC 4034 section 2.3 key and an algorithm mnemonic", () => {
		let key = unwrap(parseRecordData("DNSKEY", EXAMPLE_KEY.replace(/[()]/g, "")));
		expect(key).toMatchObject({ flags: 256, protocol: 3, algorithm: 5 });
		expect(key.publicKey).toBe(
			"AQPSKmynfzW4kyBv015MUG2DeIQ3Cbl+BBZH4b/0PY1kxkmvHjcZc8nokfzj31GajIQKY+5CptLr3buXA10hWqTkF7H6RfoRqXQeogmMHfpftf6zMv1LyBUgia7za6ZEzOJBOztyvhjL742iU/TpPSEDhm2SNKLijfUppn1UaNvv4w==",
		);
		expect(unwrap(parseRecordData("DS", "60485 RSASHA1 1 2BB183AF"))).toMatchObject({
			algorithm: 5,
		});
		expect(formatRecordData(unwrap(parseRecordData("DS", "60485 RSASHA1 1 2BB183AF")))).toBe(
			"60485 5 1 2bb183af",
		);
	});

	test("reads a key-signing key's flags and generic data", () => {
		expect(unwrap(parseRecordData("DNSKEY", "\\# 6 0101 03 0d abcd"))).toEqual({
			type: "DNSKEY",
			flags: 257,
			zoneKey: true,
			secureEntryPoint: true,
			protocol: 3,
			algorithm: 13,
			publicKey: "q80=",
			keyTag: 45019,
		});
		expect(unwrap(parseRecordData("DNSKEY", "257 3 13 q80="))).toEqual(
			unwrap(parseRecordData("DNSKEY", "\\# 6 0101 03 0d abcd")),
		);
		expect(unwrap(parseRecordData("DS", "\\# 8 ebc5 05 01 2bb183af"))).toEqual({
			type: "DS",
			keyTag: 60357,
			algorithm: 5,
			digestType: 1,
			digest: "2bb183af",
		});
	});

	test("reads the RFC 8078 CDS and CDNSKEY delete requests", () => {
		expect(unwrap(parseRecordData("CDS", "0 0 0 00"))).toEqual({
			type: "CDS",
			keyTag: 0,
			algorithm: 0,
			digestType: 0,
			digest: "00",
		});
		expect(unwrap(parseRecordData("CDNSKEY", "0 3 0 AA=="))).toMatchObject({
			type: "CDNSKEY",
			flags: 0,
			zoneKey: false,
			protocol: 3,
			algorithm: 0,
			publicKey: "AA==",
		});
	});

	test.each([
		["DS", "60485 5 1"],
		["DS", "60485 5 1 2BB18"],
		["DS", "60485 5 1 not-hex"],
		["DS", "70000 5 1 2BB1"],
		["DS", "60485 NOPE 1 2BB1"],
		["DNSKEY", "256 3 5"],
		["DNSKEY", "256 3 5 not*base64"],
		["DNSKEY", "\\# 4 0100 03 0d"],
		["CDS", "\\# 4 0000 00 00"],
	])("fails on %s %j", (type, data) => {
		expect(isFailure(parseRecordData(type, data))).toBe(true);
	});
});

describe("TLSA data", () => {
	test("reads the RFC 6698 section 2.3 examples, the association as lowercase hex", () => {
		let full = only(`_443._tcp.www 3600 IN TLSA ( 0 0 1 d2abde240d7cd3ee6b4b28c54df034b9
			7983a1d16e8a410e4561cb106618e971 )`);
		expect(full).toMatchObject({
			name: "_443._tcp.www.example.com",
			type: "TLSA",
			usage: 0,
			selector: 0,
			matchingType: 1,
			certificateAssociation: "d2abde240d7cd3ee6b4b28c54df034b97983a1d16e8a410e4561cb106618e971",
		});

		let sha512 = only(`_443._tcp.www 3600 IN TLSA ( 1 1 2 92003ba34942dc74152e2f2c408d29ec
			a5a520e7f2e06bb944f4dca346baf63c
			1b177615d466f6c4b71c216a50292bd5
			8c9ebdd2f74e38fe51ffd48c43326cbc )`);
		expect(sha512).toMatchObject({ usage: 1, selector: 1, matchingType: 2 });
		expect(formatRecordData(sha512)).toBe(
			"1 1 2 92003ba34942dc74152e2f2c408d29eca5a520e7f2e06bb944f4dca346baf63c1b177615d466f6c4b71c216a50292bd58c9ebdd2f74e38fe51ffd48c43326cbc",
		);
	});

	test("reads generic TLSA data as its presentation form does", () => {
		expect(unwrap(parseRecordData("TLSA", "\\# 5 03 01 01 abcd"))).toEqual(
			unwrap(parseRecordData("TLSA", "3 1 1 ABCD")),
		);
	});

	test.each([["3 1 1"], ["3 1 1 abc"], ["256 1 1 abcd"], ["\\# 3 03 01 01"]])(
		"fails on %j",
		(data) => {
			expect(isFailure(parseRecordData("TLSA", data))).toBe(true);
		},
	);
});
