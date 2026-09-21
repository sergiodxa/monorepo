/**
 * Builds and signs the response documents the verification tests run against,
 * so a test states the document it means and the wrapping it wants rather than
 * carrying a wall of XML, and so a genuine signature is available to tamper
 * around — which is the only way to write the attacks down.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import { Base64 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { XML as XMLDocument } from "@sdxc/xml";

import { canonicalize } from "../lib/canonicalize.js";
import { ASSERTION_NS, PROTOCOL_NS, SIGNATURE_NS } from "../lib/namespaces.js";
import { locate, walk } from "../lib/tree.js";

/** The namespace prefixes every fixture document declares on its root. */
const ROOT_NAMESPACES = {
	"xmlns:samlp": PROTOCOL_NS,
	"xmlns:saml": ASSERTION_NS,
};

/** The status a response carries when it went well. */
const SUCCESS_STATUS = "urn:oasis:names:tc:SAML:2.0:status:Success";

/**
 * What one fixture response says. Every field has a default, so a test names
 * only the part it is about.
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
	status?: string;
}

/** Which element of the document the signature covers. */
export type SignTarget = "response" | "assertion";

/**
 * Builds an unsigned response tree, with a placeholder signature already in
 * place under the element that will cover it, so signing only fills values in
 * and never changes the shape a digest was taken over.
 *
 * @param fixture - What the response should say
 * @param target - Which element carries the signature
 * @returns The response element, as plain XML data
 */
export function buildResponse(fixture: ResponseFixture, target: SignTarget): XML.Element {
	let issuer = fixture.issuer ?? "https://idp.example.com";
	let audience = fixture.audience ?? "https://sp.example.com/metadata";
	let recipient = fixture.recipient ?? "https://sp.example.com/acs";
	let notBefore = fixture.notBefore ?? new Date("2026-09-21T11:55:00Z");
	let notOnOrAfter = fixture.notOnOrAfter ?? new Date("2026-09-21T12:05:00Z");
	let destination = fixture.destination === undefined ? recipient : fixture.destination;

	let confirmationData: XML.Element = {
		name: "saml:SubjectConfirmationData",
		attributes: {
			NotOnOrAfter: notOnOrAfter.toISOString(),
			Recipient: recipient,
			...(fixture.inResponseTo === null ? {} : { InResponseTo: fixture.inResponseTo ?? "_req1" }),
		},
		children: [],
	};

	let assertion: XML.Element = {
		name: "saml:Assertion",
		attributes: {
			ID: fixture.assertionId ?? "_assertion1",
			Version: "2.0",
			IssueInstant: notBefore.toISOString(),
		},
		children: [
			element("saml:Issuer", {}, [issuer]),
			...(target === "assertion"
				? [placeholderSignature(fixture.assertionId ?? "_assertion1")]
				: []),
			element("saml:Subject", {}, [
				element("saml:NameID", { Format: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent" }, [
					fixture.nameId ?? "user@example.com",
				]),
				element("saml:SubjectConfirmation", { Method: "urn:oasis:names:tc:SAML:2.0:cm:bearer" }, [
					confirmationData,
				]),
			]),
			element(
				"saml:Conditions",
				{ NotBefore: notBefore.toISOString(), NotOnOrAfter: notOnOrAfter.toISOString() },
				[element("saml:AudienceRestriction", {}, [element("saml:Audience", {}, [audience])])],
			),
			element(
				"saml:AuthnStatement",
				{
					AuthnInstant: notBefore.toISOString(),
					SessionIndex: fixture.sessionIndex ?? "session-1",
				},
				[],
			),
			element("saml:AttributeStatement", {}, attributeElements(fixture.attributes)),
		],
	};

	let responseId = fixture.responseId ?? "_response1";

	return {
		name: "samlp:Response",
		attributes: {
			...ROOT_NAMESPACES,
			ID: responseId,
			Version: "2.0",
			IssueInstant: notBefore.toISOString(),
			...(destination === null ? {} : { Destination: destination }),
		},
		children: [
			element("saml:Issuer", {}, [issuer]),
			...(target === "response" ? [placeholderSignature(responseId)] : []),
			element("samlp:Status", {}, [
				element("samlp:StatusCode", { Value: fixture.status ?? SUCCESS_STATUS }, []),
			]),
			assertion,
		],
	};
}

/**
 * Fills a placeholder signature in with a real digest and a real signature,
 * answering the document as text. The digest is taken with the signature
 * omitted, then the signature over the canonical `SignedInfo`, which is the
 * order every step of verification undoes.
 *
 * @param root - A tree carrying exactly one placeholder signature
 * @param key - The private key to sign with
 * @returns The signed document as XML text
 */
export async function signDocument(root: XML.Element, key: CryptoKey): Promise<string> {
	let digest = await digestReference(root);
	setSignatureField(root, "DigestValue", Base64.encode(new Uint8Array(digest)));

	let signedInfo = canonicalizeSignedInfo(root);
	let signature = await crypto.subtle.sign(
		signatureParameters(key),
		key,
		new TextEncoder().encode(signedInfo),
	);
	setSignatureField(root, "SignatureValue", Base64.encode(new Uint8Array(signature)));

	return stringify(root);
}

/** Serializes a tree, failing loudly since a fixture that cannot be written is a test bug. */
export function stringify(root: XML.Element): string {
	let result = XMLDocument.stringify(root);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** Parses a document back into plain data, so a test can tamper with it. */
export function reparse(source: string): XML.Element {
	let result = XMLDocument.parse(source, { whitespace: "preserve" });
	if (isFailure(result)) throw result.error;
	return result.data.root;
}

/**
 * The canonical digest of the element the placeholder signature references,
 * taken with that signature left out, which is what the enveloped-signature
 * transform means.
 */
async function digestReference(root: XML.Element): Promise<ArrayBuffer> {
	let located = locate(reparse(stringify(root)));
	let signature = findSignature(located);
	let covered = signature.parent;
	if (!covered) throw new Error("The placeholder signature has no element to cover");

	let form = canonicalize(covered, { omit: signature });
	return crypto.subtle.digest("SHA-256", new TextEncoder().encode(form));
}

/** The canonical form of the document's `SignedInfo`, which is what gets signed. */
function canonicalizeSignedInfo(root: XML.Element): string {
	let located = locate(reparse(stringify(root)));
	let signature = findSignature(located);

	for (let element of walk(signature)) {
		if (element.uri === SIGNATURE_NS && element.local === "SignedInfo")
			return canonicalize(element);
	}

	throw new Error("The placeholder signature has no SignedInfo");
}

/** The one signature in a located document, which a fixture always has exactly one of. */
function findSignature(root: ReturnType<typeof locate>) {
	for (let element of walk(root)) {
		if (element.uri === SIGNATURE_NS && element.local === "Signature") return element;
	}
	throw new Error("The document carries no signature");
}

/** Writes one computed value into the placeholder signature, in place. */
function setSignatureField(root: XML.Element, local: string, value: string): void {
	let target = findElement(root, `ds:${local}`);
	if (!target) throw new Error(`The placeholder signature has no ${local}`);
	target.children = [value];
}

/** The first element in a plain tree carrying one raw name. */
export function findElement(root: XML.Element, name: string): XML.Element | undefined {
	if (root.name === name) return root;
	for (let node of root.children ?? []) {
		if (typeof node === "string") continue;
		let found = findElement(node, name);
		if (found) return found;
	}
	return undefined;
}

/** The parent of the first element in a plain tree carrying one raw name. */
export function findParent(root: XML.Element, name: string): XML.Element | undefined {
	for (let node of root.children ?? []) {
		if (typeof node === "string") continue;
		if (node.name === name) return root;
		let found = findParent(node, name);
		if (found) return found;
	}
	return undefined;
}

/** The signing parameters for a key, covering the two algorithms fixtures use. */
function signatureParameters(key: CryptoKey): AlgorithmIdentifier | EcdsaParams {
	if (key.algorithm.name === "ECDSA") return { name: "ECDSA", hash: "SHA-256" };
	return { name: "RSASSA-PKCS1-v1_5" };
}

/**
 * The signature element a document is built with, carrying every field except
 * the two values signing computes.
 */
function placeholderSignature(referenceId: string): XML.Element {
	let algorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

	return element("ds:Signature", { "xmlns:ds": SIGNATURE_NS }, [
		element("ds:SignedInfo", {}, [
			element(
				"ds:CanonicalizationMethod",
				{ Algorithm: "http://www.w3.org/2001/10/xml-exc-c14n#" },
				[],
			),
			element("ds:SignatureMethod", { Algorithm: algorithm }, []),
			element("ds:Reference", { URI: `#${referenceId}` }, [
				element("ds:Transforms", {}, [
					element(
						"ds:Transform",
						{ Algorithm: "http://www.w3.org/2000/09/xmldsig#enveloped-signature" },
						[],
					),
					element("ds:Transform", { Algorithm: "http://www.w3.org/2001/10/xml-exc-c14n#" }, []),
				]),
				element("ds:DigestMethod", { Algorithm: "http://www.w3.org/2001/04/xmlenc#sha256" }, []),
				element("ds:DigestValue", {}, [""]),
			]),
		]),
		element("ds:SignatureValue", {}, [""]),
	]);
}

/** The attribute statements a fixture asks for, defaulting to one email attribute. */
function attributeElements(attributes: Record<string, string[]> | undefined): XML.Element[] {
	let source = attributes ?? { email: ["user@example.com"] };

	return Object.entries(source).map(([name, values]) =>
		element(
			"saml:Attribute",
			{ Name: name },
			values.map((value) => element("saml:AttributeValue", {}, [value])),
		),
	);
}

/** Writes one element, which is what keeps the fixture tree readable. */
function element(
	name: string,
	attributes: Record<string, string>,
	children: XML.Node[],
): XML.Element {
	return { name, attributes, children };
}
