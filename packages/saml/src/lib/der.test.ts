/**
 * Exercises the DER reader and writer against the encodings a real certificate
 * uses — long-form lengths, both time forms, nested names — and closes the loop
 * by building a self-signed certificate, signing it with a live RSA key, and
 * reading it back into a key Web Crypto imports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { DerValue } from "./der.js";

import {
	buildCertificate,
	buildTbsCertificate,
	encodeSequence,
	encodeValue,
	readCertificate,
	readChildren,
	readValue,
} from "./der.js";

/** Universal INTEGER. */
const TAG_INTEGER = 0x02;

/** Universal OBJECT IDENTIFIER. */
const TAG_OID = 0x06;

/** Universal UTF8String. */
const TAG_UTF8_STRING = 0x0c;

/** Universal PrintableString, which is what most real certificates write names in. */
const TAG_PRINTABLE_STRING = 0x13;

/** Universal UTCTime. */
const TAG_UTC_TIME = 0x17;

/** Universal GeneralizedTime. */
const TAG_GENERALIZED_TIME = 0x18;

/** Universal SEQUENCE. */
const TAG_SEQUENCE = 0x30;

/** Universal SET. */
const TAG_SET = 0x31;

/** Context-specific `[0]`, constructed. */
const TAG_VERSION = 0xa0;

/** Universal BIT STRING. */
const TAG_BIT_STRING = 0x03;

/** id-at-commonName, 2.5.4.3. */
const OID_COMMON_NAME = Uint8Array.of(0x55, 0x04, 0x03);

/** id-at-organizationName, 2.5.4.10, which stands in for an attribute the reader skips. */
const OID_ORGANIZATION = Uint8Array.of(0x55, 0x04, 0x0a);

/** id-ecPublicKey, 1.2.840.10045.2.1. */
const OID_EC = Uint8Array.of(0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01);

/** Curve OIDs keyed by the name Web Crypto imports them under. */
const CURVE_OIDS = {
	"P-256": Uint8Array.of(0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07),
	"P-384": Uint8Array.of(0x2b, 0x81, 0x04, 0x00, 0x22),
	"P-521": Uint8Array.of(0x2b, 0x81, 0x04, 0x00, 0x23),
} as const;

/** rsaEncryption, 1.2.840.113549.1.1.1. */
const OID_RSA = Uint8Array.of(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01);

/** UTF-8 encoder for the string values the fixtures carry. */
const ENCODER = new TextEncoder();

/** Takes the member at `index`, so an assertion reads a value rather than a possibly-absent one. */
function memberAt(values: DerValue[], index: number): DerValue {
	let value = values[index];
	if (value === undefined) throw new Error(`Expected a DER member at index ${index}`);
	return value;
}

/** Writes an attribute type and value pair, the leaf of a distinguished name. */
function attribute(oid: Uint8Array, tag: number, value: string): Bytes {
	return encodeValue(
		TAG_SET,
		encodeSequence(encodeValue(TAG_OID, oid), encodeValue(tag, ENCODER.encode(value))),
	);
}

/** Writes a SubjectPublicKeyInfo whose key bits are filler, since only its algorithm is read. */
function spkiFor(oid: Uint8Array, parameters?: Uint8Array): Bytes {
	let identifier =
		parameters === undefined
			? encodeSequence(encodeValue(TAG_OID, oid))
			: encodeSequence(encodeValue(TAG_OID, oid), encodeValue(TAG_OID, parameters));

	return encodeSequence(identifier, encodeValue(TAG_BIT_STRING, Uint8Array.of(0x00, 0x01, 0x02)));
}

/** Assembles a certificate whose validity and names the caller chooses, for the read path alone. */
function certificateFor(options: {
	serial: Uint8Array;
	issuer: Uint8Array;
	subject: Uint8Array;
	notBefore: Uint8Array;
	notAfter: Uint8Array;
	spki: Uint8Array;
}): Bytes {
	return encodeSequence(
		encodeSequence(
			encodeValue(TAG_VERSION, encodeValue(TAG_INTEGER, Uint8Array.of(2))),
			encodeValue(TAG_INTEGER, options.serial),
			encodeSequence(encodeValue(TAG_OID, OID_RSA)),
			options.issuer,
			encodeSequence(options.notBefore, options.notAfter),
			options.subject,
			options.spki,
		),
		encodeSequence(encodeValue(TAG_OID, OID_RSA)),
		encodeValue(TAG_BIT_STRING, Uint8Array.of(0x00, 0xaa)),
	);
}

/** Builds a certificate that differs from a plain RSA one only in its public key. */
function certificateWithKey(spki: Uint8Array): Bytes {
	return certificateFor({
		serial: Uint8Array.of(0x01),
		issuer: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Issuer")),
		subject: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Subject")),
		notBefore: encodeValue(TAG_UTC_TIME, ENCODER.encode("260101000000Z")),
		notAfter: encodeValue(TAG_UTC_TIME, ENCODER.encode("270101000000Z")),
		spki,
	});
}

/** Builds a certificate whose validity window the caller writes directly. */
function certificateWithValidity(notBefore: Uint8Array, notAfter: Uint8Array): Bytes {
	return certificateFor({
		serial: Uint8Array.of(0x01),
		issuer: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Issuer")),
		subject: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Subject")),
		notBefore,
		notAfter,
		spki: spkiFor(OID_RSA),
	});
}

describe("readValue", () => {
	test("reads a short-form value and reports where it ends", () => {
		let buffer = Uint8Array.of(0x02, 0x03, 0x01, 0x02, 0x03, 0xff);
		let value = unwrap(readValue(buffer));

		expect(value.tag).toBe(TAG_INTEGER);
		expect([...value.content]).toEqual([0x01, 0x02, 0x03]);
		expect([...value.bytes]).toEqual([0x02, 0x03, 0x01, 0x02, 0x03]);
		expect(value.end).toBe(5);
	});

	test("reads from an offset inside the buffer", () => {
		let buffer = Uint8Array.of(0xff, 0xff, 0x02, 0x01, 0x07);
		let value = unwrap(readValue(buffer, 2));

		expect(value.tag).toBe(TAG_INTEGER);
		expect([...value.content]).toEqual([0x07]);
		expect(value.end).toBe(5);
	});

	test("round-trips a value over 127 bytes through the two-octet long form", () => {
		let content = new Uint8Array(200).fill(0x5a);
		let encoded = encodeValue(0x04, content);

		expect([...encoded.subarray(0, 3)]).toEqual([0x04, 0x81, 200]);

		let value = unwrap(readValue(encoded));
		expect(value.content.length).toBe(200);
		expect(value.end).toBe(encoded.length);
	});

	test("round-trips a value over 255 bytes through the three-octet long form", () => {
		let content = new Uint8Array(300).fill(0x17);
		let encoded = encodeValue(0x04, content);

		expect([...encoded.subarray(0, 4)]).toEqual([0x04, 0x82, 0x01, 0x2c]);

		let value = unwrap(readValue(encoded));
		expect(value.content.length).toBe(300);
		expect([...value.content.subarray(0, 2)]).toEqual([0x17, 0x17]);
	});

	test("refuses the indefinite length form", () => {
		let result = readValue(Uint8Array.of(0x30, 0x80, 0x00, 0x00));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("DER indefinite length form is unsupported");
		}
	});

	test("refuses a length that runs past the buffer", () => {
		let result = readValue(Uint8Array.of(0x04, 0x10, 0x01, 0x02));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("DER value runs past the end of the buffer");
		}
	});

	test("refuses a truncated TLV", () => {
		expect(isFailure(readValue(Uint8Array.of(0x04)))).toBe(true);
		expect(isFailure(readValue(new Uint8Array(0)))).toBe(true);
		expect(isFailure(readValue(Uint8Array.of(0x04, 0x82, 0x01)))).toBe(true);
	});

	test("refuses a length spanning more than four octets", () => {
		let result = readValue(Uint8Array.of(0x04, 0x85, 0, 0, 0, 0, 1, 0));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("DER length is too long to read");
	});

	test("refuses the high tag number form", () => {
		let result = readValue(Uint8Array.of(0x1f, 0x01, 0x01, 0x00));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("DER high tag number form is unsupported");
		}
	});
});

describe("readChildren", () => {
	test("reads every member of a sequence in order", () => {
		let encoded = encodeSequence(
			encodeValue(TAG_INTEGER, Uint8Array.of(0x01)),
			encodeValue(TAG_INTEGER, Uint8Array.of(0x02)),
			encodeValue(TAG_OID, OID_COMMON_NAME),
		);

		let children = unwrap(readChildren(unwrap(readValue(encoded))));

		expect(children.map((child) => child.tag)).toEqual([TAG_INTEGER, TAG_INTEGER, TAG_OID]);
		expect([...memberAt(children, 2).content]).toEqual([...OID_COMMON_NAME]);
	});

	test("reads an empty sequence as no members", () => {
		let children = unwrap(readChildren(unwrap(readValue(encodeSequence()))));

		expect(children).toEqual([]);
	});

	test("refuses a primitive value", () => {
		let result = readChildren(unwrap(readValue(encodeValue(TAG_INTEGER, Uint8Array.of(1)))));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("DER value is not constructed");
	});

	test("propagates a member that cannot be read", () => {
		let broken = encodeValue(TAG_SEQUENCE, Uint8Array.of(0x04, 0x10, 0x01));

		expect(isFailure(readChildren(unwrap(readValue(broken))))).toBe(true);
	});
});

describe("readCertificate times", () => {
	test("reads a UTCTime year below the pivot as the twenty-first century", () => {
		let fields = unwrap(
			readCertificate(
				certificateWithValidity(
					encodeValue(TAG_UTC_TIME, ENCODER.encode("490102030405Z")),
					encodeValue(TAG_UTC_TIME, ENCODER.encode("491231235959Z")),
				),
			),
		);

		expect(fields.notBefore.toISOString()).toBe("2049-01-02T03:04:05.000Z");
		expect(fields.notAfter.toISOString()).toBe("2049-12-31T23:59:59.000Z");
	});

	test("reads a UTCTime year at or above the pivot as the twentieth century", () => {
		let fields = unwrap(
			readCertificate(
				certificateWithValidity(
					encodeValue(TAG_UTC_TIME, ENCODER.encode("500101000000Z")),
					encodeValue(TAG_UTC_TIME, ENCODER.encode("991231235959Z")),
				),
			),
		);

		expect(fields.notBefore.toISOString()).toBe("1950-01-01T00:00:00.000Z");
		expect(fields.notAfter.toISOString()).toBe("1999-12-31T23:59:59.000Z");
	});

	test("reads a UTCTime written without seconds", () => {
		let fields = unwrap(
			readCertificate(
				certificateWithValidity(
					encodeValue(TAG_UTC_TIME, ENCODER.encode("2601020304Z")),
					encodeValue(TAG_UTC_TIME, ENCODER.encode("2701020304Z")),
				),
			),
		);

		expect(fields.notBefore.toISOString()).toBe("2026-01-02T03:04:00.000Z");
	});

	test("reads a GeneralizedTime with its four-digit year", () => {
		let fields = unwrap(
			readCertificate(
				certificateWithValidity(
					encodeValue(TAG_GENERALIZED_TIME, ENCODER.encode("20260102030405Z")),
					encodeValue(TAG_GENERALIZED_TIME, ENCODER.encode("21001231235959Z")),
				),
			),
		);

		expect(fields.notBefore.toISOString()).toBe("2026-01-02T03:04:05.000Z");
		expect(fields.notAfter.toISOString()).toBe("2100-12-31T23:59:59.000Z");
	});

	test("reads a GeneralizedTime written without seconds", () => {
		let fields = unwrap(
			readCertificate(
				certificateWithValidity(
					encodeValue(TAG_GENERALIZED_TIME, ENCODER.encode("202601020304Z")),
					encodeValue(TAG_GENERALIZED_TIME, ENCODER.encode("210012312359Z")),
				),
			),
		);

		expect(fields.notBefore.toISOString()).toBe("2026-01-02T03:04:00.000Z");
	});

	test("refuses a time carrying a zone offset", () => {
		let result = readCertificate(
			certificateWithValidity(
				encodeValue(TAG_UTC_TIME, ENCODER.encode("260102030405+0200")),
				encodeValue(TAG_UTC_TIME, ENCODER.encode("270102030405Z")),
			),
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Certificate time is not a supported UTC form");
		}
	});
});

describe("readCertificate names", () => {
	test("reads the common name out of a single-attribute name", () => {
		let fields = unwrap(
			readCertificate(
				certificateFor({
					serial: Uint8Array.of(0x01),
					issuer: encodeSequence(attribute(OID_COMMON_NAME, TAG_PRINTABLE_STRING, "Example CA")),
					subject: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "idp.example.com")),
					notBefore: encodeValue(TAG_UTC_TIME, ENCODER.encode("260101000000Z")),
					notAfter: encodeValue(TAG_UTC_TIME, ENCODER.encode("270101000000Z")),
					spki: spkiFor(OID_RSA),
				}),
			),
		);

		expect(fields.issuer).toBe("Example CA");
		expect(fields.subject).toBe("idp.example.com");
	});

	test("takes the last common name when a name carries several", () => {
		let fields = unwrap(
			readCertificate(
				certificateFor({
					serial: Uint8Array.of(0x01),
					issuer: encodeSequence(
						attribute(OID_ORGANIZATION, TAG_UTF8_STRING, "Example Inc"),
						attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Root"),
						attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Intermediate"),
					),
					subject: encodeSequence(attribute(OID_ORGANIZATION, TAG_UTF8_STRING, "Example Inc")),
					notBefore: encodeValue(TAG_UTC_TIME, ENCODER.encode("260101000000Z")),
					notAfter: encodeValue(TAG_UTC_TIME, ENCODER.encode("270101000000Z")),
					spki: spkiFor(OID_RSA),
				}),
			),
		);

		expect(fields.issuer).toBe("Intermediate");
	});

	test("reads a name carrying no common name as an empty string", () => {
		let fields = unwrap(
			readCertificate(
				certificateFor({
					serial: Uint8Array.of(0x01),
					issuer: encodeSequence(),
					subject: encodeSequence(attribute(OID_ORGANIZATION, TAG_UTF8_STRING, "Example Inc")),
					notBefore: encodeValue(TAG_UTC_TIME, ENCODER.encode("260101000000Z")),
					notAfter: encodeValue(TAG_UTC_TIME, ENCODER.encode("270101000000Z")),
					spki: spkiFor(OID_RSA),
				}),
			),
		);

		expect(fields.issuer).toBe("");
		expect(fields.subject).toBe("");
	});

	test("decodes a non-ASCII common name as UTF-8", () => {
		let fields = unwrap(
			readCertificate(
				certificateFor({
					serial: Uint8Array.of(0x01),
					issuer: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Ünïcodé CA")),
					subject: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Sergio Xalambrí")),
					notBefore: encodeValue(TAG_UTC_TIME, ENCODER.encode("260101000000Z")),
					notAfter: encodeValue(TAG_UTC_TIME, ENCODER.encode("270101000000Z")),
					spki: spkiFor(OID_RSA),
				}),
			),
		);

		expect(fields.issuer).toBe("Ünïcodé CA");
		expect(fields.subject).toBe("Sergio Xalambrí");
	});
});

describe("readCertificate keys", () => {
	test("names an RSA key", () => {
		let fields = unwrap(readCertificate(certificateWithKey(spkiFor(OID_RSA))));

		expect(fields.algorithm).toEqual({ kind: "RSA" });
	});

	test.each(["P-256", "P-384", "P-521"] as const)("names the %s curve", (curve) => {
		let fields = unwrap(readCertificate(certificateWithKey(spkiFor(OID_EC, CURVE_OIDS[curve]))));

		expect(fields.algorithm).toEqual({ kind: "EC", curve });
	});

	test("refuses an algorithm it cannot import", () => {
		let result = readCertificate(certificateWithKey(spkiFor(Uint8Array.of(0x2b, 0x65, 0x70))));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Unsupported public key algorithm");
		}
	});

	test("refuses a curve it cannot import", () => {
		let result = readCertificate(
			certificateWithKey(spkiFor(OID_EC, Uint8Array.of(0x2b, 0x81, 0x04, 0x00, 0x0a))),
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("Unsupported public key curve");
	});

	test("hands the whole SubjectPublicKeyInfo TLV back", () => {
		let spki = spkiFor(OID_RSA);
		let fields = unwrap(readCertificate(certificateWithKey(spki)));

		expect([...fields.spki]).toEqual([...spki]);
	});
});

describe("readCertificate structure", () => {
	test("reads a certificate written without the explicit version tag", () => {
		let der = encodeSequence(
			encodeSequence(
				encodeValue(TAG_INTEGER, Uint8Array.of(0x2a)),
				encodeSequence(encodeValue(TAG_OID, OID_RSA)),
				encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Legacy CA")),
				encodeSequence(
					encodeValue(TAG_UTC_TIME, ENCODER.encode("260101000000Z")),
					encodeValue(TAG_UTC_TIME, ENCODER.encode("270101000000Z")),
				),
				encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Legacy Leaf")),
				spkiFor(OID_RSA),
			),
			encodeSequence(encodeValue(TAG_OID, OID_RSA)),
			encodeValue(TAG_BIT_STRING, Uint8Array.of(0x00, 0xaa)),
		);

		let fields = unwrap(readCertificate(der));

		expect(fields.issuer).toBe("Legacy CA");
		expect(fields.subject).toBe("Legacy Leaf");
		expect(fields.serial).toBe("2A");
	});

	test("reports the serial as uppercase hex, sign padding included", () => {
		let fields = unwrap(
			readCertificate(
				certificateFor({
					serial: Uint8Array.of(0x00, 0xde, 0xad, 0xbe, 0xef),
					issuer: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "CA")),
					subject: encodeSequence(attribute(OID_COMMON_NAME, TAG_UTF8_STRING, "Leaf")),
					notBefore: encodeValue(TAG_UTC_TIME, ENCODER.encode("260101000000Z")),
					notAfter: encodeValue(TAG_UTC_TIME, ENCODER.encode("270101000000Z")),
					spki: spkiFor(OID_RSA),
				}),
			),
		);

		expect(fields.serial).toBe("00DEADBEEF");
	});

	test("refuses a certificate that is not a SEQUENCE", () => {
		let result = readCertificate(encodeValue(TAG_INTEGER, Uint8Array.of(0x01)));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("Certificate is not a SEQUENCE");
	});

	test("refuses a tbsCertificate missing its later fields", () => {
		let result = readCertificate(
			encodeSequence(
				encodeSequence(encodeValue(TAG_INTEGER, Uint8Array.of(0x01))),
				encodeSequence(encodeValue(TAG_OID, OID_RSA)),
				encodeValue(TAG_BIT_STRING, Uint8Array.of(0x00, 0xaa)),
			),
		);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Certificate is missing a required field");
		}
	});
});

describe("buildTbsCertificate", () => {
	/** Valid input every refusal test varies one field of. */
	function baseInput() {
		return {
			spki: spkiFor(OID_RSA),
			commonName: "sp.example.com",
			serial: Uint8Array.of(0x01, 0x02),
			notBefore: new Date("2026-01-01T00:00:00.000Z"),
			notAfter: new Date("2027-01-01T00:00:00.000Z"),
		};
	}

	test("writes a v3 certificate carrying the version, both names and no extensions", () => {
		let tbs = unwrap(buildTbsCertificate(baseInput()));
		let fields = unwrap(readChildren(unwrap(readValue(tbs))));

		expect(fields.map((field) => field.tag)).toEqual([
			TAG_VERSION,
			TAG_INTEGER,
			TAG_SEQUENCE,
			TAG_SEQUENCE,
			TAG_SEQUENCE,
			TAG_SEQUENCE,
			TAG_SEQUENCE,
		]);

		let version = unwrap(readChildren(memberAt(fields, 0)));
		expect([...memberAt(version, 0).content]).toEqual([2]);
	});

	test("writes the validity window as GeneralizedTime", () => {
		let tbs = unwrap(buildTbsCertificate(baseInput()));
		let fields = unwrap(readChildren(unwrap(readValue(tbs))));
		let validity = unwrap(readChildren(memberAt(fields, 4)));

		expect(validity.map((value) => value.tag)).toEqual([
			TAG_GENERALIZED_TIME,
			TAG_GENERALIZED_TIME,
		]);
		expect(new TextDecoder().decode(memberAt(validity, 0).content)).toBe("20260101000000Z");
	});

	test("pads a serial whose high bit is set so the INTEGER stays positive", () => {
		let tbs = unwrap(buildTbsCertificate({ ...baseInput(), serial: Uint8Array.of(0x80, 0x01) }));
		let fields = unwrap(readChildren(unwrap(readValue(tbs))));

		expect([...memberAt(fields, 1).content]).toEqual([0x00, 0x80, 0x01]);
	});

	test("leaves a serial whose high bit is clear untouched", () => {
		let tbs = unwrap(buildTbsCertificate({ ...baseInput(), serial: Uint8Array.of(0x7f, 0x01) }));
		let fields = unwrap(readChildren(unwrap(readValue(tbs))));

		expect([...memberAt(fields, 1).content]).toEqual([0x7f, 0x01]);
	});

	test("refuses an empty serial", () => {
		let result = buildTbsCertificate({ ...baseInput(), serial: new Uint8Array(0) });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Certificate serial number is empty");
		}
	});

	test("refuses a public key that is not a SubjectPublicKeyInfo", () => {
		let result = buildTbsCertificate({
			...baseInput(),
			spki: encodeValue(TAG_INTEGER, Uint8Array.of(0x01)),
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Certificate public key is not a SubjectPublicKeyInfo");
		}
	});

	test("refuses a date no GeneralizedTime can express", () => {
		let result = buildTbsCertificate({ ...baseInput(), notAfter: new Date(Number.NaN) });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("Certificate validity date is out of range");
		}
	});
});

describe("self-signed round trip", () => {
	test("builds, signs and reads back a certificate whose key Web Crypto imports", async () => {
		let pair = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);

		let spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));

		let tbs = buildTbsCertificate({
			spki,
			commonName: "sp.example.com",
			serial: Uint8Array.of(0xa1, 0xb2, 0xc3, 0xd4),
			notBefore: new Date("2026-01-01T00:00:00.000Z"),
			notAfter: new Date("2036-01-01T00:00:00.000Z"),
		});

		expect(isSuccess(tbs)).toBe(true);
		let tbsBytes = unwrap(tbs);

		let signature = new Uint8Array(
			await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, tbsBytes),
		);

		let der = buildCertificate(tbsBytes, signature);
		let fields = unwrap(readCertificate(der));

		expect(fields.algorithm).toEqual({ kind: "RSA" });
		expect(fields.subject).toBe("sp.example.com");
		expect(fields.issuer).toBe("sp.example.com");
		expect(fields.serial).toBe("00A1B2C3D4");
		expect(fields.notBefore.toISOString()).toBe("2026-01-01T00:00:00.000Z");
		expect(fields.notAfter.toISOString()).toBe("2036-01-01T00:00:00.000Z");
		expect([...fields.spki]).toEqual([...spki]);

		let imported = await crypto.subtle.importKey(
			"spki",
			fields.spki,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			true,
			["verify"],
		);

		expect(imported.type).toBe("public");
		expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", imported, signature, tbsBytes)).toBe(
			true,
		);
	});

	test("carries the signature in a BIT STRING led by a zero unused-bits octet", () => {
		let tbs = unwrap(
			buildTbsCertificate({
				spki: spkiFor(OID_RSA),
				commonName: "sp.example.com",
				serial: Uint8Array.of(0x01),
				notBefore: new Date("2026-01-01T00:00:00.000Z"),
				notAfter: new Date("2027-01-01T00:00:00.000Z"),
			}),
		);

		let der = buildCertificate(tbs, Uint8Array.of(0xde, 0xad));
		let parts = unwrap(readChildren(unwrap(readValue(der))));

		expect(parts.length).toBe(3);
		expect(memberAt(parts, 2).tag).toBe(TAG_BIT_STRING);
		expect([...memberAt(parts, 2).content]).toEqual([0x00, 0xde, 0xad]);
	});
});
