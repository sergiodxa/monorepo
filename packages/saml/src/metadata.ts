/**
 * The two metadata documents a connection is configured from: the one an
 * identity provider publishes, read into the endpoints and certificates the
 * connection then trusts, and the one this service provider hands back so the
 * provider can reach it and encrypt to it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import type { SAMLError } from "./errors.js";
import type { Element } from "./lib/tree.js";

import { Certificate } from "./certificate.js";
import { MalformedDocumentError, UnsupportedFeatureError } from "./errors.js";
import { HTTP_POST_BINDING, METADATA_NS, PROTOCOL_NS, SIGNATURE_NS } from "./lib/namespaces.js";
import { attribute, child, children, locate, text } from "./lib/tree.js";

/** A document type declaration, refused before anything reads the source. */
const DOCTYPE_PATTERN = /<!DOCTYPE/i;

/**
 * Groups the types a caller names when it reads an identity provider's metadata.
 */
export namespace IdPMetadata {
	/**
	 * One endpoint an identity provider publishes, kept as the pair a caller
	 * needs together: the binding decides how a request is sent, and only the
	 * location that was published beside it accepts it.
	 */
	export interface Endpoint {
		binding: string;
		location: string;
	}
}

/**
 * What an identity provider's metadata document says about it, which is
 * everything a connection is configured from when a tenant supplies a document
 * instead of typing the endpoints and pasting the certificates.
 */
export interface IdPMetadata {
	/** The provider's entity id, which an assertion must name as its issuer. */
	entityId: string;

	/** Every published sign-on endpoint, in document order, for the caller to choose from. */
	singleSignOn: IdPMetadata.Endpoint[];

	/** The certificates that verify what the provider signs. */
	signing: Certificate[];

	/** The certificates the provider accepts encrypted material under. */
	encryption: Certificate[];

	/** Whether the provider expects the authentication requests it receives to be signed. */
	wantAuthnRequestsSigned: boolean;
}

/**
 * How a service provider's own metadata document is written.
 *
 * Every field is required and none carries a default, so `null` is a sentence
 * somebody wrote rather than a field left off, and a document published without
 * a certificate is a decision rather than an oversight.
 */
export interface ServiceProviderMetadataOptions {
	/** The entity id an assertion must restrict itself to. */
	entityId: string;

	/** The assertion consumer service URL, published over the HTTP-POST binding. */
	assertionConsumerService: string;

	/**
	 * The certificate to publish, carried for both signing and encryption use, or
	 * `null` while the service provider has no key pair yet.
	 */
	certificate: Certificate | null;

	/** The name id format to request, or `null` to leave the choice to the provider. */
	nameIdFormat: string | null;

	/** Whether the provider is asked to sign the assertions it sends here. */
	wantAssertionsSigned: boolean;

	/** Whether the provider is told the authentication requests it receives are signed. */
	authnRequestsSigned: boolean;

	/** When the document stops describing this service provider, or `null` for no expiry. */
	validUntil: Date | null;
}

/**
 * Reads an identity provider's metadata document.
 *
 * @param source - The metadata XML, as the provider publishes it
 * @returns What the document says about the provider, or why it could not be read
 */
export async function parseIdPMetadata(source: string): Promise<Result<IdPMetadata, SAMLError>> {
	if (DOCTYPE_PATTERN.test(source)) {
		return failure(
			new UnsupportedFeatureError(
				"document type declaration",
				"a document carrying a DOCTYPE is refused before it is parsed",
			),
		);
	}

	let parsed = XML.parse(source, { whitespace: "preserve" });
	if (isFailure(parsed)) return failure(new MalformedDocumentError(parsed.error.message));

	let entity = readEntityDescriptor(locate(parsed.data.root));
	if (isFailure(entity)) return entity;

	let entityId = attribute(entity.data, "entityID");
	if (!entityId) {
		return failure(new MalformedDocumentError("EntityDescriptor carries no entityID"));
	}

	let descriptor = child(entity.data, METADATA_NS, "IDPSSODescriptor");
	if (!descriptor) {
		return failure(new MalformedDocumentError("entity publishes no IDPSSODescriptor"));
	}

	let singleSignOn = readSingleSignOn(descriptor);
	if (isFailure(singleSignOn)) return singleSignOn;

	let keys = await readKeyDescriptors(descriptor);
	if (isFailure(keys)) return keys;

	return success({
		entityId,
		singleSignOn: singleSignOn.data,
		signing: keys.data.signing,
		encryption: keys.data.encryption,
		wantAuthnRequestsSigned: attribute(descriptor, "WantAuthnRequestsSigned") === "true",
	});
}

/**
 * Writes the metadata document an identity provider is handed.
 *
 * @param options - What the document says about this service provider
 * @returns The document as XML text, or why it could not be written
 */
export function buildServiceProviderMetadata(
	options: ServiceProviderMetadataOptions,
): Result<string, SAMLError> {
	let sections: XML.Node[] = [];

	if (options.certificate) {
		sections.push(
			keyDescriptor("signing", options.certificate),
			keyDescriptor("encryption", options.certificate),
		);
	}

	if (options.nameIdFormat) {
		sections.push({ name: "md:NameIDFormat", children: [options.nameIdFormat] });
	}

	sections.push({
		name: "md:AssertionConsumerService",
		attributes: {
			Binding: HTTP_POST_BINDING,
			Location: options.assertionConsumerService,
			index: "0",
			isDefault: "true",
		},
	});

	let attributes: Record<string, string> = {
		"xmlns:md": METADATA_NS,
		entityID: options.entityId,
	};
	if (options.validUntil) attributes.validUntil = options.validUntil.toISOString();

	let document = XML.stringify({
		name: "md:EntityDescriptor",
		attributes,
		children: [
			{
				name: "md:SPSSODescriptor",
				attributes: {
					protocolSupportEnumeration: PROTOCOL_NS,
					AuthnRequestsSigned: String(options.authnRequestsSigned),
					WantAssertionsSigned: String(options.wantAssertionsSigned),
				},
				children: sections,
			},
		],
	});
	if (isFailure(document)) return failure(new MalformedDocumentError(document.error.message));

	return document;
}

/**
 * The one entity a document describes, whether it is written on its own or
 * inside a collection. A collection holding several entities is refused rather
 * than reduced to its first, since a caller configuring one connection has no
 * basis on which to choose between them.
 */
function readEntityDescriptor(root: Element): Result<Element, MalformedDocumentError> {
	if (root.uri === METADATA_NS && root.local === "EntityDescriptor") return success(root);

	if (root.uri !== METADATA_NS || root.local !== "EntitiesDescriptor") {
		return failure(new MalformedDocumentError("root element is not a SAML metadata descriptor"));
	}

	let entities = children(root, METADATA_NS, "EntityDescriptor");
	let entity = entities.at(0);
	if (!entity || entities.length !== 1) {
		return failure(
			new MalformedDocumentError(`expected exactly one EntityDescriptor, found ${entities.length}`),
		);
	}

	return success(entity);
}

/**
 * Every sign-on endpoint the descriptor publishes, in the order it wrote them
 * and with whatever binding each names, so the caller applies its own
 * preference rather than one decided here. A descriptor publishing none
 * describes a provider nothing can be sent to.
 */
function readSingleSignOn(
	descriptor: Element,
): Result<IdPMetadata.Endpoint[], MalformedDocumentError> {
	let endpoints: IdPMetadata.Endpoint[] = [];

	for (let published of children(descriptor, METADATA_NS, "SingleSignOnService")) {
		let binding = attribute(published, "Binding");
		let location = attribute(published, "Location");
		if (!binding || !location) {
			return failure(
				new MalformedDocumentError("SingleSignOnService carries no Binding or no Location"),
			);
		}

		endpoints.push({ binding, location });
	}

	if (endpoints.length === 0) {
		return failure(new MalformedDocumentError("IDPSSODescriptor publishes no SingleSignOnService"));
	}

	return success(endpoints);
}

/**
 * The certificates the descriptor publishes, split by the use each was
 * published for. A key descriptor naming no use is published for both, which is
 * what the metadata specification means by leaving the attribute out, and one
 * certificate that cannot be read fails the whole document rather than leaving
 * a connection trusting a set with a silent hole in it.
 */
async function readKeyDescriptors(
	descriptor: Element,
): Promise<Result<{ signing: Certificate[]; encryption: Certificate[] }, SAMLError>> {
	let signing: Certificate[] = [];
	let encryption: Certificate[] = [];

	for (let key of children(descriptor, METADATA_NS, "KeyDescriptor")) {
		let use = attribute(key, "use");

		for (let published of certificateElements(key)) {
			let certificate = await Certificate.parse(text(published));
			if (isFailure(certificate)) return certificate;

			if (use === undefined || use === "signing") signing.push(certificate.data);
			if (use === undefined || use === "encryption") encryption.push(certificate.data);
		}
	}

	return success({ signing, encryption });
}

/**
 * The `X509Certificate` elements one key descriptor carries, reached only along
 * the `KeyInfo`/`X509Data` path, so a certificate parked anywhere else inside
 * the descriptor is never read as one the provider published.
 */
function certificateElements(key: Element): Element[] {
	let info = child(key, SIGNATURE_NS, "KeyInfo");
	if (!info) return [];

	let elements: Element[] = [];
	for (let data of children(info, SIGNATURE_NS, "X509Data")) {
		elements.push(...children(data, SIGNATURE_NS, "X509Certificate"));
	}

	return elements;
}

/**
 * One published key, carrying the certificate's own base64 so a provider
 * imports exactly the bytes the fingerprint a tenant compares was taken over.
 */
function keyDescriptor(use: "signing" | "encryption", certificate: Certificate): XML.Element {
	return {
		name: "md:KeyDescriptor",
		attributes: { use },
		children: [
			{
				name: "ds:KeyInfo",
				attributes: { "xmlns:ds": SIGNATURE_NS },
				children: [
					{
						name: "ds:X509Data",
						children: [{ name: "ds:X509Certificate", children: [certificate.toBase64()] }],
					},
				],
			},
		],
	};
}
