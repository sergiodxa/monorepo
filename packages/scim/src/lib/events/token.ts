/**
 * The Security Event Token (RFC 8417) carrying SCIM events: a `JWT` typed `secevent+jwt`
 * so it never verifies as an access or ID token, with the subject in `sub_id` as RFC 9967
 * requires, and `createScimEvent` to fill the registered claims.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@sdxc/jwt";
import { generateUUID } from "@sdxc/uuid/v4";

import type { Events } from "../../events.js";

/** Milliseconds in a second, for the epoch-seconds `iat` claim. */
const MS_PER_SECOND = 1000;

/**
 * A SCIM event token. Sign it with `token.sign(algorithm, keys)`; a receiver verifies it
 * with `ScimEventToken.verify`, which requires the `secevent+jwt` type.
 *
 * @example let signed = await createScimEvent(input).sign(JWK.Algorithm.ES256, keys);
 * @example let event = await ScimEventToken.verify(body, jwks, { issuer, audience });
 */
export class ScimEventToken extends JWT {
	/** RFC 8417 §2.3's media type, which keeps a SET from passing as any other JWT. */
	static override type = "secevent+jwt";

	/**
	 * The `sub_id` claim in the `scim` format.
	 *
	 * @returns The subject, or `null` when absent or in another format
	 */
	get subjectId(): Events.SubjectId | null {
		let value = this.payload.sub_id;
		if (typeof value !== "object" || value === null) return null;
		let subject = value as Record<string, unknown>;
		if (subject.format !== "scim" || typeof subject.uri !== "string") return null;
		return subject as Events.SubjectId;
	}

	/**
	 * The `txn` claim, shared by every token one state change produces, and the `Set-Txn`
	 * an asynchronous request was answered with.
	 *
	 * @returns The transaction, or `null` when absent
	 */
	get transaction(): string | null {
		return typeof this.payload.txn === "string" ? this.payload.txn : null;
	}

	/**
	 * The `events` claim, one member per event URI.
	 *
	 * @returns Each event's payload by URI; empty when the claim is absent or malformed
	 */
	get events(): Record<string, Record<string, unknown>> {
		let value = this.payload.events;
		if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
		return value as Record<string, Record<string, unknown>>;
	}
}

/**
 * Builds an unsigned SCIM event token: a fresh `jti`, `iat` now, the subject as a `scim`
 * `sub_id` (the claim RFC 9967 identifies a SET's subject by), and each event under its URI.
 *
 * @param input - Issuer, audience, subject, the events, and the transaction
 * @returns The token, ready to sign
 * @example
 * createScimEvent({ issuer, audience: feedUri, subject: { uri: `/Users/${id}` }, events: [scimEvents.delete()] })
 */
export function createScimEvent(input: Events.TokenInput): ScimEventToken {
	let issuedAt = input.issuedAt ?? new Date();
	return new ScimEventToken({
		jti: input.id ?? generateUUID(),
		iat: Math.floor(issuedAt.getTime() / MS_PER_SECOND),
		iss: input.issuer,
		aud: input.audience,
		sub_id: { format: "scim", ...input.subject },
		...(input.transaction === undefined ? {} : { txn: input.transaction }),
		events: Object.fromEntries(input.events.map((event) => [event.uri, event.payload])),
	});
}
