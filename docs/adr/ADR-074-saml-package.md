# ADR-074: SAML Package

## Status

**Implemented** - 2026-09-21

## Background

Every federation this repository speaks is OAuth 2.0 and OpenID Connect, through
`@sdxc/auth` and `@sdxc/oidc-provider`: JSON over HTTPS, keys fetched from a discovery
document. Enterprise buyers federate over SAML 2.0 — their directory posts a signed XML
document to a URL the service provider publishes, and everything decided about the person
comes out of reading it.

Three pieces exist: `@sdxc/xml` parses XML into a tree and writes it back (ADR-041),
`@sdxc/crypto` supplies digests, encodings and constant-time comparison (ADR-023), and
`@sdxc/jwt` holds key pairs. XML canonicalization exists nowhere in this repository, and
neither does XML signature verification.

## Context

### The signed element and the read element can differ

An XML signature covers whatever its `Reference URI` resolves to, and the reader then goes
looking for an assertion by name. Signature wrapping is the family of documents where those
two are not the same element: a legitimately signed assertion parked inside an `Extensions`
element or a `ds:Object` with a forged one where the reader looks first; two elements
carrying the same `ID`; a `Reference URI=""` over a document holding a second assertion.
Every one of them verifies, and the attacker needs no key, only one signed assertion, which
any employee of the target obtains by signing in once. This is the decision the package
exists to make, and it belongs to the shape of the API rather than to a list of checks.

### Workers is the runtime

| Constraint                                                           | Consequence                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `DOMParser` and `XMLSerializer` are `undefined` on workerd (ADR-041) | The tree comes from `@sdxc/xml`, in every runtime                           |
| No `node:crypto` and no `Buffer` here                                | `crypto.subtle`, with `Base64` and `Hex` from `@sdxc/crypto`                |
| Web Crypto imports `spki`, not X.509                                 | The package walks a certificate's DER to reach the public key               |
| HTTP-Redirect carries a DEFLATE payload                              | `CompressionStream("deflate-raw")`, which workerd, Node and Bun all provide |

### What `@sdxc/xml` gives, and the one thing it withholds

The parser already refuses most of what an XML attack needs: a DOCTYPE is skipped and never
honored, so no external entity is fetched and none expands; a duplicate attribute or an
entity outside the resolved sets is a parse failure, so a document built to confuse the
parser fails closed; comments and processing instructions are dropped, which makes
canonicalization without comments the only form the tree can express. It also drops
whitespace-only text nodes, and indentation is significant to a digest, so `XML.parse` gains
`{ whitespace: "preserve" }` — the feed-shaped default kept, this package given a faithful
tree.

## Decision

Add `@sdxc/saml`: the service-provider side of SAML 2.0 Web Browser SSO, built on
`@sdxc/xml` and `@sdxc/crypto`, running on Web Crypto alone. It exports plain functions and
documents the namespace import, as `@sdxc/u` and `@sdxc/webhooks` (ADR-026) establish.
Identity-provider support is out of scope and is not planned: issuing and signing assertions
for other people's service providers is a different product with a different key-handling
story, and this package consumes what an IdP produces.

### 1. A verified assertion is the only assertion

```ts
import * as SAML from "@sdxc/saml";

let result = await SAML.verifyResponse(samlResponse, {
	certificates, // the connection's active signing certificates
	audience: entityId,
	destination: acsUrl,
	recipient: acsUrl,
	inResponseTo: requestId, // a string, or null for an IdP-initiated sign-in
	decryptionKey, // CryptoKey, where the connection accepts encryption
	replay, // { seen, remember }, as ADR-026 defines it
	clock: { now, skew },
});
```

Every option is required and none carries a default, so a call that forgets the audience
does not typecheck, `inResponseTo: null` is a sentence somebody wrote rather than a field
left off, and the replay check that makes the others worth running is always present. The
function refuses a DOCTYPE on the source before parsing, parses with whitespace preserved,
and then:

1. Collects `ds:Signature` elements and requires exactly one, over the `Response` or over
   an `Assertion`, then resolves its `Reference URI` to an element by `ID`, requiring
   exactly one element in the whole document to carry that value — two is a failure, never
   a first match.
2. Applies the transforms, canonicalizes that subtree, digests it, and compares, then
   canonicalizes `SignedInfo` and verifies it against each active certificate's key.
3. Builds the result **from the verified element alone**. Where the `Response` is signed,
   the document must hold exactly one `Assertion`, descended from that element.

What comes back is a `SAML.Assertion` — `issuer`, `nameId`, `sessionIndex`, `notOnOrAfter`
and `attribute()` — or a typed failure. There is no `SAML.parseResponse`, the document tree
is never returned, and the `Assertion` constructor is unexported, so reading claims from an
element the signature did not cover is not discouraged: there is nothing to read them from.
`Destination`, `Audience`, `Recipient`, `NotBefore`, `NotOnOrAfter`, `InResponseTo` and the
assertion id against the replay store are checked in that same call, none of them a step a
caller stands midway through.

An `EncryptedAssertion` is decrypted with `decryptionKey` first, the plaintext must parse
to exactly one `Assertion`, and the signature check runs over that. Key transport is
RSA-OAEP with MGF1-SHA-1 or MGF1-SHA-256, since IdPs emit both, and content encryption is
AES-128/256 in GCM or CBC, where one indistinguishable failure covers every decryption
outcome and keeps CBC from answering questions.

### 2. Canonicalization stays inside

Exclusive XML Canonicalization 1.0, with and without an `InclusiveNamespaces PrefixList`,
is implemented over the `@sdxc/xml` tree and is unexported. Publishing `canonicalize()`
beside a verifier hands a caller the two primitives whose recombination is the wrapping
attack, and keeping them joined is most of what section 1 buys. Accepted transforms are
`enveloped-signature` and `exc-c14n`, in that order; signature methods are RSASSA-PKCS1-v1_5
and ECDSA over SHA-256, SHA-384 and SHA-512, and digests are the same three. SHA-1 is
refused in both, a refusal the OAEP mask generation above falls outside of, depending on no
collision resistance.

### 3. The rest of the surface

```ts
SAML.createAuthnRequest(options); // Redirect and POST bindings, id and RelayState
SAML.parseIdPMetadata(source); // entity id, SSO endpoints, certificates
SAML.buildServiceProviderMetadata(options); // the document an IdP is handed
SAML.Certificate.parse(pem); // fingerprint, validity window, public key
```

`createAuthnRequest` mints an id as `_` plus hex from `randomBytes`, an `xsd:ID` not being
allowed to begin with a digit; over Redirect it deflates and signs the query string, over
POST it signs the XML through the canonicalization the verifier uses. `SAML.Certificate`
carries a validity window and a fingerprint, which is what tracking rotation needs.

### 4. Deliberately unsupported

Named in the error, so a tenant reads why rather than meeting a generic refusal: the
identity-provider role; Single Logout in either direction; inclusive canonicalization 1.0
and 1.1; any `#WithComments` variant, which the tree cannot express; XPath and XSLT
transforms, which put an evaluator inside the security boundary to serve a feature whose
main use is wrapping; HTTP-Artifact, SOAP, ECP and attribute queries; SAML 1.1; DSA and
RSA-PSS; SHA-1.

### 5. Tests

Specification vectors cover canonicalization. Interoperability is covered by `Response`
documents captured from developer sandbox tenants at Okta, Entra ID, Google Workspace,
OneLogin, JumpCloud, Shibboleth and ADFS — original bytes and signatures, expired
certificates, a frozen clock, no real person's data. Each seeds wrapped variants: the
forged assertion as a sibling of the signed element, inside `Extensions`, inside a
`ds:Object`, and as a second element sharing the signed element's `ID`. Every variant
records the failure kind it must produce, so a change that keeps a refusal while moving its
reason is caught, and a mutation pass flips one byte in the signature, in the digest and in
the canonicalized region of every fixture. The suite runs in the `packages-workers` Vitest
project (ADR-035), because workerd is where it ships.

## Consequences

### Positive

- The element a signature covers and the element claims come from are one element, held
  there by there being no other element a caller can reach.
- SAML runs on Workers with no DOM and no Node crypto, one implementation serves every IdP
  so the next connection is fixture work, and certificate expiry is a readable date.

### Negative

- Canonicalization and signature verification become this repository's to maintain, and a
  mistake in them is an authentication bypass. The wrapped-variant corpus is the guard,
  and it is only as good as the positions it enumerates.
- Refusing SHA-1 excludes an IdP configured for it, making that an integration
  conversation rather than a code path.
- Canonicalization is CPU over a whole subtree, so callers cap document size and depth
  first, and `@sdxc/xml` grows a parse option only this package passes.

### Neutral

- Canonicalization is unexported, so a second consumer — WS-Federation, signed metadata —
  moves it to `@sdxc/xml`, where the tree already lives.
- Single Logout is absent, leaving session ending to the provider's own revocation.

## Alternatives Considered

**Depend on an existing SAML library.** `samlify`, `node-saml` and `xml-crypto` assume a
Node DOM implementation and `node:crypto`, the pairing ADR-041 found absent on workerd.
Their surfaces also separate parsing from verification, the shape this package closes.

**Ship canonicalization and XML-DSig as `@sdxc/xml-dsig`.** Reusable, and it matches how
capabilities are packaged here. It also publishes `canonicalize()` and a verifier as
independent calls, and the gap between those two calls is the wrapping attack.

**Verify, then hand the document to the caller.** Conventional, and it lets an application
read anything an IdP sent. The convention is the mistake: the caller then selects an
element, and no documentation makes that selection match the reference.

## References

- [ADR-023](./ADR-023-web-crypto-primitives-package.md) — the digests, encodings and constant-time comparison this builds on
- [ADR-026](./ADR-026-standard-webhooks-parsing-package.md) — the namespace-import shape and the `ReplayStore` contract
- [ADR-035](./ADR-035-vite-plus-as-the-single-toolchain.md) — the `packages-workers` Vitest project the fixtures run in
- [ADR-041](./ADR-041-in-package-xml-parsing-and-serialization.md) — the parser and serializer, and why workerd has no DOM
- [Exclusive XML Canonicalization 1.0](https://www.w3.org/TR/xml-exc-c14n/) and the [SAML V2.0 profiles](https://docs.oasis-open.org/security/saml/v2.0/saml-profiles-2.0-os.pdf)
