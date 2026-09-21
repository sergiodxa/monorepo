/**
 * Pins the public surface: the calls a consumer reaches through the namespace
 * import, and the fact that a verified assertion is a type alone, so claims
 * arrive from a verification rather than from anything a caller can build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test } from "vitest";

import * as SAML from "./index.js";

describe("the package surface", () => {
	test("exports the calls a service provider makes", () => {
		expect(Object.keys(SAML).sort()).toEqual([
			"AssertionConditionError",
			"Certificate",
			"CertificateError",
			"DecryptionFailedError",
			"MalformedDocumentError",
			"ReplayStoreError",
			"ReplayedAssertionError",
			"ResponseStatusError",
			"SAMLError",
			"SignatureMismatchError",
			"UnresolvedReferenceError",
			"UnsignedDocumentError",
			"UnsupportedFeatureError",
			"WrappedAssertionError",
			"buildServiceProviderMetadata",
			"createAuthnRequest",
			"parseIdPMetadata",
			"verifyResponse",
		]);
	});

	test("names an assertion and its nested types without exposing a constructor", () => {
		expectTypeOf<SAML.Assertion>().toHaveProperty("nameId");
		expectTypeOf<SAML.Assertion["issuer"]>().toEqualTypeOf<string>();
		expectTypeOf<SAML.Assertion.NameId["format"]>().toEqualTypeOf<string | null>();
		expect("Assertion" in SAML).toBe(false);
	});

	test("groups every failure under one base class", () => {
		let failures = [
			new SAML.SignatureMismatchError(),
			new SAML.WrappedAssertionError("test"),
			new SAML.ReplayedAssertionError(),
			new SAML.DecryptionFailedError(),
			new SAML.UnresolvedReferenceError(2),
			new SAML.UnsignedDocumentError(0),
		];

		for (let failure of failures) expect(failure).toBeInstanceOf(SAML.SAMLError);
	});
});
