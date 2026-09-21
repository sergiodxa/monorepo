# @sdxc/saml

SAML 2.0 Web Browser SSO, from the service provider's side.

An enterprise buyer federates over SAML: their directory posts a signed XML document to a URL
this service publishes, and everything decided about the person comes out of reading it. This
package verifies that document, builds the request that asked for it, and reads and writes the
metadata the two sides exchange. It runs on Web Crypto alone, with no DOM and no Node crypto,
so one implementation serves every runtime — workerd included.

Identity-provider support is out of scope: issuing and signing assertions for other people's
service providers is a different job with a different key-handling story.

## The shape of the API is the security property

An XML signature covers whatever its reference resolves to, and a reader then goes looking for
an assertion by name. Signature wrapping is the family of documents where those are not the
same element — a legitimately signed assertion parked inside an `Extensions` element or a
signature object, with a forged one where the reader looks first; two elements carrying one
`ID`. Every one of them verifies, and an attacker needs no key, only one signed assertion,
which any employee of the target obtains by signing in once.

So there is no `parseResponse`, the document tree is never returned, and the `Assertion`
constructor is not exported. A verification answers with an assertion built from the element
the signature covered, and that is the only place claims are readable from.

## Usage

### Verify A Response

```typescript
import * as SAML from "@sdxc/saml";
import { isFailure } from "@sdxc/result";

let result = await SAML.verifyResponse(samlResponse, {
	certificates, // the connection's active signing certificates
	audience: "https://sp.example.com/metadata",
	destination: "https://sp.example.com/acs",
	recipient: "https://sp.example.com/acs",
	inResponseTo: requestId, // or null, for a sign-in the provider started
	decryptionKey, // a CryptoKey, several, or null for cleartext assertions
	replay, // { seen, remember }
	clock: { now: new Date(), skew: "60 seconds" },
});

if (isFailure(result)) return reject(result.error);

let assertion = result.data;
assertion.nameId?.value;
assertion.attribute("email");
```

Every option is required and none carries a default, so a call that forgets the audience does
not typecheck, `inResponseTo: null` is a sentence somebody wrote, and the replay check that
makes the others worth running is always present.

One call does all of it: the source is refused if it carries a document type declaration, the
document must hold exactly one signature, the reference must name an id exactly one element
carries, the signature must be enveloped by the element it references, and `Destination`,
`Audience`, `Recipient`, `NotBefore`, `NotOnOrAfter`, `InResponseTo` and the assertion id
against the replay store are all checked before an assertion comes back.

### Start A Sign-In

```typescript
let request = await SAML.createAuthnRequest({
	binding: "redirect",
	destination: idp.singleSignOn[0].location,
	issuer: "https://sp.example.com/metadata",
	assertionConsumerService: "https://sp.example.com/acs",
	nameIdFormat: null,
	forceAuthn: false,
	relayState: null,
	signingKey: privateKey,
	now: new Date(),
});

if (isSuccess(request)) {
	rememberRequestId(request.data.id);
	redirect(request.data.url);
}
```

Hold on to `id`: it is what the response has to answer with, and passing it back as
`inResponseTo` is what binds the assertion to the browser that asked for it.

### Read And Write Metadata

```typescript
let idp = await SAML.parseIdPMetadata(metadataXml);
// entityId, singleSignOn, signing, encryption, wantAuthnRequestsSigned

let document = SAML.buildServiceProviderMetadata({
	entityId: "https://sp.example.com/metadata",
	assertionConsumerService: "https://sp.example.com/acs",
	certificate, // published for both signing and encryption use
	nameIdFormat: null,
	wantAssertionsSigned: true,
	authnRequestsSigned: true,
	validUntil: null,
});
```

### Track Certificates

```typescript
let result = await SAML.Certificate.parse(pem);
if (isSuccess(result)) {
	result.data.fingerprint; // lowercase hex SHA-256, what a rotation is tracked by
	result.data.notAfter; // a readable date, so an expiry is announced before it happens
	result.data.validAt(new Date());
}
```

A service provider generates its own certificate from the key pair it keeps:

```typescript
let keys = await crypto.subtle.generateKey(
	{
		name: "RSASSA-PKCS1-v1_5",
		modulusLength: 2048,
		publicExponent: Uint8Array.of(1, 0, 1),
		hash: "SHA-256",
	},
	true,
	["sign", "verify"],
);

let certificate = await SAML.Certificate.selfSigned({
	keys,
	commonName: "sp.example.com",
	notBefore: new Date(),
	notAfter: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
});
```

## API

### `verifyResponse(source, options): Promise<Result<Assertion, SAMLError>>`

Verifies a response and answers with the assertion inside it. `source` is the decoded
`SAMLResponse` XML as the browser posted it.

### `createAuthnRequest(options): Promise<Result<AuthnRequestResult, SAMLError>>`

Builds an authentication request over the redirect or POST binding. The result carries the
request `id`, and either a `url` to redirect to or a `form` to post.

### `parseIdPMetadata(source): Promise<Result<IdPMetadata, SAMLError>>`

Reads an identity provider's metadata: entity id, sign-on endpoints, and the signing and
encryption certificates, each already parsed.

### `buildServiceProviderMetadata(options): Result<string, SAMLError>`

Writes the metadata document an identity provider is handed.

### `Certificate`

`Certificate.parse(source)` reads PEM or the bare base64 an XML document carries.
`Certificate.selfSigned(options)` generates one from a key pair. An instance carries
`fingerprint`, `subject`, `issuer`, `serial`, `notBefore`, `notAfter`, `algorithm`, `spki` and
`der`, with `validAt(date)`, `toPem()` and `toBase64()`.

### `Assertion`

What a verification answers with, and a type only — instances arrive from `verifyResponse`.
Carries `id`, `issuer`, `nameId`, `sessionIndex`, `authnInstant` and `notOnOrAfter`, with
`attribute(name)`, `values(name)`, `names()` and `claims()`. Attributes resolve by `Name` and
by `FriendlyName`.

### `ReplayStore`

The two-method contract a verification consults: `seen(id)` and `remember(id, ttl)`. Storage
stays out of this package so an application can keep accepted ids in a table it can inspect.

### Failures

Every failure extends `SAMLError`, so one `instanceof` covers the package while the subclasses
let a caller tell them apart:

| Failure                    | What it means                                                        |
| -------------------------- | -------------------------------------------------------------------- |
| `UnsupportedFeatureError`  | A feature this refuses, named in `feature` so a tenant can act on it |
| `MalformedDocumentError`   | Not readable XML, or a required element is absent                    |
| `UnsignedDocumentError`    | The document does not hold exactly one signature                     |
| `UnresolvedReferenceError` | The reference names no element, or more than one                     |
| `SignatureMismatchError`   | The digest or the signature did not check under any certificate      |
| `WrappedAssertionError`    | The signed element and the read element are two elements             |
| `DecryptionFailedError`    | One value for every outcome of opening an encrypted assertion        |
| `ResponseStatusError`      | The provider reported something other than success                   |
| `AssertionConditionError`  | Authentic, and addressed elsewhere or out of its window              |
| `ReplayedAssertionError`   | The assertion id was already accepted                                |
| `ReplayStoreError`         | The store could not be consulted, so no verdict was reached          |
| `CertificateError`         | A certificate could not be read                                      |

No message carries key material, a decrypted fragment, or anything an unauthenticated document
supplied beyond a fixed-vocabulary identifier, because these values are what gets logged.

## What this refuses, and why

Named in the error, so a tenant reads which part of a provider's configuration to change:

- **SHA-1**, in both signatures and digests, and **DSA** and **RSA-PSS**.
- **Inclusive canonicalization** 1.0 and 1.1, and every `#WithComments` variant.
- **XPath and XSLT transforms**, which put an evaluator inside the security boundary to serve
  a feature whose main use is wrapping.
- **A reference naming the whole document** (`URI=""`), and any reference that is not a
  same-document id.
- **More than one signature**, and more than one reference in one signature, because the
  reader would then choose which one decides.
- **A document type declaration**, refused on the source before parsing, and any processing
  instruction past a leading XML declaration.
- **The identity-provider role**, Single Logout, HTTP-Artifact, SOAP, ECP, attribute queries
  and SAML 1.1.

Key transport is RSA-OAEP under MGF1-SHA-1 or MGF1-SHA-256, since providers emit both; content
encryption is AES-128 or AES-256 in GCM or CBC. Every outcome of opening an encrypted assertion
is one `DecryptionFailedError`, which keeps CBC from answering questions one attempt at a time.

## Pattern: A Connection That Rotates Its Certificates

A provider's signing certificate expires on a date and rotates on a schedule nobody here
controls, so trust a set and let both events pass unnoticed:

```typescript
let idp = await SAML.parseIdPMetadata(await fetchMetadata(connection.metadataUrl));
if (isFailure(idp)) return;

for (let certificate of idp.data.signing) {
	await upsertCertificate(connection.id, {
		fingerprint: certificate.fingerprint,
		notAfter: certificate.notAfter,
		pem: certificate.toPem(),
	});
}
```

Pass every unretired certificate to `verifyResponse`; a signature verifying under any one of
them is accepted, so a rotation needs no coordination. `notAfter` is what a job reads to warn
an administrator before an expiry stops sign-ins.

## Pattern: A Replay Store On A Table

```typescript
let replay: SAML.ReplayStore = {
	async seen(id) {
		return (await db.findOne(assertionIds, { where: { id } })) !== null;
	},
	async remember(id, ttl) {
		await db.create(assertionIds, { id, expires_at: Date.now() + toMs(ttl) });
	},
};
```

A verification remembers an id only once every other check has passed, so a document that
failed verification cannot fill the store. The TTL it asks for is the rest of the assertion's
own window, which is exactly how long a captured document stays replayable.

## Related Packages

- `@sdxc/xml` — the parser and serializer the tree comes from, in every runtime
- `@sdxc/crypto` — the digests, encodings and constant-time comparison this builds on
- `@sdxc/result` — the `Result` every call answers with
- `@sdxc/duration` — the duration a clock skew and a replay TTL are written in

## Tips

- Bound the POST body before you hand it here, and cap document size and depth: canonicalization
  is CPU over a whole subtree, and a large assertion occupies whatever is running it.
- Read claims off the `Assertion`, never off a document of your own — the two are the same
  element only here.
- A sign-in the provider started binds to no browser, however tightly the window is drawn.
  Cap its window yourself, and let `RelayState` name a registered destination rather than
  carry a URL.
- `ReplayStoreError` is infrastructure, not authentication: answer it as a failure to reach a
  verdict, never as a rejected sign-in.
