/**
 * The site passkeys are registered to, and the only object a server needs.
 *
 * It holds the relying party identity and policy in one place so each ceremony
 * is two calls — one that issues options and a challenge, one that verifies
 * what came back — with no per-call repetition of ids, origins or algorithms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64Url, randomBytes } from "@sdxc/crypto";
import { failure, isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { PasskeyError } from "../errors.js";

import { MalformedResponseError } from "../errors.js";
import { DEFAULT_ALGORITHMS } from "../lib/cose.js";

import type { AuthenticatedPasskey, StoredPasskey } from "./authentication.js";
import type { RegisteredPasskey } from "./registration.js";
import type { Expectations } from "./verify.js";

import { verifyAuthentication } from "./authentication.js";
import { verifyRegistration } from "./registration.js";
import { AuthenticationResponse, RegistrationResponse } from "./schema.js";

/** Entropy behind a challenge, which the specification requires at least 16 bytes of. */
const CHALLENGE_BYTES = 32;

/** How long a browser keeps a prompt open before giving up, in milliseconds. */
const DEFAULT_TIMEOUT = 300_000;

/** Bytes a user handle may occupy, as the specification caps it. */
const MAX_USER_HANDLE_BYTES = 64;

/** Types for `RelyingParty`. */
export namespace RelyingParty {
	/** Identity and default policy of the site credentials are registered to. */
	export interface Options {
		/**
		 * Relying party id: the registrable domain credentials are bound to.
		 * Set it to the parent domain when one credential must cover subdomains.
		 * @example "example.com"
		 */
		id: string;
		/** Name shown in the passkey prompt. */
		name: string;
		/**
		 * Origins allowed to run ceremonies, including the scheme.
		 * @default the https origin of `id`
		 */
		origin?: string | string[];
		/**
		 * Whether the authenticator must verify the person, not just their presence.
		 * @default "preferred"
		 */
		userVerification?: UserVerificationRequirement;
		/**
		 * COSE algorithms offered to authenticators, in order of preference.
		 * @default ES256, RS256 and EdDSA
		 */
		algorithms?: number[];
		/**
		 * Milliseconds a browser keeps the prompt open.
		 * @default 300000
		 */
		timeout?: number;
		/**
		 * Whether a ceremony may run inside a cross-origin frame. Leaving it off
		 * means an embedded frame cannot register or spend a credential for this
		 * relying party, which is what a person seeing your domain expects.
		 * @default false
		 */
		allowFramed?: boolean;
	}

	/** A credential known to the account, in the form a ceremony names it. */
	export type Descriptor = string | { id: string; transports?: string[] };

	/** The account a new credential is being enrolled for. */
	export interface User {
		/**
		 * Stable account identifier the authenticator stores as the user handle.
		 * Use an opaque id rather than an email, since it is readable on the device.
		 */
		id: string;
		/** Identifier shown in the prompt and in the browser's credential list. */
		name: string;
		/**
		 * Friendlier label shown alongside `name`.
		 * @default the value of `name`
		 */
		displayName?: string;
	}

	/** What one registration ceremony asks the authenticator for. */
	export interface RegisterOptions {
		/** Account the credential will belong to. */
		user: User;
		/** Credentials the account already has, so the same device is not enrolled twice. */
		exclude?: Descriptor[];
		/**
		 * Whether the credential must be discoverable, which is what allows
		 * signing in with no identifier typed.
		 * @default "preferred"
		 */
		residentKey?: ResidentKeyRequirement;
		/** Restricts enrollment to a built-in authenticator or to a security key. */
		attachment?: AuthenticatorAttachment;
		/** Overrides the relying party's user verification policy for this ceremony. */
		userVerification?: UserVerificationRequirement;
	}

	/** What one authentication ceremony asks the authenticator for. */
	export interface AuthenticateOptions {
		/**
		 * Credentials the assertion may come from. Leaving it out starts a
		 * usernameless ceremony, where the browser offers every discoverable
		 * credential it holds for this relying party.
		 */
		allow?: Descriptor[];
		/** Overrides the relying party's user verification policy for this ceremony. */
		userVerification?: UserVerificationRequirement;
	}

	/** Options to send to the browser, and the challenge to keep until it answers. */
	export interface Ceremony<T> {
		/** Challenge to persist against the pending ceremony and pass back to verification. */
		challenge: string;
		/** Options to hand straight to the matching `@sdxc/passkey/client` call. */
		options: T;
	}

	/** What a registration response is verified against. */
	export interface VerifyRegistrationOptions {
		/** Challenge issued for this ceremony. */
		challenge: string;
		/** Overrides the relying party's user verification policy for this ceremony. */
		userVerification?: UserVerificationRequirement;
	}

	/** What an authentication response is verified against. */
	export interface VerifyAuthenticationOptions {
		/** Challenge issued for this ceremony. */
		challenge: string;
		/** Stored credential the assertion claims to come from. */
		passkey: StoredPasskey;
		/** Overrides the relying party's user verification policy for this ceremony. */
		userVerification?: UserVerificationRequirement;
	}
}

/**
 * Expands the shorthand a caller may use for a known credential.
 *
 * @param descriptors Credential ids, or ids with the transports recorded for them.
 * @returns Descriptors in the shape the browser takes.
 */
function toDescriptors(
	descriptors: RelyingParty.Descriptor[] | undefined,
): PublicKeyCredentialDescriptorJSON[] | undefined {
	return descriptors?.map((descriptor) =>
		typeof descriptor === "string"
			? { id: descriptor, type: "public-key" }
			: { id: descriptor.id, type: "public-key", transports: descriptor.transports },
	);
}

/**
 * A site that registers and accepts passkeys.
 *
 * One instance is enough for a whole application: it is stateless, so it can
 * live at module scope and be shared across requests.
 *
 * @example
 * let rp = new RelyingParty({ id: "example.com", name: "Example" });
 */
export class RelyingParty {
	/** Origins whose pages may run a ceremony, resolved from the options. */
	private origins: string[];

	/** Fallback user verification policy, applied when a ceremony states none. */
	private userVerification: UserVerificationRequirement;

	/** Credential parameters offered to authenticators, in preference order. */
	private parameters: PublicKeyCredentialParameters[];

	/** Milliseconds a browser keeps a prompt open. */
	private timeout: number;

	/** COSE algorithms offered, which a registered credential must use one of. */
	private algorithms: number[];

	/**
	 * @param options Identity and default policy of the relying party.
	 */
	constructor(private options: RelyingParty.Options) {
		let origin = options.origin ?? `https://${options.id}`;
		this.origins = Array.isArray(origin) ? origin : [origin];
		this.userVerification = options.userVerification ?? "preferred";
		this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
		this.algorithms = options.algorithms ?? DEFAULT_ALGORITHMS;
		this.parameters = this.algorithms.map((alg) => ({ alg, type: "public-key" }));
	}

	/**
	 * Starts a registration ceremony.
	 *
	 * @param options Account to enroll and the policy for this ceremony.
	 * @returns The challenge to persist and the options to send to the browser.
	 * @throws {RangeError} If the user id does not fit in a 64-byte user handle.
	 * @example
	 * let { challenge, options } = rp.register({ user: { id: user.id, name: user.email } });
	 */
	register(
		options: RelyingParty.RegisterOptions,
	): RelyingParty.Ceremony<PublicKeyCredentialCreationOptionsJSON> {
		let handle = new TextEncoder().encode(options.user.id);
		if (handle.length > MAX_USER_HANDLE_BYTES) {
			throw new RangeError(`A user id must encode to at most ${MAX_USER_HANDLE_BYTES} bytes`);
		}

		let challenge = Base64Url.encode(randomBytes(CHALLENGE_BYTES));

		return {
			challenge,
			options: {
				challenge,
				rp: { id: this.options.id, name: this.options.name },
				user: {
					id: Base64Url.encode(handle),
					name: options.user.name,
					displayName: options.user.displayName ?? options.user.name,
				},
				pubKeyCredParams: this.parameters,
				excludeCredentials: toDescriptors(options.exclude),
				authenticatorSelection: {
					residentKey: options.residentKey ?? "preferred",
					authenticatorAttachment: options.attachment,
					userVerification: options.userVerification ?? this.userVerification,
				},
				attestation: "none",
				timeout: this.timeout,
			},
		};
	}

	/**
	 * Verifies what the browser posted back from a registration ceremony.
	 *
	 * @param response The response, or the `Request` carrying it as JSON.
	 * @param options Challenge issued for the ceremony, and any policy override.
	 * @returns The credential to store, or the first check that failed.
	 * @example
	 * let result = await rp.verifyRegistration(request, { challenge });
	 */
	async verifyRegistration(
		response: Request | RegistrationResponseJSON,
		options: RelyingParty.VerifyRegistrationOptions,
	): Promise<Result<RegisteredPasskey, PasskeyError>> {
		let parsed = await validate(response as Request, RegistrationResponse);
		if (isFailure(parsed)) {
			return failure(new MalformedResponseError("not a registration response"));
		}

		return verifyRegistration(
			parsed.data,
			this.expectations("webauthn.create", options.challenge, options.userVerification),
		);
	}

	/**
	 * Starts an authentication ceremony.
	 *
	 * @param options Credentials to allow and the policy for this ceremony.
	 * @returns The challenge to persist and the options to send to the browser.
	 * @example
	 * let { challenge, options } = rp.authenticate();
	 */
	authenticate(
		options: RelyingParty.AuthenticateOptions = {},
	): RelyingParty.Ceremony<PublicKeyCredentialRequestOptionsJSON> {
		let challenge = Base64Url.encode(randomBytes(CHALLENGE_BYTES));

		return {
			challenge,
			options: {
				challenge,
				rpId: this.options.id,
				allowCredentials: toDescriptors(options.allow),
				userVerification: options.userVerification ?? this.userVerification,
				timeout: this.timeout,
			},
		};
	}

	/**
	 * Verifies what the browser posted back from an authentication ceremony.
	 *
	 * @param response The response, or the `Request` carrying it as JSON.
	 * @param options Challenge issued for the ceremony and the stored credential.
	 * @returns What to record about the assertion, or the first check that failed.
	 * @example
	 * let result = await rp.verifyAuthentication(request, { challenge, passkey });
	 */
	async verifyAuthentication(
		response: Request | AuthenticationResponseJSON,
		options: RelyingParty.VerifyAuthenticationOptions,
	): Promise<Result<AuthenticatedPasskey, PasskeyError>> {
		let parsed = await validate(response as Request, AuthenticationResponse);
		if (isFailure(parsed)) {
			return failure(new MalformedResponseError("not an authentication response"));
		}

		return verifyAuthentication(
			parsed.data,
			options.passkey,
			this.expectations("webauthn.get", options.challenge, options.userVerification),
		);
	}

	/**
	 * Resolves the relying party's policy into what one ceremony is checked against.
	 *
	 * @param type Client data type for the ceremony.
	 * @param challenge Challenge issued for it.
	 * @param userVerification Override for this ceremony, when the caller passed one.
	 * @returns The expectations the response has to meet.
	 */
	private expectations(
		type: string,
		challenge: string,
		userVerification: UserVerificationRequirement | undefined,
	): Expectations {
		return {
			type,
			challenge,
			origins: this.origins,
			rpId: this.options.id,
			requireUserVerification: (userVerification ?? this.userVerification) === "required",
			allowCrossOrigin: this.options.allowFramed ?? false,
			algorithms: this.algorithms,
		};
	}
}
