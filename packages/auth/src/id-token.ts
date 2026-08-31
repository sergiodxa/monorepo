/**
 * The ID token a login produces, with the OpenID Connect claims as accessors that
 * name each one and pin how it may be absent. It is the identity anchor apps key a
 * person on, and the token every step-up check is answered in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@pkg/jwt";

/** Milliseconds in a second, the factor between an `auth_time` claim and a `Date`. */
const MS_PER_SECOND = 1000;

/**
 * The twenty authentication method references RFC 8176 §2 registers, keyed by name
 * so autocomplete spells out what the wire abbreviates.
 */
export const AUTHENTICATION_METHODS = {
	Face: "face",
	Fpt: "fpt",
	Geo: "geo",
	Hwk: "hwk",
	Iris: "iris",
	Kba: "kba",
	Mca: "mca",
	Mfa: "mfa",
	Otp: "otp",
	Pin: "pin",
	Pwd: "pwd",
	Rba: "rba",
	Retina: "retina",
	Sc: "sc",
	Sms: "sms",
	Swk: "swk",
	Tel: "tel",
	User: "user",
	Vbm: "vbm",
	Wia: "wia",
} as const;

/**
 * A verified OpenID Connect ID token.
 *
 * The claims a login turns on — identity, step-up, and profile — arrive as named
 * accessors with their nullability stated, and any claim with no accessor reads
 * through by name, so a provider-specific claim is available as it was sent.
 *
 * @example
 * let idToken = await IdToken.verify(raw, await issuer.keys(), { issuer, audience });
 * idToken.subject; // the identity anchor, never null
 */
export class IdToken extends JWT {
	/**
	 * The identity anchor apps key their own records on.
	 *
	 * Always present: OpenID Connect requires `sub` in an ID token, and the value is
	 * immutable at the provider, which is what makes it safe as a record key.
	 *
	 * @throws When the claim is absent, since such a token is malformed.
	 */
	override get subject(): string {
		return this.parser.string("sub");
	}

	/**
	 * The `nonce` the authorization request carried. Matching it against the
	 * transaction on callback binds this token to the login that asked for it.
	 */
	get nonce(): string | null {
		if (this.parser.has("nonce")) return this.parser.string("nonce");
		return null;
	}

	/**
	 * When the person actually authenticated, from the seconds `auth_time` stores.
	 *
	 * It survives every token refresh, so it is what decides whether to re-prompt
	 * before a sensitive action, and the provider sends it whenever `max_age` was
	 * requested.
	 */
	get authTime(): Date | null {
		if (this.parser.has("auth_time")) {
			return new Date(this.parser.number("auth_time") * MS_PER_SECOND);
		}
		return null;
	}

	/** The `sid` claim: the join key between a login and the logout token that ends it. */
	get sessionId(): string | null {
		if (this.parser.has("sid")) return this.parser.string("sid");
		return null;
	}

	/**
	 * The `at_hash` claim, binding this token to the access token issued beside it,
	 * and verified whenever a provider sends one.
	 */
	get atHash(): string | null {
		if (this.parser.has("at_hash")) return this.parser.string("at_hash");
		return null;
	}

	/**
	 * The authentication methods that took part, from `amr`. This claim is how an
	 * identity provider reports that MFA actually happened, and an empty list is the
	 * honest answer for a provider that reports nothing.
	 */
	get amr(): IdToken.AuthenticationMethod[] {
		if (!this.parser.has("amr")) return [];
		let value = this.parser.get("amr");
		if (!Array.isArray(value)) return [];
		return value.filter((entry): entry is string => typeof entry === "string");
	}

	/**
	 * The authentication context class the provider says it met, and the claim an
	 * `acr_values` request is answered in. Read alongside `amr` because providers
	 * disagree about which of the two they populate.
	 */
	get acr(): string | null {
		if (this.parser.has("acr")) return this.parser.string("acr");
		return null;
	}

	/** The display name apps write to their own records, sent with the `profile` scope. */
	get name(): string | null {
		if (this.parser.has("name")) return this.parser.string("name");
		return null;
	}

	/**
	 * The address the provider holds, sent under the `email` scope. It is mutable
	 * there, so it serves as contact and display data while `subject` keys records.
	 */
	get email(): string | null {
		if (this.parser.has("email")) return this.parser.string("email");
		return null;
	}

	/**
	 * Whether the provider vouches for the email address.
	 *
	 * `false` for an absent claim, so an authorization decision reads a plain
	 * boolean, and a provider that serializes the claim as the string `"true"`
	 * normalizes here.
	 */
	get emailVerified(): boolean {
		if (!this.parser.has("email_verified")) return false;
		let value = this.parser.get("email_verified");
		if (typeof value === "boolean") return value;
		return value === "true";
	}

	/**
	 * The `preferred_username` claim, display-only and mutable, named for the role it
	 * plays so one claim goes by one name throughout.
	 */
	get username(): string | null {
		if (this.parser.has("preferred_username")) return this.parser.string("preferred_username");
		return null;
	}

	/**
	 * The avatar the provider publishes, as the string it sent. A caller that wants a
	 * `URL` parses it where it can handle a provider-controlled value.
	 */
	get picture(): string | null {
		if (this.parser.has("picture")) return this.parser.string("picture");
		return null;
	}
}

export namespace IdToken {
	/**
	 * One authentication method reference, as `amr` carries it.
	 *
	 * The twenty registered values give autocomplete, and any other string is
	 * accepted too: RFC 8176 §3 keeps the registry open under Expert Review, and
	 * providers use that room to send values of their own.
	 */
	export type AuthenticationMethod =
		| (typeof AUTHENTICATION_METHODS)[keyof typeof AUTHENTICATION_METHODS]
		| (string & {});
}
