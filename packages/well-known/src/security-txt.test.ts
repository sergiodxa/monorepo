/**
 * Exercises security.txt against RFC 9116's examples, including the cleartext-signed
 * one: the §2.5 cardinalities, the `https` rules, line-numbered issues, unknown fields
 * kept, and the writer's output reading back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SecurityTxt } from "./security-txt.js";

import { isExpired, parse, securityTxt, stringify } from "./security-txt.js";

/** An unsigned file using every §2.5 field, with CRLF endings. */
const UNSIGNED = [
	"# Our security address",
	"Contact: mailto:security@example.com",
	"contact: tel:+1-201-555-0123",
	"Expires: 2021-12-31T18:37:07.000Z",
	"Encryption: https://example.com/pgp-key.txt",
	"Encryption: openpgp4fpr:5f2de5521c63a801ab59ccb603d49de44b29100f",
	"Preferred-Languages: en, es,fr",
	"Canonical: https://www.example.com/.well-known/security.txt",
	"Policy: https://example.com/disclosure-policy.html",
	"Acknowledgments: https://example.com/hall-of-fame.html",
	"Hiring: https://example.com/jobs.html",
	"CSAF: https://example.com/.well-known/csaf/provider-metadata.json",
	"",
].join("\r\n");

/** The cleartext-signed example of RFC 9116 §2.3, with a placeholder signature. */
const SIGNED = `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

# Canonical URI
Canonical: https://example.com/.well-known/security.txt

# Our security address
Contact: mailto:security@example.com

# Our OpenPGP key
Encryption: https://example.com/pgp-key.txt

# Our security policy
Policy: https://example.com/security-policy.html

# Our security acknowledgments page
Acknowledgments: https://example.com/hall-of-fame.html

- Expires: 2021-12-31T18:37:07.000Z
-----BEGIN PGP SIGNATURE-----
Version: GnuPG v2.2

iQIzBAEBCAAdFiEE
-----END PGP SIGNATURE-----
`;

describe(parse, () => {
	test("reads every §2.5 field, case-insensitively, keeping unknown fields", () => {
		let file = unwrap(parse(UNSIGNED));
		expect(file.contact.map(String)).toEqual([
			"mailto:security@example.com",
			"tel:+1-201-555-0123",
		]);
		expect(file.expires).toEqual(new Date("2021-12-31T18:37:07.000Z"));
		expect(file.encryption).toHaveLength(2);
		expect(file.preferredLanguages).toEqual(["en", "es", "fr"]);
		expect(file.canonical[0]?.href).toBe("https://www.example.com/.well-known/security.txt");
		expect(file.policy).toHaveLength(1);
		expect(file.acknowledgments).toHaveLength(1);
		expect(file.hiring).toHaveLength(1);
		expect(file.extensions).toEqual({
			csaf: ["https://example.com/.well-known/csaf/provider-metadata.json"],
		});
		expect(file.signed).toBe(false);
	});

	test("reads a cleartext-signed file from its signed body (§2.3)", () => {
		let file = unwrap(parse(SIGNED));
		expect(file.signed).toBe(true);
		expect(file.contact[0].href).toBe("mailto:security@example.com");
		expect(file.expires.toISOString()).toBe("2021-12-31T18:37:07.000Z");
	});

	test("fails on a signed file with no signature block", () => {
		let result = parse(
			"-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nContact: mailto:a@example.com\n",
		);
		expect(isFailure(result)).toBe(true);
	});

	test("fails on a missing Contact and a missing Expires", () => {
		let result = parse("# nothing here\n");
		expect(isFailure(result) && result.error.issues).toEqual([
			{ at: 0, message: "The file has no Contact field." },
			{ at: 0, message: "The file has no Expires field." },
		]);
	});

	test("fails on a repeated Expires or Preferred-Languages, naming the line", () => {
		let result = parse(
			[
				"Contact: mailto:a@example.com",
				"Expires: 2030-01-01T00:00:00Z",
				"Expires: 2031-01-01T00:00:00Z",
				"Preferred-Languages: en",
				"Preferred-Languages: es",
			].join("\n"),
		);
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([3, 5]);
	});

	test("fails on http URIs and on non-https URIs where §2.5 asks for a web URI", () => {
		let result = parse(
			[
				"Contact: http://example.com/security",
				"Contact: mailto:a@example.com",
				"Policy: mailto:a@example.com",
				"Expires: 2030-01-01T00:00:00Z",
			].join("\n"),
		);
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([1, 3]);
	});

	test("fails on a line that is neither a field, a comment nor blank, and a malformed Expires", () => {
		let result = parse(
			["Contact: mailto:a@example.com", "just text", "Expires: tomorrow"].join("\n"),
		);
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([2, 3]);
	});

	test("parses an expired file", () => {
		expect(isFailure(parse(UNSIGNED))).toBe(false);
	});
});

describe(stringify, () => {
	let document: SecurityTxt = {
		contact: [new URL("mailto:security@example.com")],
		expires: new Date("2027-06-30T00:00:00Z"),
		encryption: [],
		acknowledgments: [],
		preferredLanguages: ["en", "es"],
		canonical: [new URL("https://example.com/.well-known/security.txt")],
		policy: [new URL("https://example.com/security")],
		hiring: [],
		extensions: { csaf: ["https://example.com/csaf.json"] },
	};

	test("writes comments, then the fields, one per line", () => {
		expect(stringify(document, { comments: ["Report vulnerabilities here"] })).toBe(
			[
				"# Report vulnerabilities here",
				"Contact: mailto:security@example.com",
				"Expires: 2027-06-30T00:00:00Z",
				"Preferred-Languages: en, es",
				"Canonical: https://example.com/.well-known/security.txt",
				"Policy: https://example.com/security",
				"Csaf: https://example.com/csaf.json",
				"",
			].join("\n"),
		);
	});

	test("keeps a value carrying a line break on one line", () => {
		let text = stringify({
			...document,
			extensions: { note: ["a\nContact: mailto:evil@example.com"] },
		});
		expect(unwrap(parse(text)).contact).toHaveLength(1);
	});

	test("round-trips through parse", () => {
		let { signed, ...parsed } = unwrap(parse(stringify(document)));
		expect(signed).toBe(false);
		expect(parsed).toEqual(document);
	});
});

describe(isExpired, () => {
	test("reports a file past its Expires as stale", () => {
		let file = unwrap(parse(UNSIGNED));
		expect(isExpired(file, new Date("2022-01-01T00:00:00Z"))).toBe(true);
		expect(isExpired(file, new Date("2021-06-01T00:00:00Z"))).toBe(false);
	});
});

describe("securityTxt", () => {
	test("serves plain text under security.txt", () => {
		expect(securityTxt).toMatchObject({
			name: "security.txt",
			mediaType: "text/plain; charset=utf-8",
		});
	});
});
