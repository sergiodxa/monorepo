/**
 * The slice of DER this package needs: a reader that walks one TLV at a time, a
 * writer that emits them, and the two X.509 shapes built on top — reading a
 * signing certificate down to the fields a connection tracks, and assembling a
 * self-signed certificate around a key the caller already holds.
 *
 * Failures come back as plain `Error` inside a `Result` so this module stays a
 * byte-level tool; the caller decides which SAML failure a refusal becomes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes, Hex } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

/** Decoder for the string and time values a certificate carries, all UTF-8 compatible. */
const DECODER = new TextDecoder();

/** Encoder for the one string this module writes, the common name of a built certificate. */
const ENCODER = new TextEncoder();

/** Universal INTEGER, carrying the version and the serial number. */
const TAG_INTEGER = 0x02;

/** Universal BIT STRING, the wrapper a signature value travels in. */
const TAG_BIT_STRING = 0x03;

/** Universal NULL, the absent parameters of an RSA algorithm identifier. */
const TAG_NULL = 0x05;

/** Universal OBJECT IDENTIFIER, which is how every algorithm and attribute names itself. */
const TAG_OID = 0x06;

/** Universal UTF8String, the attribute value form this module writes names in. */
const TAG_UTF8_STRING = 0x0c;

/** Universal UTCTime, the two-digit-year form certificates issued before 2050 still use. */
const TAG_UTC_TIME = 0x17;

/** Universal GeneralizedTime, the four-digit-year form this module writes. */
const TAG_GENERALIZED_TIME = 0x18;

/** Universal SEQUENCE, constructed. */
const TAG_SEQUENCE = 0x30;

/** Universal SET, constructed, holding the attributes of one relative distinguished name. */
const TAG_SET = 0x31;

/** Context-specific `[0]`, constructed, which is how the explicit version tag is written. */
const TAG_VERSION = 0xa0;

/** Bit in an identifier octet that marks a value whose content is further TLVs. */
const CONSTRUCTED_BIT = 0x20;

/** Identifier bits that, all set, continue the tag into further octets. */
const HIGH_TAG_MASK = 0x1f;

/** Smallest length that must be written in the long form, and the long-form marker bit. */
const LONG_FORM_FLAG = 0x80;

/** Bit that, set in an INTEGER's first octet, would read the value as negative. */
const SIGN_BIT = 0x80;

/** Length octets this reader accepts, which covers every buffer a runtime can hold. */
const MAX_LENGTH_OCTETS = 4;

/** Content of a NULL and of any other value written with no octets at all. */
const NO_CONTENT = new Uint8Array(0);

/** Version number a v3 certificate carries, one less than the version it names. */
const VERSION_V3 = 2;

/** id-at-commonName, 2.5.4.3: the attribute a subject or issuer name is read down to. */
const OID_COMMON_NAME = Uint8Array.of(0x55, 0x04, 0x03);

/** rsaEncryption, 1.2.840.113549.1.1.1. */
const OID_RSA = Uint8Array.of(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01);

/** sha256WithRSAEncryption, 1.2.840.113549.1.1.11, the one algorithm this module writes. */
const OID_SHA256_WITH_RSA = Uint8Array.of(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b);

/** id-ecPublicKey, 1.2.840.10045.2.1, whose parameters name the curve. */
const OID_EC = Uint8Array.of(0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01);

/** prime256v1, 1.2.840.10045.3.1.7, which Web Crypto calls P-256. */
const OID_P256 = Uint8Array.of(0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07);

/** secp384r1, 1.3.132.0.34, which Web Crypto calls P-384. */
const OID_P384 = Uint8Array.of(0x2b, 0x81, 0x04, 0x00, 0x22);

/** secp521r1, 1.3.132.0.35, which Web Crypto calls P-521. */
const OID_P521 = Uint8Array.of(0x2b, 0x81, 0x04, 0x00, 0x23);

/** UTCTime and GeneralizedTime, with the seconds both forms may leave out. */
const TIME_PATTERN = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/;

/** The year a two-digit UTCTime year stops meaning the twenty-first century (RFC 5280 §4.1.2.5.1). */
const UTC_TIME_PIVOT = 50;

/** First year of the century a two-digit year below the pivot belongs to. */
const CENTURY_2000 = 2000;

/** First year of the century a two-digit year at or above the pivot belongs to. */
const CENTURY_1900 = 1900;

/** Digits a GeneralizedTime year occupies, which is what bounds the dates this module writes. */
const YEAR_DIGITS = 4;

/** Digits every GeneralizedTime field other than the year occupies. */
const FIELD_DIGITS = 2;

/** Highest year a four-digit GeneralizedTime can express. */
const MAX_YEAR = 9999;

/**
 * One DER TLV, with its full bytes kept so a nested structure can be handed on
 * verbatim — which is how a SubjectPublicKeyInfo reaches Web Crypto without
 * being re-encoded from its parts.
 */
export interface DerValue {
	/** Identifier octet, e.g. `0x30` SEQUENCE, `0x02` INTEGER, `0xa0` `[0]`. */
	tag: number;

	/** Value octets alone. */
	content: Bytes;

	/** Whole TLV, identifier and length octets included. */
	bytes: Bytes;

	/** Offset just past this TLV, in the buffer it was read from. */
	end: number;
}

/** The key a certificate carries, named as Web Crypto needs it to import the key. */
export type PublicKeyAlgorithm =
	| { kind: "RSA" }
	| { kind: "EC"; curve: "P-256" | "P-384" | "P-521" };

/** What a certificate is read for. */
export interface CertificateFields {
	/** Whole SubjectPublicKeyInfo TLV, ready for `importKey("spki", …)`. */
	spki: Bytes;

	algorithm: PublicKeyAlgorithm;
	notBefore: Date;
	notAfter: Date;

	/** The subject's common name, or `""` when it carries none. */
	subject: string;

	/** The issuer's common name, or `""` when it carries none. */
	issuer: string;

	/** Serial number octets as hex, uppercase and unseparated, sign padding included. */
	serial: string;
}

/** What a self-signed certificate is built from. */
export interface SelfSignedInput {
	/** Public half, as `crypto.subtle.exportKey("spki", …)` produced it. */
	spki: Bytes;

	/** Used as both the subject and the issuer common name, which is what makes it self-signed. */
	commonName: string;

	/** Serial number octets; a leading bit set is padded so the INTEGER stays positive. */
	serial: Bytes;

	notBefore: Date;
	notAfter: Date;
}

/**
 * Reads one byte the caller has already bounds-checked.
 *
 * Indexing a `Uint8Array` widens to `number | undefined` under this repo's
 * compiler settings, and every read here sits behind a length check already.
 */
function byteAt(bytes: Uint8Array, index: number): number {
	return bytes[index] ?? 0;
}

/** Compares two byte runs, which is how an OID is matched against a known one. */
function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

/**
 * Reads one TLV starting at `offset`, in the definite-length form alone.
 *
 * An indefinite length, a length spanning more than four octets, and a length
 * reaching past the buffer are all refused rather than clamped, so a truncated
 * certificate never yields a value that looks whole.
 *
 * @param bytes Buffer to read from.
 * @param offset Where the identifier octet sits.
 * @returns The value, or an `Error` naming what made the encoding unreadable.
 */
export function readValue(bytes: Bytes, offset = 0): Result<DerValue, Error> {
	if (offset < 0 || offset + 1 >= bytes.length) {
		return failure(new Error("DER value is truncated"));
	}

	let tag = byteAt(bytes, offset);
	if ((tag & HIGH_TAG_MASK) === HIGH_TAG_MASK) {
		return failure(new Error("DER high tag number form is unsupported"));
	}

	let lead = byteAt(bytes, offset + 1);
	let length = lead;
	let contentStart = offset + 2;

	if ((lead & LONG_FORM_FLAG) !== 0) {
		let octets = lead & ~LONG_FORM_FLAG;
		if (octets === 0) return failure(new Error("DER indefinite length form is unsupported"));
		if (octets > MAX_LENGTH_OCTETS) return failure(new Error("DER length is too long to read"));
		if (contentStart + octets > bytes.length) {
			return failure(new Error("DER value is truncated"));
		}

		length = 0;
		for (let index = 0; index < octets; index++) {
			length = length * 256 + byteAt(bytes, contentStart + index);
		}
		contentStart += octets;
	}

	let end = contentStart + length;
	if (end > bytes.length) return failure(new Error("DER value runs past the end of the buffer"));

	return success({
		tag,
		content: bytes.subarray(contentStart, end),
		bytes: bytes.subarray(offset, end),
		end,
	});
}

/**
 * Reads every TLV inside a constructed value's content, in order.
 *
 * Each child's `end` is an offset into the parent's content, which is the buffer
 * it was read from, so the offsets stay usable after the parent is passed around.
 *
 * @param value Constructed value whose members to read.
 * @returns The members in source order, or an `Error` when one of them is unreadable.
 */
export function readChildren(value: DerValue): Result<DerValue[], Error> {
	if ((value.tag & CONSTRUCTED_BIT) === 0) {
		return failure(new Error("DER value is not constructed"));
	}

	let children: DerValue[] = [];
	let offset = 0;

	while (offset < value.content.length) {
		let child = readValue(value.content, offset);
		if (isFailure(child)) return child;
		children.push(child.data);
		offset = child.data.end;
	}

	return success(children);
}

/** Writes the length octets for a content run, in the shortest form DER allows. */
function encodeLength(length: number): Bytes {
	if (length < LONG_FORM_FLAG) return Uint8Array.of(length);

	let octets: number[] = [];
	let remaining = length;
	while (remaining > 0) {
		octets.unshift(remaining % 256);
		remaining = Math.floor(remaining / 256);
	}

	return Uint8Array.of(LONG_FORM_FLAG | octets.length, ...octets);
}

/**
 * Writes one TLV.
 *
 * @param tag Identifier octet to write.
 * @param content Value octets, already encoded.
 * @returns The whole TLV.
 */
export function encodeValue(tag: number, content: Uint8Array): Bytes {
	return concatBytes(Uint8Array.of(tag), encodeLength(content.length), content);
}

/**
 * Writes a SEQUENCE around already-encoded members.
 *
 * @param members Members in the order the sequence holds them.
 * @returns The whole SEQUENCE TLV.
 */
export function encodeSequence(...members: Uint8Array[]): Bytes {
	return encodeValue(TAG_SEQUENCE, concatBytes(...members));
}

/**
 * Takes the member at `index`, refusing a structure that is short or differently shaped.
 *
 * One pair of fixed messages covers every field, so a malformed certificate never
 * echoes any of its own bytes back into a log.
 */
function fieldAt(fields: DerValue[], index: number, tag: number): Result<DerValue, Error> {
	let field = fields[index];
	if (field === undefined) return failure(new Error("Certificate is missing a required field"));
	if (field.tag !== tag) return failure(new Error("Certificate field has an unexpected tag"));
	return success(field);
}

/**
 * Reads a UTCTime or GeneralizedTime as an instant.
 *
 * Only the `Z` form is accepted: an offset form would have to be trusted to state
 * its own zone correctly, and a validity window read an hour wrong is one a
 * certificate can be used outside of.
 */
function readTime(value: DerValue): Result<Date, Error> {
	if (value.tag !== TAG_UTC_TIME && value.tag !== TAG_GENERALIZED_TIME) {
		return failure(new Error("Certificate field has an unexpected tag"));
	}

	let text = DECODER.decode(value.content);
	let century = "";

	if (value.tag === TAG_GENERALIZED_TIME) {
		century = text.slice(0, FIELD_DIGITS);
		text = text.slice(FIELD_DIGITS);
	}

	let match = TIME_PATTERN.exec(text);
	if (match === null) return failure(new Error("Certificate time is not a supported UTC form"));

	let [, years = "", months = "", days = "", hours = "", minutes = "", seconds = "0"] = match;
	let year = Number(years);

	if (century === "") year += year < UTC_TIME_PIVOT ? CENTURY_2000 : CENTURY_1900;
	else year += Number(century) * 100;

	return success(
		new Date(
			Date.UTC(
				year,
				Number(months) - 1,
				Number(days),
				Number(hours),
				Number(minutes),
				Number(seconds),
			),
		),
	);
}

/**
 * Reads a Name down to its common name, taking the last one written.
 *
 * A name may repeat the attribute to qualify it, and the last relative
 * distinguished name is the most specific one, so it is the one that identifies
 * the entity. A name carrying none reads as `""` rather than refusing.
 */
function readCommonName(name: DerValue): Result<string, Error> {
	let rdns = readChildren(name);
	if (isFailure(rdns)) return rdns;

	let common = "";

	for (let rdn of rdns.data) {
		let attributes = readChildren(rdn);
		if (isFailure(attributes)) return attributes;

		for (let attribute of attributes.data) {
			let pair = readChildren(attribute);
			if (isFailure(pair)) return pair;

			let [type, value] = pair.data;
			if (type === undefined || value === undefined) continue;
			if (type.tag !== TAG_OID || !sameBytes(type.content, OID_COMMON_NAME)) continue;

			common = DECODER.decode(value.content);
		}
	}

	return success(common);
}

/** Maps a curve OID to the name Web Crypto imports an EC key under. */
function readCurve(parameters: DerValue | undefined): Result<PublicKeyAlgorithm, Error> {
	if (parameters === undefined || parameters.tag !== TAG_OID) {
		return failure(new Error("Unsupported public key curve"));
	}

	if (sameBytes(parameters.content, OID_P256)) return success({ kind: "EC", curve: "P-256" });
	if (sameBytes(parameters.content, OID_P384)) return success({ kind: "EC", curve: "P-384" });
	if (sameBytes(parameters.content, OID_P521)) return success({ kind: "EC", curve: "P-521" });

	return failure(new Error("Unsupported public key curve"));
}

/**
 * Reads the algorithm a SubjectPublicKeyInfo announces.
 *
 * The result names the key the way `importKey` needs it named, so the caller
 * reaches Web Crypto without matching OIDs a second time.
 */
function readAlgorithm(spki: DerValue): Result<PublicKeyAlgorithm, Error> {
	let parts = readChildren(spki);
	if (isFailure(parts)) return parts;

	let identifier = fieldAt(parts.data, 0, TAG_SEQUENCE);
	if (isFailure(identifier)) return identifier;

	let members = readChildren(identifier.data);
	if (isFailure(members)) return members;

	let oid = fieldAt(members.data, 0, TAG_OID);
	if (isFailure(oid)) return oid;

	if (sameBytes(oid.data.content, OID_RSA)) return success({ kind: "RSA" });
	if (sameBytes(oid.data.content, OID_EC)) return readCurve(members.data[1]);

	return failure(new Error("Unsupported public key algorithm"));
}

/**
 * Walks an X.509 certificate's DER to the fields a SAML connection tracks.
 *
 * The public key travels on as the whole SubjectPublicKeyInfo TLV, which is the
 * form `importKey("spki", …)` takes, so nothing downstream rebuilds it.
 *
 * @param der Certificate in DER form.
 * @returns The fields, or an `Error` naming what made the certificate unreadable.
 */
export function readCertificate(der: Bytes): Result<CertificateFields, Error> {
	let certificate = readValue(der);
	if (isFailure(certificate)) return certificate;
	if (certificate.data.tag !== TAG_SEQUENCE) {
		return failure(new Error("Certificate is not a SEQUENCE"));
	}

	let top = readChildren(certificate.data);
	if (isFailure(top)) return top;

	let tbs = fieldAt(top.data, 0, TAG_SEQUENCE);
	if (isFailure(tbs)) return tbs;

	let fields = readChildren(tbs.data);
	if (isFailure(fields)) return fields;

	let cursor = fields.data[0]?.tag === TAG_VERSION ? 1 : 0;

	let serial = fieldAt(fields.data, cursor++, TAG_INTEGER);
	if (isFailure(serial)) return serial;

	let signature = fieldAt(fields.data, cursor++, TAG_SEQUENCE);
	if (isFailure(signature)) return signature;

	let issuer = fieldAt(fields.data, cursor++, TAG_SEQUENCE);
	if (isFailure(issuer)) return issuer;

	let validity = fieldAt(fields.data, cursor++, TAG_SEQUENCE);
	if (isFailure(validity)) return validity;

	let subject = fieldAt(fields.data, cursor++, TAG_SEQUENCE);
	if (isFailure(subject)) return subject;

	let spki = fieldAt(fields.data, cursor++, TAG_SEQUENCE);
	if (isFailure(spki)) return spki;

	let bounds = readChildren(validity.data);
	if (isFailure(bounds)) return bounds;

	let [start, expiry] = bounds.data;
	if (start === undefined || expiry === undefined) {
		return failure(new Error("Certificate is missing a required field"));
	}

	let notBefore = readTime(start);
	if (isFailure(notBefore)) return notBefore;

	let notAfter = readTime(expiry);
	if (isFailure(notAfter)) return notAfter;

	let issuerName = readCommonName(issuer.data);
	if (isFailure(issuerName)) return issuerName;

	let subjectName = readCommonName(subject.data);
	if (isFailure(subjectName)) return subjectName;

	let algorithm = readAlgorithm(spki.data);
	if (isFailure(algorithm)) return algorithm;

	return success({
		spki: spki.data.bytes,
		algorithm: algorithm.data,
		notBefore: notBefore.data,
		notAfter: notAfter.data,
		subject: subjectName.data,
		issuer: issuerName.data,
		serial: Hex.encode(serial.data.content).toUpperCase(),
	});
}

/** Writes a number as a fixed-width run of digits, which is what a time field is. */
function pad(value: number, digits: number): string {
	return String(value).padStart(digits, "0");
}

/**
 * Writes an instant as a GeneralizedTime.
 *
 * The four-digit year sidesteps the 2049 pivot a UTCTime year is read through,
 * so a certificate built here keeps meaning the same window forever.
 */
function encodeTime(date: Date): Bytes {
	let text =
		pad(date.getUTCFullYear(), YEAR_DIGITS) +
		pad(date.getUTCMonth() + 1, FIELD_DIGITS) +
		pad(date.getUTCDate(), FIELD_DIGITS) +
		pad(date.getUTCHours(), FIELD_DIGITS) +
		pad(date.getUTCMinutes(), FIELD_DIGITS) +
		pad(date.getUTCSeconds(), FIELD_DIGITS) +
		"Z";

	return encodeValue(TAG_GENERALIZED_TIME, ENCODER.encode(text));
}

/** Writes the algorithm identifier this module signs and verifies under. */
function encodeSignatureAlgorithm(): Bytes {
	return encodeSequence(
		encodeValue(TAG_OID, OID_SHA256_WITH_RSA),
		encodeValue(TAG_NULL, NO_CONTENT),
	);
}

/** Writes a Name holding one common name, which is the whole distinguished name here. */
function encodeCommonName(commonName: string): Bytes {
	return encodeSequence(
		encodeValue(
			TAG_SET,
			encodeSequence(
				encodeValue(TAG_OID, OID_COMMON_NAME),
				encodeValue(TAG_UTF8_STRING, ENCODER.encode(commonName)),
			),
		),
	);
}

/** Rejects a date a GeneralizedTime cannot express, which `Date.UTC` would otherwise round-trip wrong. */
function checkDate(date: Date): Result<Date, Error> {
	let time = date.getTime();
	if (Number.isNaN(time)) return failure(new Error("Certificate validity date is out of range"));

	let year = date.getUTCFullYear();
	if (year < 0 || year > MAX_YEAR) {
		return failure(new Error("Certificate validity date is out of range"));
	}

	return success(date);
}

/**
 * Builds the TBSCertificate a caller signs, as a v3 certificate carrying no extensions.
 *
 * The signature algorithm is fixed to sha256WithRSAEncryption because it is what
 * the field must announce and what `buildCertificate` then wraps the result in;
 * the caller signs with the matching key.
 *
 * @param input Public key, name, serial and validity window to certify.
 * @returns The encoded TBSCertificate, or an `Error` naming the input it refused.
 */
export function buildTbsCertificate(input: SelfSignedInput): Result<Bytes, Error> {
	if (input.serial.length === 0) {
		return failure(new Error("Certificate serial number is empty"));
	}

	let key = readValue(input.spki);
	if (isFailure(key)) return key;
	if (key.data.tag !== TAG_SEQUENCE || key.data.end !== input.spki.length) {
		return failure(new Error("Certificate public key is not a SubjectPublicKeyInfo"));
	}

	let notBefore = checkDate(input.notBefore);
	if (isFailure(notBefore)) return notBefore;

	let notAfter = checkDate(input.notAfter);
	if (isFailure(notAfter)) return notAfter;

	let signed = (byteAt(input.serial, 0) & SIGN_BIT) !== 0;
	let serial = signed ? concatBytes(Uint8Array.of(0), input.serial) : input.serial;
	let name = encodeCommonName(input.commonName);

	return success(
		encodeSequence(
			encodeValue(TAG_VERSION, encodeValue(TAG_INTEGER, Uint8Array.of(VERSION_V3))),
			encodeValue(TAG_INTEGER, serial),
			encodeSignatureAlgorithm(),
			name,
			encodeSequence(encodeTime(notBefore.data), encodeTime(notAfter.data)),
			name,
			input.spki,
		),
	);
}

/**
 * Wraps a signed TBSCertificate into the certificate itself.
 *
 * The signature goes into a BIT STRING led by a zero unused-bits octet, since an
 * RSA signature is a whole number of octets.
 *
 * @param tbs TBSCertificate exactly as it was signed.
 * @param signature Raw sha256WithRSAEncryption signature over `tbs`.
 * @returns The certificate in DER form.
 */
export function buildCertificate(tbs: Uint8Array, signature: Uint8Array): Bytes {
	return encodeSequence(
		tbs,
		encodeSignatureAlgorithm(),
		encodeValue(TAG_BIT_STRING, concatBytes(Uint8Array.of(0), signature)),
	);
}
