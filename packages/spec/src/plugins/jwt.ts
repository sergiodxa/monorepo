/**
 * The built-in `jwt` capability: read and verify JSON Web Tokens, the core of
 * specifying an OIDC server. `jwt.decode` splits a token into its header and
 * payload with no signature check — permissionless, for asserting claims.
 * `jwt.verify` proves a token is genuinely signed: it fetches the issuer's JWKS,
 * selects the key the token names, and checks the ES256 signature and expiry
 * with Bun's WebCrypto — so a spec can assert an id_token is really issuer-signed
 * rather than merely well-formed. Verifying reaches the network to read the JWKS,
 * so it declares `net`; decoding touches nothing and declares no permission.
 *
 * Only ES256 (ECDSA P-256 / SHA-256) is supported: it is the single algorithm
 * the target OIDC server advertises and signs with, and refusing every other
 * `alg` outright closes the "alg confusion" downgrade rather than trusting a
 * header field. No JWT library is used — WebCrypto verifies a raw r‖s signature
 * against a `{kty,crv,x,y}` public JWK directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";

import { ToolError } from "../errors";

/** The only signature algorithm this capability supports; see the module note. */
const SUPPORTED_ALG = "ES256";

/** Descriptors of every tool the `jwt` namespace exposes. */
const DESCRIPTORS: ToolDescriptor[] = [
	{
		name: "decode",
		summary: "Split a JWT into its header and payload objects, without checking the signature.",
		kind: "observable",
		params: [
			{ name: "token", kind: "value", required: true, summary: "The compact JWT string to read." },
		],
	},
	{
		name: "verify",
		summary: "Verify a JWT's ES256 signature against a JWKS and return its payload.",
		kind: "action",
		requires: "net",
		params: [
			{
				name: "token",
				kind: "value",
				required: true,
				summary: "The compact JWT string to verify.",
			},
			{
				name: "jwks_url",
				kind: "value",
				required: true,
				summary: "Absolute URL of the JWKS document that publishes the signing keys.",
			},
		],
	},
];

/**
 * Create the built-in `jwt` plugin (namespace `"jwt"`): `jwt.decode` (a
 * permissionless observable) and `jwt.verify` (a `net` action). Neither throws;
 * every malformed token, missing key, bad signature, or expired token is a
 * {@link ToolError}, and a denied `net` grant surfaces as the runtime's
 * permission error before any JWKS is fetched.
 */
export function createJwtPlugin(): Plugin {
	return {
		namespace: "jwt",
		describe() {
			return DESCRIPTORS;
		},
		async call(tool, args, context) {
			if (tool === "decode") return decode(args);
			if (tool === "verify") return await verify(args, context);
			return failure(new ToolError(`jwt has no tool "${tool}"; available tools: decode, verify`));
		},
	};
}

/** A token split into its three compact segments. */
interface Segments {
	/** The base64url-encoded protected header. */
	header: string;
	/** The base64url-encoded payload. */
	payload: string;
	/** The base64url-encoded signature. */
	signature: string;
}

/**
 * `jwt.decode <token>` → `{ header, payload }`. Both segments are base64url
 * decoded and JSON parsed; the signature is ignored entirely, so this is a pure,
 * permissionless read used to assert on claims. A token without exactly three
 * segments, or with a segment that is not base64url of a JSON object, is a tool
 * error.
 */
function decode(args: ToolArg[]): Result<Value, SpecError> {
	let token = readString("decode", args, 0, "token");
	if (isFailure(token)) return token;
	let split = splitToken("decode", token.data);
	if (isFailure(split)) return split;
	let header = decodeJsonObject("decode", "header", split.data.header);
	if (isFailure(header)) return header;
	let payload = decodeJsonObject("decode", "payload", split.data.payload);
	if (isFailure(payload)) return payload;
	return success({ header: header.data, payload: payload.data });
}

/**
 * `jwt.verify <token> <jwks_url>` → the verified payload. Steps, in order:
 * decode the header and require `alg === ES256` (closing alg-downgrade before
 * any I/O); pass the `net` check for the JWKS host and fetch it; select the key
 * the token's `kid` names (or the sole/only-EC key when the header omits a kid);
 * import it as an ECDSA P-256 public key and verify the raw signature over
 * `header.payload`; then reject an expired (`exp`) or not-yet-valid (`nbf`)
 * token. Any failure is a tool error; only success returns the payload.
 */
async function verify(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let token = readString("verify", args, 0, "token");
	if (isFailure(token)) return token;
	let jwksUrl = readString("verify", args, 1, "jwks_url");
	if (isFailure(jwksUrl)) return jwksUrl;

	let split = splitToken("verify", token.data);
	if (isFailure(split)) return split;
	let header = decodeJsonObject("verify", "header", split.data.header);
	if (isFailure(header)) return header;
	let alg = header.data.alg;
	if (alg !== SUPPORTED_ALG) {
		return failure(
			new ToolError(
				`jwt.verify only supports the ${SUPPORTED_ALG} algorithm, but the token header declares "${String(alg)}"`,
			),
		);
	}
	let kid = typeof header.data.kid === "string" ? header.data.kid : undefined;

	let target = parseJwksUrl(jwksUrl.data);
	if (isFailure(target)) return target;
	let allowed = context.permissions.checkNet(target.data.hostname, portOf(target.data));
	if (isFailure(allowed)) return allowed;

	let keys = await fetchKeys(target.data);
	if (isFailure(keys)) return keys;
	let jwk = selectKey(keys.data, kid);
	if (isFailure(jwk)) return jwk;
	let key = await importKey(jwk.data);
	if (isFailure(key)) return key;

	let verified = await checkSignature(
		key.data,
		`${split.data.header}.${split.data.payload}`,
		split.data.signature,
	);
	if (isFailure(verified)) return verified;

	let payload = decodeJsonObject("verify", "payload", split.data.payload);
	if (isFailure(payload)) return payload;
	let temporal = checkTemporal(payload.data);
	if (isFailure(temporal)) return temporal;
	return success(payload.data);
}

/** Split a compact JWT into its three segments, or a tool error. */
function splitToken(tool: string, token: string): Result<Segments, SpecError> {
	let parts = token.split(".");
	if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
		return failure(
			new ToolError(
				`jwt.${tool} expected a compact JWT with three dot-separated segments; got ${parts.length}`,
			),
		);
	}
	return success({ header: parts[0] ?? "", payload: parts[1] ?? "", signature: parts[2] ?? "" });
}

/**
 * base64url-decode a segment and JSON-parse it into an object. A segment that is
 * not valid base64url, not valid JSON, or JSON that is not an object (a number,
 * string, array, or null) is a tool error naming which segment failed.
 */
function decodeJsonObject(
	tool: string,
	part: string,
	segment: string,
): Result<ValueObject, SpecError> {
	let bytes = base64urlToBytes(segment);
	if (bytes === null) {
		return failure(new ToolError(`jwt.${tool} could not base64url-decode the ${part} segment`));
	}
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return failure(new ToolError(`jwt.${tool} ${part} segment is not valid UTF-8`));
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return failure(new ToolError(`jwt.${tool} ${part} segment is not valid JSON`));
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return failure(new ToolError(`jwt.${tool} ${part} segment is not a JSON object`));
	}
	return success(parsed as ValueObject);
}

/**
 * Select the JWKS key a token should verify against. When the header names a
 * `kid`, exactly that key must be present — a named-but-absent kid is a hard
 * error, never silently falling back to another key. When the header omits a
 * kid, the sole key is used, or the single EC/P-256 key among several; no
 * usable key is an error.
 */
function selectKey(keys: ValueObject[], kid: string | undefined): Result<ValueObject, SpecError> {
	if (kid !== undefined) {
		let match = keys.find((key) => key.kid === kid);
		if (match === undefined) {
			return failure(new ToolError(`jwt.verify found no JWKS key with kid "${kid}"`));
		}
		return success(match);
	}
	if (keys.length === 1 && keys[0] !== undefined) return success(keys[0]);
	let ec = keys.find((key) => key.kty === "EC" && key.crv === "P-256");
	if (ec === undefined) {
		return failure(
			new ToolError(
				"jwt.verify could not select a signing key: the header has no kid and the JWKS has no unambiguous EC P-256 key",
			),
		);
	}
	return success(ec);
}

/** Import a JWKS entry as an ECDSA P-256 public key restricted to verifying. */
async function importKey(jwk: ValueObject): Promise<Result<CryptoKey, SpecError>> {
	let material = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
	if (material.kty !== "EC" || material.crv !== "P-256") {
		return failure(
			new ToolError(
				`jwt.verify selected a key that is not EC P-256 (kty "${String(material.kty)}", crv "${String(material.crv)}")`,
			),
		);
	}
	try {
		let key = await crypto.subtle.importKey(
			"jwk",
			material as JsonWebKey,
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["verify"],
		);
		return success(key);
	} catch (error) {
		return failure(
			new ToolError(`jwt.verify could not import the signing key: ${describeError(error)}`),
		);
	}
}

/**
 * Verify the ES256 signature over the signing input `header.payload`. WebCrypto
 * consumes the raw 64-byte r‖s signature that JWS carries directly; a decode
 * failure or a false result is a signature tool error.
 */
async function checkSignature(
	key: CryptoKey,
	signingInput: string,
	signatureSegment: string,
): Promise<Result<undefined, SpecError>> {
	let signature = base64urlToBytes(signatureSegment);
	if (signature === null) {
		return failure(new ToolError("jwt.verify could not base64url-decode the signature segment"));
	}
	let ok: boolean;
	try {
		ok = await crypto.subtle.verify(
			{ name: "ECDSA", hash: "SHA-256" },
			key,
			signature,
			new TextEncoder().encode(signingInput),
		);
	} catch (error) {
		return failure(
			new ToolError(`jwt.verify could not check the signature: ${describeError(error)}`),
		);
	}
	if (!ok)
		return failure(
			new ToolError("jwt.verify signature check failed: the token is not signed by the JWKS key"),
		);
	return success(undefined);
}

/**
 * Reject an expired or not-yet-valid token. `exp` is required and must be a
 * finite number of seconds; a token whose `exp` is at or before now is expired.
 * `nbf`, when present, must not be in the future. Both are compared with no
 * clock skew, for deterministic specs.
 */
function checkTemporal(payload: ValueObject): Result<undefined, SpecError> {
	let now = Math.floor(Date.now() / 1000);
	let exp = payload.exp;
	if (typeof exp !== "number" || !Number.isFinite(exp)) {
		return failure(
			new ToolError("jwt.verify requires a numeric exp claim, but the token has none"),
		);
	}
	if (exp <= now) {
		return failure(
			new ToolError(`jwt.verify token expired: exp ${exp} is at or before now ${now}`),
		);
	}
	let nbf = payload.nbf;
	if (typeof nbf === "number" && Number.isFinite(nbf) && nbf > now) {
		return failure(new ToolError(`jwt.verify token not yet valid: nbf ${nbf} is after now ${now}`));
	}
	return success(undefined);
}

/** Fetch and validate a JWKS document, returning its `keys` array. */
async function fetchKeys(url: URL): Promise<Result<ValueObject[], SpecError>> {
	let response: Response;
	try {
		response = await fetch(url);
	} catch (error) {
		return failure(
			new ToolError(`jwt.verify could not fetch the JWKS at ${url.href}: ${describeError(error)}`),
		);
	}
	if (!response.ok) {
		return failure(
			new ToolError(`jwt.verify got HTTP ${response.status} fetching the JWKS at ${url.href}`),
		);
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return failure(new ToolError(`jwt.verify got a non-JSON JWKS body from ${url.href}`));
	}
	if (
		typeof body !== "object" ||
		body === null ||
		!Array.isArray((body as { keys?: unknown }).keys)
	) {
		return failure(new ToolError(`jwt.verify JWKS at ${url.href} has no "keys" array`));
	}
	let keys: ValueObject[] = [];
	for (let key of (body as { keys: unknown[] }).keys) {
		if (typeof key === "object" && key !== null && !Array.isArray(key))
			keys.push(key as ValueObject);
	}
	if (keys.length === 0) {
		return failure(new ToolError(`jwt.verify JWKS at ${url.href} contains no usable keys`));
	}
	return success(keys);
}

/** Parse the JWKS URL, requiring an absolute http(s) URL. */
function parseJwksUrl(raw: string): Result<URL, SpecError> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return failure(new ToolError(`jwt.verify requires an absolute JWKS URL; got "${raw}"`));
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return failure(
			new ToolError(`jwt.verify supports absolute http(s) JWKS URLs only; got "${raw}"`),
		);
	}
	return success(url);
}

/** The port the JWKS fetch will reach: the URL's own, or the scheme default. */
function portOf(url: URL): number {
	if (url.port !== "") return Number(url.port);
	return url.protocol === "https:" ? 443 : 80;
}

/**
 * Decode an unpadded base64url segment into bytes, tolerating standard-alphabet
 * input too. Returns null when the segment is not valid base64. The buffer is a
 * plain `ArrayBuffer` so the bytes satisfy WebCrypto's `BufferSource` parameter.
 */
function base64urlToBytes(segment: string): Uint8Array<ArrayBuffer> | null {
	let normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
	let pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
	let binary: string;
	try {
		binary = atob(normalized + pad);
	} catch {
		return null;
	}
	let bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

/** Read the argument at `index` as a required string, or a tool error. */
function readString(
	tool: string,
	args: ToolArg[],
	index: number,
	name: string,
): Result<string, SpecError> {
	let arg = args[index];
	if (arg === undefined || arg.kind !== "value" || typeof arg.value !== "string") {
		return failure(new ToolError(`jwt.${tool} requires its ${name} argument to be a string`));
	}
	return success(arg.value);
}

/** Render an unknown thrown value as a one-line message. */
function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
