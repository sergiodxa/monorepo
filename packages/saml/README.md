# @sdxc/saml

SAML 2.0 service provider: verify signed assertions, build requests and metadata.

An identity provider posts a signed XML document to your assertion consumer service; this package
verifies it, builds the request that asked for it, and reads and writes the metadata the two sides
exchange. It runs on Web Crypto alone, so the same code works in workerd, Node, Bun and Deno.

Verification hands back an `Assertion` read from the exact element the signature covered, and that
is the only way to read claims: the document tree is never exposed, so a signature-wrapping attack
(a signed assertion hidden next to a forged one) has nothing to slip through.

## Installation

```sh
npm add @sdxc/saml
```

Every call answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
Clock skew and replay TTLs are duration strings from
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration).

## Usage

### Verify a response

```typescript
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";

let result = await SAML.verifyResponse(samlResponseXml, {
	certificates, // the provider's signing certificates
	audience: "https://sp.example.com/metadata",
	destination: "https://sp.example.com/acs",
	recipient: "https://sp.example.com/acs",
	inResponseTo: requestId, // or null for a sign-in the provider started
	decryptionKey: null, // or the private key(s) for encrypted assertions
	replay, // a ReplayStore
	clock: { now: new Date(), skew: "60 seconds" },
});

if (isFailure(result)) return new Response(null, { status: 403 });

let assertion = result.data;
assertion.nameId?.value;
assertion.attribute("email");
```

Every option is required, so a call that forgets the audience or the replay store does not
typecheck. One call checks the signature, the wrapping, `Destination`, `Audience`, `Recipient`,
`NotBefore`, `NotOnOrAfter`, `InResponseTo` and the replay store before it answers.

### Start a sign-in

```typescript
import { isSuccess } from "@sdxc/result";
import * as SAML from "@sdxc/saml";

let request = await SAML.createAuthnRequest({
	binding: "redirect",
	destination: "https://idp.example.com/sso",
	issuer: "https://sp.example.com/metadata",
	assertionConsumerService: "https://sp.example.com/acs",
	nameIdFormat: null,
	forceAuthn: false,
	relayState: "/dashboard",
	signingKey: null,
	now: new Date(),
});

if (isSuccess(request)) {
	await saveRequestId(request.data.id);
	return Response.redirect(request.data.url!, 302);
}
```

Keep `id`: passing it back as `inResponseTo` binds the response to the browser that asked for it.

### Read and write metadata

```typescript
import { isSuccess } from "@sdxc/result";
import * as SAML from "@sdxc/saml";

let idp = await SAML.parseIdPMetadata(idpMetadataXml);
if (isSuccess(idp)) {
	idp.data.entityId;
	idp.data.singleSignOn; // [{ binding, location }]
	idp.data.signing; // Certificate[]
}

let metadata = SAML.buildServiceProviderMetadata({
	entityId: "https://sp.example.com/metadata",
	assertionConsumerService: "https://sp.example.com/acs",
	certificate: null,
	nameIdFormat: null,
	wantAssertionsSigned: true,
	authnRequestsSigned: false,
	validUntil: null,
});

if (isSuccess(metadata)) {
	return new Response(metadata.data, {
		headers: { "Content-Type": "application/samlmetadata+xml" },
	});
}
```

## API

### `verifyResponse(source: string, options: VerifyResponseOptions): Promise<Result<Assertion, SAMLError>>`

Verifies a response and answers with its assertion. `source` is the base64-decoded `SAMLResponse`
XML. A signature verifying under any one of `certificates` is accepted. An accepted assertion id is
remembered in `replay` for the rest of the assertion's own validity window.

- `certificates`: the provider's signing certificates
- `audience`: your entity id
- `destination` / `recipient`: your assertion consumer service URL
- `inResponseTo`: the id of the request this answers, or `null` for a provider-initiated sign-in
- `decryptionKey`: an RSA-OAEP private key, several, or `null` to accept cleartext assertions only
- `replay`: a `ReplayStore`
- `clock`: `{ now, skew }`, the moment every window is judged against and the drift allowed

### `createAuthnRequest(options: CreateAuthnRequestOptions): Promise<Result<AuthnRequestResult, SAMLError>>`

Builds an authentication request for the `"redirect"` or `"post"` binding. The result carries the
request `id`, plus a `url` to redirect to (redirect binding) or a `form` of `{ action, samlRequest,
relayState }` to post (POST binding); the other is `null`. `signingKey` is an RSASSA-PKCS1-v1_5 or
ECDSA private key, or `null` to send the request unsigned.

### `parseIdPMetadata(source: string): Promise<Result<IdPMetadata, SAMLError>>`

Reads an identity provider's metadata into its entity id, sign-on endpoints, parsed signing and
encryption certificates, and `wantAuthnRequestsSigned`.

### `buildServiceProviderMetadata(options: ServiceProviderMetadataOptions): Result<string, SAMLError>`

Writes the metadata XML you hand an identity provider. A `certificate` is published for both
signing and encryption; `nameIdFormat` and `validUntil` are written when not `null`.

### `Certificate`

One X.509 certificate. Instances carry `fingerprint`, `subject`, `issuer`, `serial`, `notBefore`,
`notAfter`, `algorithm`, `spki` and `der`, with `validAt(date)`, `toPem()` and `toBase64()`.

#### `Certificate.parse(source: string): Promise<Result<Certificate, CertificateError>>`

Reads PEM, or the bare base64 a metadata document carries.

#### `Certificate.selfSigned(options: Certificate.SelfSignedOptions): Promise<Result<Certificate, CertificateError>>`

Generates a self-signed certificate from an RSASSA-PKCS1-v1_5 key pair, with `commonName`,
`notBefore` and `notAfter`.

### `Assertion`

A verified assertion; instances come only from `verifyResponse`. Carries `id`, `issuer`, `nameId`
(`{ value, format }` or `null`), `sessionIndex`, `authnInstant` and `notOnOrAfter`.
`attribute(name)` returns the first value or `null`, `values(name)` every value, `names()` every
attribute name, and `claims()` one record where a repeated attribute is an array. Attributes resolve
by both `Name` and `FriendlyName`.

### Errors

Every failure extends `SAMLError`; read `name` for the kind. Messages never carry key material or
document-supplied text, so they are safe to log.

| Error                      | Meaning                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `UnsupportedFeatureError`  | The document uses a refused feature, named in `feature`               |
| `MalformedDocumentError`   | Not readable XML, or a required element is absent                     |
| `UnsignedDocumentError`    | Not exactly one signature (`count`)                                   |
| `UnresolvedReferenceError` | The reference names no element or several (`count`)                   |
| `SignatureMismatchError`   | The signature did not verify under any certificate                    |
| `WrappedAssertionError`    | The signed element and the assertion element differ                   |
| `DecryptionFailedError`    | An encrypted assertion could not be opened, for any reason            |
| `ResponseStatusError`      | The provider reported a non-success `status` and `substatus`          |
| `AssertionConditionError`  | Authentic but not for here; `condition` names which check failed      |
| `ReplayedAssertionError`   | The assertion id was already accepted                                 |
| `ReplayStoreError`         | The replay store threw; no verdict was reached, so the user may retry |
| `CertificateError`         | A certificate could not be read or generated                          |

### Supported algorithms

Signatures use RSA or ECDSA with SHA-256 or stronger and exclusive canonicalization, over one
same-document reference. Encrypted assertions use RSA-OAEP key transport (MGF1 with SHA-1 or
SHA-256) and AES-128 or AES-256 in GCM or CBC. Everything else answers `UnsupportedFeatureError`,
including SHA-1, DSA, RSA-PSS, inclusive canonicalization, `#WithComments`, XPath and XSLT
transforms, `URI=""` references, document type declarations, and the identity-provider role,
Single Logout, HTTP-Artifact, SOAP, ECP and SAML 1.1.

Canonicalization costs CPU over the whole document, so cap the posted body size before verifying.

### Types

#### `VerifyResponseOptions`, `CreateAuthnRequestOptions`, `ServiceProviderMetadataOptions`

The options objects above. Every field is required.

#### `AuthnRequestResult` and `AuthnRequest.Binding`

The built request (`id`, `url`, `form`) and `"redirect" | "post"`.

#### `IdPMetadata` and `IdPMetadata.Endpoint`

Parsed provider metadata; an endpoint is `{ binding, location }`.

#### `ReplayStore`

`seen(id): Promise<boolean>` and `remember(id, ttl): Promise<void>`, where `ttl` is a duration.

#### `Assertion.NameId` and `Certificate.SelfSignedOptions`

`{ value, format }`, and `{ keys, commonName, notBefore, notAfter }`.

## Pattern: An Assertion Consumer Service

Decode the posted form, verify against the request you started, and tell a configuration problem
from an infrastructure one.

```typescript
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";

async function handleAcs(request: Request) {
	let form = await request.formData();
	let encoded = String(form.get("SAMLResponse") ?? "");
	let xml = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
	let relayState = form.get("RelayState");

	let result = await SAML.verifyResponse(xml, {
		certificates: await loadCertificates(),
		audience: "https://sp.example.com/metadata",
		destination: "https://sp.example.com/acs",
		recipient: "https://sp.example.com/acs",
		inResponseTo: await takeRequestId(request),
		decryptionKey: null,
		replay,
		clock: { now: new Date(), skew: "60 seconds" },
	});

	if (isFailure(result)) {
		let error = result.error;
		if (error instanceof SAML.ReplayStoreError) return new Response("Try again", { status: 503 });
		if (error instanceof SAML.AssertionConditionError) {
			logger.warn("assertion not for us", { condition: error.condition });
		} else {
			logger.warn("assertion rejected", { kind: error.name });
		}
		return new Response("Sign-in failed", { status: 403 });
	}

	await signIn(result.data.nameId?.value, result.data.sessionIndex);
	return Response.redirect(typeof relayState === "string" ? relayState : "/", 303);
}
```

## Pattern: A Replay Store On A Table

```typescript
import type { ReplayStore } from "@sdxc/saml";

import { toMs } from "@sdxc/duration";

let replay: ReplayStore = {
	async seen(id) {
		return (await db.findOne(assertionIds, { where: { id } })) !== null;
	},
	async remember(id, ttl) {
		await db.create(assertionIds, { id, expires_at: Date.now() + toMs(ttl) });
	},
};
```

An id is remembered only after every other check passed, and only for as long as the assertion
stays valid, so a periodic delete of expired rows keeps the table small.

## Pattern: Certificates That Rotate

Trust every certificate the provider's metadata lists, and refresh them on a schedule. A signature
verifying under any one of them is accepted, so a rotation needs no coordination, and `notAfter`
tells you when to warn an administrator.

```typescript
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";

let response = await fetch("https://idp.example.com/metadata");
let idp = await SAML.parseIdPMetadata(await response.text());
if (isFailure(idp)) throw idp.error;

for (let certificate of idp.data.signing) {
	await saveCertificate({
		fingerprint: certificate.fingerprint,
		notAfter: certificate.notAfter,
		pem: certificate.toPem(),
	});
}

let certificates: SAML.Certificate[] = [];
for (let pem of await loadCertificatePems()) {
	let parsed = await SAML.Certificate.parse(pem);
	if (!isFailure(parsed) && parsed.data.validAt(new Date())) certificates.push(parsed.data);
}
// pass `certificates` to verifyResponse
```

## Pattern: Signed Requests And Encrypted Assertions

Generate one key pair, publish a self-signed certificate for it, sign requests with it, and open
encrypted assertions with the same private key imported for RSA-OAEP. Providers use either OAEP
digest, so pass the key imported under both.

```typescript
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";

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
if (isFailure(certificate)) throw certificate.error;

let metadata = SAML.buildServiceProviderMetadata({
	entityId: "https://sp.example.com/metadata",
	assertionConsumerService: "https://sp.example.com/acs",
	certificate: certificate.data,
	nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
	wantAssertionsSigned: true,
	authnRequestsSigned: true,
	validUntil: null,
});

let pkcs8 = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
let decryptionKey = await Promise.all(
	["SHA-1", "SHA-256"].map((hash) =>
		crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash }, false, ["decrypt"]),
	),
);

let request = await SAML.createAuthnRequest({
	binding: "post",
	destination: "https://idp.example.com/sso",
	issuer: "https://sp.example.com/metadata",
	assertionConsumerService: "https://sp.example.com/acs",
	nameIdFormat: null,
	forceAuthn: true,
	relayState: null,
	signingKey: keys.privateKey,
	now: new Date(),
});
// request.data.form → { action, samlRequest, relayState } to render as an auto-submitting form
// later: SAML.verifyResponse(xml, { ...options, decryptionKey })
```

## Pattern: Mapping Attributes To An Account

Providers name the same attribute differently; `Assertion` answers to both `Name` and
`FriendlyName`, and `claims()` gives the whole set for a configurable mapping.

```typescript
import type { Assertion } from "@sdxc/saml";

let TRANSIENT = "urn:oasis:names:tc:SAML:2.0:nameid-format:transient";

function toAccount(assertion: Assertion) {
	let email =
		assertion.attribute("email") ??
		assertion.attribute("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");

	return {
		externalId: assertion.nameId?.format === TRANSIENT ? null : (assertion.nameId?.value ?? null),
		email,
		groups: assertion.values("groups"),
		raw: assertion.claims(),
	};
}
```

A transient `NameID` names one session, not a person, so link accounts by a persistent identifier
or an attribute instead.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/saml": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
