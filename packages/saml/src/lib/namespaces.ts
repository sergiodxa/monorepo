/**
 * The namespace URIs and algorithm identifiers SAML documents are written in,
 * named once so a comparison anywhere in the package is against a constant
 * rather than a string typed again, where a typo reads as a missing element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** SAML 2.0 assertion namespace, where `Assertion` and everything inside it lives. */
export const ASSERTION_NS = "urn:oasis:names:tc:SAML:2.0:assertion";

/** SAML 2.0 protocol namespace, where `Response` and `AuthnRequest` live. */
export const PROTOCOL_NS = "urn:oasis:names:tc:SAML:2.0:protocol";

/** SAML 2.0 metadata namespace. */
export const METADATA_NS = "urn:oasis:names:tc:SAML:2.0:metadata";

/** XML Signature namespace. */
export const SIGNATURE_NS = "http://www.w3.org/2000/09/xmldsig#";

/** XML Encryption namespace. */
export const ENCRYPTION_NS = "http://www.w3.org/2001/04/xmlenc#";

/** The namespace `xml:` is implicitly bound to and which is never declared. */
export const XML_NS = "http://www.w3.org/XML/1998/namespace";

/** The namespace `xmlns` attributes themselves belong to. */
export const XMLNS_NS = "http://www.w3.org/2000/xmlns/";

/** Exclusive XML Canonicalization 1.0, the only canonicalization this package performs. */
export const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";

/** The transform that removes the enclosing signature before the digest is taken. */
export const ENVELOPED_SIGNATURE = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

/**
 * Digest algorithms accepted in a `ds:DigestMethod`, mapped to the name Web
 * Crypto knows them by. SHA-1 is absent, so a document naming it resolves to
 * nothing and is refused where the lookup fails.
 */
export const DIGEST_ALGORITHMS: Record<string, "SHA-256" | "SHA-384" | "SHA-512"> = {
	"http://www.w3.org/2001/04/xmlenc#sha256": "SHA-256",
	"http://www.w3.org/2001/04/xmldsig-more#sha384": "SHA-384",
	"http://www.w3.org/2001/04/xmlenc#sha512": "SHA-512",
};

/**
 * One accepted `ds:SignatureMethod`, split into the key type it needs and the
 * digest it runs over, which together are what importing and verifying take.
 */
export interface SignatureAlgorithm {
	key: "RSA" | "EC";
	hash: "SHA-256" | "SHA-384" | "SHA-512";
}

/**
 * Signature methods accepted in a `ds:SignatureMethod`. RSASSA-PKCS1-v1_5 and
 * ECDSA over the three SHA-2 sizes; a document naming SHA-1, DSA or RSA-PSS
 * resolves to nothing and is refused where the lookup fails.
 */
export const SIGNATURE_ALGORITHMS: Record<string, SignatureAlgorithm> = {
	"http://www.w3.org/2001/04/xmldsig-more#rsa-sha256": { key: "RSA", hash: "SHA-256" },
	"http://www.w3.org/2001/04/xmldsig-more#rsa-sha384": { key: "RSA", hash: "SHA-384" },
	"http://www.w3.org/2001/04/xmldsig-more#rsa-sha512": { key: "RSA", hash: "SHA-512" },
	"http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256": { key: "EC", hash: "SHA-256" },
	"http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384": { key: "EC", hash: "SHA-384" },
	"http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512": { key: "EC", hash: "SHA-512" },
};

/** The `samlp:StatusCode` value that lets a response carry an assertion. */
export const STATUS_SUCCESS = "urn:oasis:names:tc:SAML:2.0:status:Success";

/** The binding an assertion is posted back over, and the only one an ACS accepts. */
export const HTTP_POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";

/** The binding an authentication request is sent over as a signed query string. */
export const HTTP_REDIRECT_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";

/** The `SubjectConfirmation` method whose data carries `Recipient` and `InResponseTo`. */
export const BEARER_CONFIRMATION = "urn:oasis:names:tc:SAML:2.0:cm:bearer";
