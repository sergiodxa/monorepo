/**
 * Signs SAML responses the way an identity provider does, so the sign-in tests
 * run the tenant's real verification against a genuine RSA signature. Every
 * document is written already in exclusive canonical form, so it is signed as-is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64 } from "@sdxc/crypto";

/** SAML 2.0 protocol namespace, bound to `samlp`. */
const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";

/** SAML 2.0 assertion namespace, bound to `saml`. */
const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

/** XML Signature namespace, bound to `ds`. */
const SIGNATURE_NS = "http://www.w3.org/2000/09/xmldsig#";

/** Exclusive XML Canonicalization, both the signature's method and its last transform. */
const EXCLUSIVE_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";

/**
 * What one fixture response says. Every field has a default, so a test names
 * only the part it is about; `null` leaves the optional attribute out.
 */
export interface ResponseFixture {
	responseId?: string;
	assertionId?: string;
	issuer?: string;
	audience?: string;
	destination?: string | null;
	recipient?: string;
	inResponseTo?: string | null;
	nameId?: string;
	sessionIndex?: string;
	notBefore?: Date;
	notOnOrAfter?: Date;
	attributes?: Record<string, string[]>;
}

/**
 * Builds a response whose assertion carries an enveloped RSA-SHA256 signature
 * by `key`, answering the document as the text a provider posts.
 *
 * @param fixture - What the response should say
 * @param key - The provider's RSASSA-PKCS1-v1_5 private key
 * @returns The signed response document
 */
export async function signResponse(fixture: ResponseFixture, key: CryptoKey): Promise<string> {
	let issuer = fixture.issuer ?? "https://idp.example.com";
	let audience = fixture.audience ?? "https://sp.example.com/metadata";
	let recipient = fixture.recipient ?? "https://sp.example.com/acs";
	let notBefore = (fixture.notBefore ?? new Date(Date.now() - 60_000)).toISOString();
	let notOnOrAfter = (fixture.notOnOrAfter ?? new Date(Date.now() + 120_000)).toISOString();
	let destination = fixture.destination === undefined ? recipient : fixture.destination;
	let inResponseTo = fixture.inResponseTo === undefined ? "_req1" : fixture.inResponseTo;
	let assertionId = fixture.assertionId ?? "_assertion1";
	let attributes = fixture.attributes ?? { email: ["user@example.com"] };

	let issuerElement = element("saml:Issuer", {}, text(issuer));

	let body = [
		element(
			"saml:Subject",
			{},
			element(
				"saml:NameID",
				{ Format: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent" },
				text(fixture.nameId ?? "user@example.com"),
			),
			element(
				"saml:SubjectConfirmation",
				{ Method: "urn:oasis:names:tc:SAML:2.0:cm:bearer" },
				element("saml:SubjectConfirmationData", {
					InResponseTo: inResponseTo,
					NotOnOrAfter: notOnOrAfter,
					Recipient: recipient,
				}),
			),
		),
		element(
			"saml:Conditions",
			{ NotBefore: notBefore, NotOnOrAfter: notOnOrAfter },
			element("saml:AudienceRestriction", {}, element("saml:Audience", {}, text(audience))),
		),
		element("saml:AuthnStatement", {
			AuthnInstant: notBefore,
			SessionIndex: fixture.sessionIndex ?? "session-1",
		}),
		element(
			"saml:AttributeStatement",
			{},
			...Object.entries(attributes).map(([name, values]) =>
				element(
					"saml:Attribute",
					{ Name: name },
					...values.map((value) => element("saml:AttributeValue", {}, text(value))),
				),
			),
		),
	];

	let assertionAttributes = {
		"xmlns:saml": ASSERTION_NS,
		ID: assertionId,
		IssueInstant: notBefore,
		Version: "2.0",
	};

	let unsigned = element("saml:Assertion", assertionAttributes, issuerElement, ...body);
	let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(unsigned));

	let signedInfo = element(
		"ds:SignedInfo",
		{ "xmlns:ds": SIGNATURE_NS },
		element("ds:CanonicalizationMethod", { Algorithm: EXCLUSIVE_C14N }),
		element("ds:SignatureMethod", {
			Algorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
		}),
		element(
			"ds:Reference",
			{ URI: `#${assertionId}` },
			element(
				"ds:Transforms",
				{},
				element("ds:Transform", {
					Algorithm: "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
				}),
				element("ds:Transform", { Algorithm: EXCLUSIVE_C14N }),
			),
			element("ds:DigestMethod", { Algorithm: "http://www.w3.org/2001/04/xmlenc#sha256" }),
			element("ds:DigestValue", {}, Base64.encode(new Uint8Array(digest))),
		),
	);

	let signature = await crypto.subtle.sign(
		{ name: "RSASSA-PKCS1-v1_5" },
		key,
		new TextEncoder().encode(signedInfo),
	);

	let signatureElement = element(
		"ds:Signature",
		{ "xmlns:ds": SIGNATURE_NS },
		signedInfo,
		element("ds:SignatureValue", {}, Base64.encode(new Uint8Array(signature))),
	);

	return element(
		"samlp:Response",
		{
			"xmlns:saml": ASSERTION_NS,
			"xmlns:samlp": PROTOCOL_NS,
			Destination: destination,
			ID: fixture.responseId ?? "_response1",
			IssueInstant: notBefore,
			Version: "2.0",
		},
		issuerElement,
		element(
			"samlp:Status",
			{},
			element("samlp:StatusCode", { Value: "urn:oasis:names:tc:SAML:2.0:status:Success" }),
		),
		element("saml:Assertion", assertionAttributes, issuerElement, signatureElement, ...body),
	);
}

/**
 * Writes one element in canonical form: an explicit end tag, and attributes in
 * the order given, which every caller lists namespace declarations first and
 * the rest alphabetically. A `null` attribute is left out.
 */
function element(
	name: string,
	attributes: Record<string, string | null>,
	...children: string[]
): string {
	let rendered = Object.entries(attributes)
		.filter((entry): entry is [string, string] => entry[1] !== null)
		.map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
		.join("");
	return `<${name}${rendered}>${children.join("")}</${name}>`;
}

/** Escapes character data the way canonical XML writes it. */
function text(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Escapes an attribute value the way canonical XML writes it. */
function escapeAttribute(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}
