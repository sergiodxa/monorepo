/**
 * The Security Event Token (RFC 8417) carrying SCIM events: a `SecurityEventToken` whose
 * subject is a `scim` `sub_id`, as RFC 9967 requires, and `createScimEvent` to build one
 * from a subject and the events of one state change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SecurityEventToken } from "@sdxc/jwt";

import type { Events } from "../../events.js";

/**
 * A SCIM event token. Sign it with `token.sign(algorithm, keys)`; a receiver verifies it
 * with `ScimEventToken.verify`, which requires the `secevent+jwt` type and RFC 8417's claims.
 *
 * @example let signed = await createScimEvent(input).sign(JWK.Algorithm.ES256, keys);
 * @example let event = await ScimEventToken.verify(body, jwks, { issuer, audience });
 */
export class ScimEventToken extends SecurityEventToken {
	/**
	 * The `sub_id` claim in the `scim` format, the one RFC 9967 identifies a SCIM resource by.
	 *
	 * @returns The subject, or `null` when absent or in another format
	 */
	override get subjectId(): Events.SubjectId | null {
		let value = this.payload.sub_id;
		if (typeof value !== "object" || value === null) return null;
		let subject = value as Record<string, unknown>;
		if (subject.format !== "scim" || typeof subject.uri !== "string") return null;
		return subject as Events.SubjectId;
	}

	/** @param value - The subject, or `null` to drop the claim. */
	override set subjectId(value: Events.SubjectId | null) {
		this.payload.sub_id = value ?? undefined;
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
	return ScimEventToken.create({
		issuer: input.issuer,
		audience: input.audience,
		subjectId: { format: "scim", ...input.subject },
		events: Object.fromEntries(input.events.map((event) => [event.uri, event.payload])),
		...(input.id === undefined ? {} : { id: input.id }),
		...(input.issuedAt === undefined ? {} : { issuedAt: input.issuedAt }),
		...(input.transaction === undefined ? {} : { transaction: input.transaction }),
	});
}
