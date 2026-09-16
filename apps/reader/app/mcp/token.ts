/**
 * The credential an agent presents, minted and read here. A token carries the reader's
 * subject and the id of the row describing it, signed under one Worker secret, so
 * verifying it names the object to open with no lookup and no index every reader shares.
 *
 * Nothing that can go stale is signed in: the scope, the expiry and the revocation live on
 * the row and are read on every request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url, Hex, hmac, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { env } from "cloudflare:workers";

/** What a token starts with, so a reader who finds one in a file knows what they have. */
export const TOKEN_PREFIX = "rdr_";

/** The prefix of a token row's id, which is half of what a payload carries. */
const TOKEN_ID_PREFIX = "tok";

/** What separates the signed payload from the signature over it. */
const SEPARATOR = ".";

/** Who a verified token belongs to, and which row describes what it may do. */
export interface AgentCredential {
	/** The reader's OIDC subject, which is the name of the object holding their data. */
	subject: string;
	/** The `tokens` row the scope, the expiry and the revocation are read from. */
	tokenId: string;
}

/** What one token's payload carries, spelled short because it travels in a config file. */
interface Payload {
	/** The reader's OIDC subject. */
	s: string;
	/** The `tokens` row id. */
	t: string;
}

/** A newly minted token, and the two values its row is written from. */
export interface MintedToken {
	/** The whole credential, shown to the reader exactly once. */
	token: string;
	tokenId: string;
	/** SHA-256 of the signature segment, which is what the row holds instead of the token. */
	hash: string;
}

/**
 * The key every token is signed under. Rotating it invalidates every token at once, which
 * is both the blast radius and the emergency lever.
 */
function secret(): string {
	return env.AGENT_TOKEN_SECRET;
}

/** SHA-256 of a signature segment, hex-encoded, as the row stores it. */
async function digest(signature: string): Promise<string> {
	let hashed = await sha256(signature);
	if (isFailure(hashed)) throw new Error("the runtime refused a SHA-256 digest");
	return Hex.encode(hashed.data);
}

/**
 * Mints a token for one reader, along with the id and hash its row is written from.
 *
 * The caller shows `token` once and stores nothing but `hash`, so nothing anybody could
 * replay survives the response that handed it over.
 *
 * @param subject - The reader's OIDC subject.
 * @example let minted = await mintAgentToken(viewer.id);
 */
export async function mintAgentToken(subject: string): Promise<MintedToken> {
	let tokenId = TypeID.fromUUID(TOKEN_ID_PREFIX, generateUUID()).toString();
	let payload = Base64Url.encode(JSON.stringify({ s: subject, t: tokenId } satisfies Payload));

	let signed = await hmac.sign(secret(), payload);
	if (isFailure(signed)) throw new Error("the runtime refused an HMAC signature");

	let signature = Base64Url.encode(signed.data);

	return {
		token: `${TOKEN_PREFIX}${payload}${SEPARATOR}${signature}`,
		tokenId,
		hash: await digest(signature),
	};
}

/**
 * Reads a presented token, answering who it belongs to, or `null` for one this deployment
 * did not mint.
 *
 * A token whose signature does not verify is answered before anything is read, so a forged
 * value wakes no object.
 *
 * @param raw - Whatever arrived in the `Authorization` header.
 * @example let credential = await readAgentToken(presented);
 */
export async function readAgentToken(raw: string): Promise<AgentCredential | null> {
	if (!raw.startsWith(TOKEN_PREFIX)) return null;

	let body = raw.slice(TOKEN_PREFIX.length);
	let boundary = body.indexOf(SEPARATOR);
	if (boundary <= 0) return null;

	let payload = body.slice(0, boundary);
	let signature = body.slice(boundary + SEPARATOR.length);
	if (signature.length === 0) return null;

	let decodedSignature = Base64Url.decode(signature);
	if (isFailure(decodedSignature)) return null;

	let verified = await hmac.verify(secret(), payload, decodedSignature.data);
	if (isFailure(verified) || !verified.data) return null;

	let decoded = Base64Url.decode(payload);
	if (isFailure(decoded)) return null;

	return read(new TextDecoder().decode(decoded.data));
}

/**
 * The SHA-256 a row holds for a presented token, so the settings page can recognize one
 * without ever holding the token itself.
 *
 * @param raw - Whatever arrived in the `Authorization` header.
 */
export async function agentTokenHash(raw: string): Promise<string | null> {
	if (!raw.startsWith(TOKEN_PREFIX)) return null;

	let boundary = raw.indexOf(SEPARATOR, TOKEN_PREFIX.length);
	if (boundary < 0) return null;

	return await digest(raw.slice(boundary + SEPARATOR.length));
}

/**
 * The credential a decoded payload describes, or `null` for a document that is not one.
 *
 * The signature has already verified by the time this runs, so what it guards against is a
 * payload this app's own older shape wrote rather than a forgery.
 *
 * @param document - The payload's JSON.
 */
function read(document: string): AgentCredential | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(document);
	} catch {
		return null;
	}

	if (typeof parsed !== "object" || parsed === null) return null;

	let { s: subject, t: tokenId } = parsed as Partial<Payload>;
	if (typeof subject !== "string" || subject.length === 0) return null;
	if (typeof tokenId !== "string" || tokenId.length === 0) return null;

	return { subject, tokenId };
}
