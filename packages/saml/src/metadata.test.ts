/**
 * Exercises both metadata calls against documents shaped the way real identity
 * providers write them — one entity or a collection, keys published per use or
 * for both — and closes the loop by parsing the service-provider document this
 * package writes back out of the tree it was built from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { describe, expect, test } from "vitest";

import { Certificate } from "./certificate.js";
import {
	HTTP_POST_BINDING,
	HTTP_REDIRECT_BINDING,
	METADATA_NS,
	PROTOCOL_NS,
	SIGNATURE_NS,
} from "./lib/namespaces.js";
import { attribute, child, children, locate, text } from "./lib/tree.js";
import { buildServiceProviderMetadata, parseIdPMetadata } from "./metadata.js";

/** The key pair the fixture certificate is signed with, generated once for the file. */
const KEYS = await crypto.subtle.generateKey(
	{
		name: "RSASSA-PKCS1-v1_5",
		modulusLength: 2048,
		publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
		hash: "SHA-256",
	},
	true,
	["sign", "verify"],
);

/** The certificate every fixture publishes, so a test asserts against a real one. */
const CERTIFICATE = unwrap(
	await Certificate.selfSigned({
		keys: KEYS,
		commonName: "idp.example.com",
		notBefore: new Date("2026-01-01T00:00:00.000Z"),
		notAfter: new Date("2027-01-01T00:00:00.000Z"),
	}),
);

/** The entity id every identity-provider fixture is written under. */
const ENTITY_ID = "https://idp.example.com/entity";

/** The sign-on endpoint a fixture publishes when the test is about something else. */
const SSO_LOCATION = "https://idp.example.com/sso/redirect";

/** The name id format the service-provider document requests where a test asks for one. */
const EMAIL_NAME_ID = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

/** A `SingleSignOnService` element at one binding and location. */
function endpoint(binding: string, location: string): string {
	return `<md:SingleSignOnService Binding="${binding}" Location="${location}"/>`;
}

/** A `KeyDescriptor` carrying the fixture certificate, at the use it names or at none. */
function keyDescriptor(use: string | null, body = CERTIFICATE.toBase64()): string {
	let attributes = use === null ? "" : ` use="${use}"`;
	return [
		`<md:KeyDescriptor${attributes}>`,
		`<ds:KeyInfo xmlns:ds="${SIGNATURE_NS}"><ds:X509Data>`,
		`<ds:X509Certificate>${body}</ds:X509Certificate>`,
		"</ds:X509Data></ds:KeyInfo>",
		"</md:KeyDescriptor>",
	].join("");
}

/** An `IDPSSODescriptor` around whatever a test publishes inside it. */
function descriptor(body: string, attributes = ""): string {
	return [
		`<md:IDPSSODescriptor protocolSupportEnumeration="${PROTOCOL_NS}"${attributes}>`,
		body,
		"</md:IDPSSODescriptor>",
	].join("");
}

/** An `EntityDescriptor` around one descriptor body, declaring the metadata prefix. */
function entity(body: string, entityId = ENTITY_ID): string {
	return [
		`<md:EntityDescriptor xmlns:md="${METADATA_NS}" entityID="${entityId}">`,
		body,
		"</md:EntityDescriptor>",
	].join("");
}

/** A complete document publishing one endpoint and one signing key. */
function document(): string {
	return entity(
		descriptor(`${keyDescriptor("signing")}${endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION)}`),
	);
}

/** The options the builder takes, with every field set to something a test can vary. */
function options(): Parameters<typeof buildServiceProviderMetadata>[0] {
	return {
		entityId: "https://acme.example.com/u/sso/okta",
		assertionConsumerService: "https://acme.example.com/u/sso/okta/acs",
		certificate: CERTIFICATE,
		nameIdFormat: EMAIL_NAME_ID,
		wantAssertionsSigned: true,
		authnRequestsSigned: true,
		validUntil: new Date("2027-06-01T12:00:00.000Z"),
	};
}

/** The located `SPSSODescriptor` inside a built document, parsed back from its text. */
function spssoDescriptor(source: string) {
	let parsed = unwrap(XML.parse(source, { whitespace: "preserve" }));
	let root = locate(parsed.root);
	let found = child(root, METADATA_NS, "SPSSODescriptor");
	expect(found).toBeDefined();
	return { root, descriptor: found as NonNullable<typeof found> };
}

describe("parseIdPMetadata", () => {
	test("reads the entity id off an EntityDescriptor root", async () => {
		let result = await parseIdPMetadata(document());

		expect(isSuccess(result)).toBe(true);
		expect(unwrap(result).entityId).toBe(ENTITY_ID);
	});

	test("reads the single entity inside an EntitiesDescriptor", async () => {
		let source = [
			`<md:EntitiesDescriptor xmlns:md="${METADATA_NS}">`,
			document(),
			"</md:EntitiesDescriptor>",
		].join("");

		let result = await parseIdPMetadata(source);

		expect(unwrap(result).entityId).toBe(ENTITY_ID);
	});

	test("refuses an EntitiesDescriptor carrying more than one entity", async () => {
		let source = [
			`<md:EntitiesDescriptor xmlns:md="${METADATA_NS}">`,
			document(),
			entity(
				descriptor(endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION)),
				"https://other.example.com/entity",
			),
			"</md:EntitiesDescriptor>",
		].join("");

		let result = await parseIdPMetadata(source);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.name).toBe("MalformedDocumentError");
			expect(result.error.message).toContain("found 2");
		}
	});

	test("refuses a root that is neither descriptor", async () => {
		let result = await parseIdPMetadata(`<Something xmlns="${METADATA_NS}"/>`);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.name).toBe("MalformedDocumentError");
	});

	test("refuses a document carrying a DOCTYPE", async () => {
		let result = await parseIdPMetadata(`<!DOCTYPE md:EntityDescriptor>${document()}`);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.name).toBe("UnsupportedFeatureError");
			expect(result.error.message).toContain("document type declaration");
		}
	});

	test("refuses a document publishing no IDPSSODescriptor", async () => {
		let source = entity(`<md:SPSSODescriptor protocolSupportEnumeration="${PROTOCOL_NS}"/>`);

		let result = await parseIdPMetadata(source);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("IDPSSODescriptor");
	});

	test("refuses a descriptor publishing no SingleSignOnService", async () => {
		let result = await parseIdPMetadata(entity(descriptor(keyDescriptor("signing"))));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("SingleSignOnService");
	});

	test("refuses a document with no entityID", async () => {
		let source = [
			`<md:EntityDescriptor xmlns:md="${METADATA_NS}">`,
			descriptor(endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION)),
			"</md:EntityDescriptor>",
		].join("");

		let result = await parseIdPMetadata(source);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("entityID");
	});

	test("routes a signing key descriptor into the signing set alone", async () => {
		let result = await parseIdPMetadata(document());
		let metadata = unwrap(result);

		expect(metadata.signing).toHaveLength(1);
		expect(metadata.encryption).toHaveLength(0);
		expect(metadata.signing[0]?.fingerprint).toBe(CERTIFICATE.fingerprint);
	});

	test("routes an encryption key descriptor into the encryption set alone", async () => {
		let source = entity(
			descriptor(`${keyDescriptor("encryption")}${endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION)}`),
		);

		let metadata = unwrap(await parseIdPMetadata(source));

		expect(metadata.signing).toHaveLength(0);
		expect(metadata.encryption).toHaveLength(1);
		expect(metadata.encryption[0]?.fingerprint).toBe(CERTIFICATE.fingerprint);
	});

	test("publishes a key descriptor naming no use for both", async () => {
		let source = entity(
			descriptor(`${keyDescriptor(null)}${endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION)}`),
		);

		let metadata = unwrap(await parseIdPMetadata(source));

		expect(metadata.signing.map((each) => each.fingerprint)).toEqual([CERTIFICATE.fingerprint]);
		expect(metadata.encryption.map((each) => each.fingerprint)).toEqual([CERTIFICATE.fingerprint]);
	});

	test("keeps every sign-on endpoint in document order with its binding", async () => {
		let source = entity(
			descriptor(
				[
					endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION),
					endpoint(HTTP_POST_BINDING, "https://idp.example.com/sso/post"),
					endpoint(HTTP_REDIRECT_BINDING, "https://idp.example.com/sso/second"),
				].join(""),
			),
		);

		let metadata = unwrap(await parseIdPMetadata(source));

		expect(metadata.singleSignOn).toEqual([
			{ binding: HTTP_REDIRECT_BINDING, location: SSO_LOCATION },
			{ binding: HTTP_POST_BINDING, location: "https://idp.example.com/sso/post" },
			{ binding: HTTP_REDIRECT_BINDING, location: "https://idp.example.com/sso/second" },
		]);
	});

	test("reads WantAuthnRequestsSigned as true where the document says so", async () => {
		let source = entity(
			descriptor(endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION), ' WantAuthnRequestsSigned="true"'),
		);

		expect(unwrap(await parseIdPMetadata(source)).wantAuthnRequestsSigned).toBe(true);
	});

	test("reads WantAuthnRequestsSigned as false where it is absent or not true", async () => {
		let absent = unwrap(await parseIdPMetadata(document()));
		let written = entity(
			descriptor(endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION), ' WantAuthnRequestsSigned="false"'),
		);

		expect(absent.wantAuthnRequestsSigned).toBe(false);
		expect(unwrap(await parseIdPMetadata(written)).wantAuthnRequestsSigned).toBe(false);
	});

	test("fails the whole document when one certificate cannot be read", async () => {
		let source = entity(
			descriptor(
				[
					keyDescriptor("signing"),
					keyDescriptor("encryption", "not-a-certificate"),
					endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION),
				].join(""),
			),
		);

		let result = await parseIdPMetadata(source);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.name).toBe("CertificateError");
	});

	test("ignores a certificate parked outside the KeyInfo path", async () => {
		let source = entity(
			descriptor(
				[
					`<md:KeyDescriptor use="signing"><ds:X509Certificate xmlns:ds="${SIGNATURE_NS}">not-a-certificate</ds:X509Certificate></md:KeyDescriptor>`,
					endpoint(HTTP_REDIRECT_BINDING, SSO_LOCATION),
				].join(""),
			),
		);

		let metadata = unwrap(await parseIdPMetadata(source));

		expect(metadata.signing).toHaveLength(0);
	});
});

describe("buildServiceProviderMetadata", () => {
	test("writes a document that parses back into an SPSSODescriptor", () => {
		let built = unwrap(buildServiceProviderMetadata(options()));
		let { root, descriptor: sp } = spssoDescriptor(built);

		expect(root.uri).toBe(METADATA_NS);
		expect(root.local).toBe("EntityDescriptor");
		expect(attribute(root, "entityID")).toBe("https://acme.example.com/u/sso/okta");
		expect(attribute(sp, "protocolSupportEnumeration")).toBe(PROTOCOL_NS);
		expect(attribute(sp, "AuthnRequestsSigned")).toBe("true");
		expect(attribute(sp, "WantAssertionsSigned")).toBe("true");
	});

	test("writes both signing flags as false where the options say so", () => {
		let built = unwrap(
			buildServiceProviderMetadata({
				...options(),
				wantAssertionsSigned: false,
				authnRequestsSigned: false,
			}),
		);
		let { descriptor: sp } = spssoDescriptor(built);

		expect(attribute(sp, "AuthnRequestsSigned")).toBe("false");
		expect(attribute(sp, "WantAssertionsSigned")).toBe("false");
	});

	test("publishes the assertion consumer service over HTTP-POST as the default", () => {
		let built = unwrap(buildServiceProviderMetadata(options()));
		let { descriptor: sp } = spssoDescriptor(built);
		let services = children(sp, METADATA_NS, "AssertionConsumerService");

		expect(services).toHaveLength(1);
		expect(attribute(services[0]!, "Binding")).toBe(HTTP_POST_BINDING);
		expect(attribute(services[0]!, "Location")).toBe("https://acme.example.com/u/sso/okta/acs");
		expect(attribute(services[0]!, "index")).toBe("0");
		expect(attribute(services[0]!, "isDefault")).toBe("true");
	});

	test("publishes the certificate for signing and for encryption", () => {
		let built = unwrap(buildServiceProviderMetadata(options()));
		let { descriptor: sp } = spssoDescriptor(built);
		let keys = children(sp, METADATA_NS, "KeyDescriptor");

		expect(keys.map((each) => attribute(each, "use"))).toEqual(["signing", "encryption"]);
		for (let key of keys) {
			let info = child(key, SIGNATURE_NS, "KeyInfo");
			let data = info && child(info, SIGNATURE_NS, "X509Data");
			let published = data && child(data, SIGNATURE_NS, "X509Certificate");
			expect(published && text(published)).toBe(CERTIFICATE.toBase64());
		}
	});

	test("omits the key descriptors where there is no certificate", () => {
		let built = unwrap(buildServiceProviderMetadata({ ...options(), certificate: null }));
		let { descriptor: sp } = spssoDescriptor(built);

		expect(children(sp, METADATA_NS, "KeyDescriptor")).toHaveLength(0);
		expect(built).not.toContain("ds:X509Certificate");
	});

	test("writes the name id format where one is given", () => {
		let built = unwrap(buildServiceProviderMetadata(options()));
		let { descriptor: sp } = spssoDescriptor(built);
		let format = child(sp, METADATA_NS, "NameIDFormat");

		expect(format && text(format)).toBe(EMAIL_NAME_ID);
	});

	test("omits the name id format where none is given", () => {
		let built = unwrap(buildServiceProviderMetadata({ ...options(), nameIdFormat: null }));
		let { descriptor: sp } = spssoDescriptor(built);

		expect(child(sp, METADATA_NS, "NameIDFormat")).toBeUndefined();
	});

	test("writes validUntil as an ISO 8601 instant", () => {
		let built = unwrap(buildServiceProviderMetadata(options()));
		let { root } = spssoDescriptor(built);

		expect(attribute(root, "validUntil")).toBe("2027-06-01T12:00:00.000Z");
	});

	test("omits validUntil where the document never expires", () => {
		let built = unwrap(buildServiceProviderMetadata({ ...options(), validUntil: null }));
		let { root } = spssoDescriptor(built);

		expect(attribute(root, "validUntil")).toBeUndefined();
	});

	test("publishes a certificate that reads back to the same fingerprint", async () => {
		let built = unwrap(buildServiceProviderMetadata(options()));
		let { descriptor: sp } = spssoDescriptor(built);
		let key = children(sp, METADATA_NS, "KeyDescriptor")[0]!;
		let info = child(key, SIGNATURE_NS, "KeyInfo")!;
		let data = child(info, SIGNATURE_NS, "X509Data")!;
		let published = child(data, SIGNATURE_NS, "X509Certificate")!;

		let parsed = unwrap(await Certificate.parse(text(published)));

		expect(parsed.fingerprint).toBe(CERTIFICATE.fingerprint);
		expect(parsed.subject).toBe(CERTIFICATE.subject);
	});
});
