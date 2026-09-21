/**
 * SAML 2.0 Web Browser SSO from the service provider's side: verify what an
 * identity provider posts, build the request that asked for it, and read and
 * write the metadata the two exchange. Everything runs on Web Crypto, so the
 * same implementation serves every runtime this ships to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Assertion } from "./assertion.js";
export type {
	AuthnRequest,
	AuthnRequestResult,
	CreateAuthnRequestOptions,
} from "./authn-request.js";
export type { IdPMetadata, ServiceProviderMetadataOptions } from "./metadata.js";
export type { ReplayStore } from "./replay-store.js";
export type { VerifyResponseOptions } from "./verify-response.js";

export { createAuthnRequest } from "./authn-request.js";
export { Certificate } from "./certificate.js";
export {
	AssertionConditionError,
	CertificateError,
	DecryptionFailedError,
	MalformedDocumentError,
	ReplayedAssertionError,
	ReplayStoreError,
	ResponseStatusError,
	SAMLError,
	SignatureMismatchError,
	UnresolvedReferenceError,
	UnsignedDocumentError,
	UnsupportedFeatureError,
	WrappedAssertionError,
} from "./errors.js";
export { buildServiceProviderMetadata, parseIdPMetadata } from "./metadata.js";
export { verifyResponse } from "./verify-response.js";
