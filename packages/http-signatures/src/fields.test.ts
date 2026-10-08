/**
 * Tests for the RFC 9421 field parsers and serializers, and the draft-cavage `Signature`
 * header: the examples the specifications print, round trips that keep parameter order,
 * and the malformed inputs each one refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64 } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	parseAcceptSignature,
	parseCavageSignature,
	parseSignature,
	parseSignatureInput,
	stringifyAcceptSignature,
	stringifyCavageSignature,
	stringifySignature,
	stringifySignatureInput,
} from "./index.js";

/** The RFC 9421 B.2.2 `Signature-Input`, which carries a parameterized component and a tag. */
const B22_INPUT =
	'sig-b22=("@authority" "content-digest" "@query-param";name="Pet");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"';

describe("Signature-Input", () => {
	test("parses components, parameters and times", () => {
		expect(unwrap(parseSignatureInput(B22_INPUT))).toEqual({
			"sig-b22": {
				components: [
					{ name: "@authority" },
					{ name: "content-digest" },
					{ name: "@query-param", params: { name: "Pet" } },
				],
				params: {
					created: new Date(1618884473000),
					keyid: "test-key-rsa-pss",
					tag: "header-example",
				},
			},
		});
	});

	test("round-trips with parameter order kept", () => {
		let input =
			'sig1=("example-dict";sf "example-dict";key="a");keyid="k";created=1618884473;nonce="n";alg="ed25519"';
		expect(unwrap(stringifySignatureInput(unwrap(parseSignatureInput(input))))).toBe(input);
		expect(unwrap(stringifySignatureInput(unwrap(parseSignatureInput(B22_INPUT))))).toBe(B22_INPUT);
	});

	test("refuses members that are not component lists", () => {
		expect(isFailure(parseSignatureInput('sig1="@method"'))).toBe(true);
		expect(isFailure(parseSignatureInput("sig1=(@method)"))).toBe(true);
		expect(isFailure(parseSignatureInput("sig1=(1 2)"))).toBe(true);
		expect(isFailure(parseSignatureInput('sig1=("Content-Type")'))).toBe(true);
		expect(isFailure(parseSignatureInput('sig1=("date";unknown)'))).toBe(true);
		expect(isFailure(parseSignatureInput('sig1=("date");created="now"'))).toBe(true);
		expect(isFailure(parseSignatureInput('sig1=("date");keyid=1'))).toBe(true);
	});
});

describe("Signature", () => {
	test("round-trips byte sequences by label", () => {
		let text = `sig1=:${Base64.encode(new Uint8Array([1, 2, 3]))}:, sig2=:AAAA:`;
		let parsed = unwrap(parseSignature(text));
		expect(parsed.sig1).toEqual(new Uint8Array([1, 2, 3]));
		expect(unwrap(stringifySignature(parsed))).toBe(text);
	});

	test("refuses a member that is not a byte sequence", () => {
		expect(isFailure(parseSignature('sig1="abc"'))).toBe(true);
		expect(isFailure(stringifySignature({ "Bad Label": new Uint8Array([1]) }))).toBe(true);
	});
});

describe("Accept-Signature", () => {
	test("parses the RFC 9421 §5.1 example and writes it back", () => {
		let text =
			'sig1=("@method" "@target-uri" "@authority" "content-digest" "cache-control");keyid="test-key-rsa-pss";created;tag="app-123"';
		let parsed = unwrap(parseAcceptSignature(text));
		expect(parsed.sig1?.params).toEqual({
			keyid: "test-key-rsa-pss",
			created: true,
			tag: "app-123",
		});
		expect(parsed.sig1?.components.map((component) => component.name)).toEqual([
			"@method",
			"@target-uri",
			"@authority",
			"content-digest",
			"cache-control",
		]);
		expect(unwrap(stringifyAcceptSignature(parsed))).toBe(text);
	});

	test("refuses a created that carries a value", () => {
		expect(isFailure(parseAcceptSignature('sig1=("@method");created=1'))).toBe(true);
		expect(isFailure(parseAcceptSignature('sig1="x"'))).toBe(true);
	});
});

describe("cavage Signature", () => {
	test("parses the draft-cavage-12 C.3 header, wrapped as printed", () => {
		let parsed = unwrap(
			parseCavageSignature(`keyId="Test",algorithm="rsa-sha256",
  created=1402170695, expires=1402170699,
  headers="(request-target) (created) (expires)
    host date content-type digest content-length",
  signature="vSdrb+dS3EceC9bcwHSo4MlyKS59iFIrhgYkz8+oVLEEzmYZZvRs
    8rgOp+63LEM3v+MFHB32NfpB2bEKBIvB1q52LaEUHFv120V01IL+TAD48XaERZF
    ukWgHoBTLMhYS2Gb51gWxpeIq8knRmPnYePbF5MOkR0Zkly4zKH7s1dE="`),
		);

		expect(parsed).toMatchObject({
			keyId: "Test",
			algorithm: "rsa-sha256",
			created: new Date(1402170695000),
			expires: new Date(1402170699000),
			headers: [
				"(request-target)",
				"(created)",
				"(expires)",
				"host",
				"date",
				"content-type",
				"digest",
				"content-length",
			],
		});
		expect(parsed.signature).toHaveLength(128);
	});

	test("leaves headers null when absent and ignores unknown parameters", () => {
		let parsed = unwrap(parseCavageSignature('keyId="Test",extra="x",signature="AAAA"'));
		expect(parsed).toMatchObject({ algorithm: null, headers: null, created: null });
	});

	test("round-trips in Mastodon's order", () => {
		let signature = {
			keyId: "https://mastodon.example/users/alice#main-key",
			algorithm: "hs2019",
			created: new Date(1402170695000),
			expires: null,
			headers: ["(request-target)", "host", "date", "digest", "content-type"],
			signature: new Uint8Array([1, 2, 3]),
		};
		let text = unwrap(stringifyCavageSignature(signature));
		expect(text).toBe(
			'keyId="https://mastodon.example/users/alice#main-key",algorithm="hs2019",created=1402170695,headers="(request-target) host date digest content-type",signature="AQID"',
		);
		expect(unwrap(parseCavageSignature(text))).toEqual(signature);
	});

	test("refuses broken or incomplete headers", () => {
		expect(isFailure(parseCavageSignature('keyId="Test"'))).toBe(true);
		expect(isFailure(parseCavageSignature('signature="AAAA"'))).toBe(true);
		expect(isFailure(parseCavageSignature('keyId="a",keyId="b",signature="AAAA"'))).toBe(true);
		expect(isFailure(parseCavageSignature('keyId="a" signature="AAAA"'))).toBe(true);
		expect(isFailure(parseCavageSignature('keyId="a",signature="***"'))).toBe(true);
		expect(isFailure(parseCavageSignature('keyId="a",created="soon",signature="AAAA"'))).toBe(true);
		expect(
			isFailure(
				stringifyCavageSignature({
					keyId: 'a"b',
					algorithm: null,
					created: null,
					expires: null,
					headers: null,
					signature: new Uint8Array(),
				}),
			),
		).toBe(true);
	});
});
