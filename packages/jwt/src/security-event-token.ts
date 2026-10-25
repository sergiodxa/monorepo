/**
 * The Security Event Token of RFC 8417: a JWT typed `secevent+jwt` whose `events` claim
 * states what happened to a subject, with `txn`, `toe` and RFC 9493's `sub_id` as typed
 * accessors, so every SET profile builds and verifies its tokens through one class.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { generateUUID } from "@sdxc/uuid/v4";
import * as jose from "jose";

import type { JWK } from "./jwk.js";

import { JWT } from "./jwt.js";

/** Milliseconds in a second, for converting between epoch claims and `Date`. */
const MS_PER_SECOND = 1000;

/** The claims RFC 8417 §2.2 requires, plus the audience every SET here is addressed to. */
const REQUIRED_CLAIMS = ["iss", "iat", "jti", "aud"];

/**
 * The members each RFC 9493 format this class types must carry as a non-empty string; a
 * `sub_id` of one of these formats missing any of them reads as `null`.
 */
const SUBJECT_MEMBERS: Record<string, string[] | undefined> = {
	email: ["email"],
	iss_sub: ["iss", "sub"],
	opaque: ["id"],
};

/**
 * A Security Event Token. Build one with `SecurityEventToken.create`, sign it with
 * `token.sign(algorithm, keys)`, and verify a received one with `SecurityEventToken.verify`,
 * which requires the `secevent+jwt` type, `iss`, `iat`, `jti`, `aud` and a non-empty
 * `events` claim, and refuses an `exp`: a SET records something that already happened.
 *
 * Subclass it for a SET profile, adding accessors for the profile's own claims; `create`
 * and `verify` then produce the subclass.
 *
 * @example let set = await SecurityEventToken.create({ issuer, audience, events }).sign(JWK.Algorithm.ES256, keys);
 * @example let event = await SecurityEventToken.verify(raw, jwks, { issuer, audience });
 */
export class SecurityEventToken extends JWT {
	/**
	 * RFC 8417 §2.3's media type, which keeps a SET from verifying as an access token or
	 * any other explicitly typed JWT.
	 */
	static override type = "secevent+jwt";

	/**
	 * Builds an unsigned SET with every claim RFC 8417 requires: a fresh random `jti` and
	 * `iat` now unless given, and each event payload under its event URI.
	 *
	 * @param input - Issuer, audience, events, and the optional envelope claims
	 * @returns The token, ready to sign, as the class this is called on
	 * @example
	 * SecurityEventToken.create({
	 * 	issuer: "https://idp.example.com/",
	 * 	audience: "https://rp.example.com/",
	 * 	subjectId: { format: "email", email: "user@example.com" },
	 * 	events: { "https://schemas.openid.net/secevent/risc/event-type/account-disabled": { reason: "hijacking" } },
	 * });
	 */
	static create<M extends SecurityEventToken>(
		this: new (payload: JWT.Payload) => M,
		input: SecurityEventToken.Input,
	): M {
		let payload: JWT.Payload = {
			iss: input.issuer,
			iat: toEpochSeconds(input.issuedAt ?? new Date()),
			jti: input.id ?? generateUUID(),
			aud: input.audience,
			events: input.events,
		};

		if (input.subject !== undefined) payload.sub = input.subject;
		if (input.subjectId !== undefined) payload.sub_id = input.subjectId;
		if (input.transaction !== undefined) payload.txn = input.transaction;
		if (input.timeOfEvent !== undefined) payload.toe = toEpochSeconds(input.timeOfEvent);

		return new this(payload);
	}

	/**
	 * Verifies a SET as {@link JWT.verify} does, then holds it to RFC 8417: `iss`, `iat`,
	 * `jti` and `aud` present, `events` an object of one or more event objects, and no
	 * `exp`. A failed check throws jose's `JWTClaimValidationFailed` naming the claim.
	 *
	 * @param token - The compact-serialized SET
	 * @param jwks - The issuer's keys, or a resolver over them
	 * @param options - Expected issuer, audience, algorithms and clock tolerance
	 * @returns The verified token, as the class this is called on
	 * @throws When the signature, the type or any claim check fails
	 */
	static override async verify<M extends JWT>(
		this: (new (payload: JWT.Payload) => M) & Pick<typeof JWT, "type">,
		token: string,
		jwks: JWK.VerificationKeys,
		options?: JWT.VerifyOptions,
	): Promise<M> {
		let requiredClaims = [...new Set([...REQUIRED_CLAIMS, ...(options?.requiredClaims ?? [])])];
		let verified = (await JWT.verify.call(this, token, jwks, { ...options, requiredClaims })) as M;
		assertSecurityEventClaims(verified.payload);
		return verified;
	}

	/**
	 * The `events` claim: each event's payload under its event URI, every member describing
	 * an aspect of the same state change.
	 *
	 * @returns The payloads by URI; empty when the claim is absent or malformed
	 */
	get events(): SecurityEventToken.Events {
		let value = this.payload.events;
		if (!isObject(value)) return {};
		return value as SecurityEventToken.Events;
	}

	/** @param value - The events to carry, replacing any already set. */
	set events(value: SecurityEventToken.Events) {
		this.payload.events = value;
	}

	/**
	 * The `txn` claim, shared by every token one transaction produces so a receiver can
	 * correlate them.
	 *
	 * @returns The transaction identifier, or `null` when absent
	 */
	get transaction(): string | null {
		return typeof this.payload.txn === "string" ? this.payload.txn : null;
	}

	/** @param value - The transaction identifier, or `null` to drop the claim. */
	set transaction(value: string | null) {
		this.payload.txn = value ?? undefined;
	}

	/**
	 * The `toe` claim: when the event happened, which may precede `iat` by any amount.
	 *
	 * @returns The time of the event, or `null` when the issuer shares none
	 */
	get timeOfEvent(): Date | null {
		if (typeof this.payload.toe !== "number") return null;
		return new Date(this.payload.toe * MS_PER_SECOND);
	}

	/** @param value - The time of the event, or `null` to drop the claim. */
	set timeOfEvent(value: Date | null) {
		this.payload.toe = value === null ? undefined : toEpochSeconds(value);
	}

	/**
	 * The `sub_id` claim (RFC 9493 §4.1). An `email`, `iss_sub` or `opaque` identifier
	 * missing its required members reads as `null`; any other format is returned as given.
	 *
	 * @returns The subject identifier, or `null` when absent or malformed
	 */
	get subjectId(): SecurityEventToken.SubjectIdentifier | null {
		let value = this.payload.sub_id;
		if (!isObject(value) || typeof value.format !== "string") return null;
		let members = SUBJECT_MEMBERS[value.format] ?? [];
		let complete = members.every((name) => typeof value[name] === "string" && value[name] !== "");
		return complete ? (value as SecurityEventToken.SubjectIdentifier) : null;
	}

	/** @param value - The subject identifier, or `null` to drop the claim. */
	set subjectId(value: SecurityEventToken.SubjectIdentifier | null) {
		this.payload.sub_id = value ?? undefined;
	}
}

export namespace SecurityEventToken {
	/** Each event's payload under its event URI; an event with no claims is `{}`. */
	export type Events = Record<string, Record<string, unknown>>;

	/** An RFC 9493 `email` identifier. */
	export interface EmailSubject {
		format: "email";
		email: string;
	}

	/**
	 * An RFC 9493 `iss_sub` identifier: a subject as an ID token names it, where `iss` may
	 * differ from the SET's own issuer.
	 */
	export interface IssuerSubject {
		format: "iss_sub";
		iss: string;
		sub: string;
	}

	/** An RFC 9493 `opaque` identifier, carrying no meaning beyond identifying the subject. */
	export interface OpaqueSubject {
		format: "opaque";
		id: string;
	}

	/** Any other registered or profile-defined format, such as `phone_number` or `scim`. */
	export interface OtherSubject {
		format: string;
		[member: string]: unknown;
	}

	/** An RFC 9493 subject identifier, as `sub_id` carries it. */
	export type SubjectIdentifier = EmailSubject | IssuerSubject | OpaqueSubject | OtherSubject;

	/** What `SecurityEventToken.create` builds a token from. */
	export interface Input {
		issuer: string;
		audience: string | string[];
		/** One or more aspects of the same state change, each payload under its event URI. */
		events: Events;
		/** The token's `jti`, unique within the event feed; a fresh random one when omitted. */
		id?: string;
		/** @default new Date() */
		issuedAt?: Date;
		/** The `sub` claim, for a profile that defines what it holds. */
		subject?: string;
		subjectId?: SubjectIdentifier;
		/** The `txn` claim, shared by every token one transaction produces. */
		transaction?: string;
		/** The `toe` claim; omitted, the token shares no time of event. */
		timeOfEvent?: Date;
	}
}

/**
 * Holds a verified claim set to the parts of RFC 8417 a signature check cannot see.
 *
 * @param payload - The verified claims
 * @throws `JWTClaimValidationFailed` naming `exp` or `events`
 */
function assertSecurityEventClaims(payload: JWT.Payload): void {
	if (payload.exp !== undefined) {
		throw new jose.errors.JWTClaimValidationFailed(
			'a SET must not carry an "exp" claim',
			payload,
			"exp",
			"check_failed",
		);
	}

	let events = payload.events;
	let valid =
		isObject(events) &&
		Object.keys(events).length > 0 &&
		Object.values(events).every((event) => isObject(event));

	if (!valid) {
		throw new jose.errors.JWTClaimValidationFailed(
			'"events" claim must be an object of one or more event objects',
			payload,
			"events",
			"invalid",
		);
	}
}

/**
 * Whether a value is a JSON object, the shape RFC 8417 requires of `events` and each event.
 *
 * @param value - The claim value
 */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A `Date` as the whole seconds since the epoch a NumericDate claim holds.
 *
 * @param date - The instant
 */
function toEpochSeconds(date: Date): number {
	return Math.floor(date.getTime() / MS_PER_SECOND);
}
