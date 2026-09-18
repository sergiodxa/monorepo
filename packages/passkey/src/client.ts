/**
 * The browser half of a passkey: two calls that run a WebAuthn ceremony and
 * hand back JSON ready to post to the server.
 *
 * Everything the credentials API makes the caller do by hand — decoding the
 * options, encoding the response, keeping at most one ceremony open, telling a
 * dismissed prompt apart from a real failure — is done here instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import {
	toAuthenticationResponse,
	toCreationOptions,
	toRegistrationResponse,
	toRequestOptions,
} from "./client/json.js";
import {
	AlreadyRegisteredError,
	CancelledError,
	CeremonyError,
	InvalidOptionsError,
	PasskeyError,
	UnsupportedError,
} from "./errors.js";

export {
	AlreadyRegisteredError,
	CancelledError,
	CeremonyError,
	InvalidOptionsError,
	PasskeyError,
	UnsupportedError,
};

/**
 * Controller for the ceremony currently open, if any.
 *
 * A browser allows one outstanding request at a time, so starting a ceremony
 * while another is pending would reject the new one; this aborts the old one
 * instead, which is what makes an autofill prompt and a button coexist.
 */
let pending: AbortController | null = null;

/** Types for `Passkey`. */
export namespace Passkey {
	/** Per-call control over a ceremony. */
	export interface CeremonyOptions {
		/** Signal that cancels the ceremony alongside the package's own. */
		signal?: AbortSignal;
	}
}

/**
 * Translates a rejection from the credentials API into a typed failure.
 *
 * @param error Whatever the API rejected with.
 * @returns The matching package error.
 */
function toPasskeyError(error: unknown): PasskeyError {
	if (error instanceof RangeError) return new InvalidOptionsError();
	if (error instanceof DOMException) {
		if (error.name === "NotAllowedError" || error.name === "AbortError")
			return new CancelledError();
		if (error.name === "InvalidStateError") return new AlreadyRegisteredError();
	}
	return new CeremonyError(error);
}

/**
 * Opens a ceremony, cancelling whichever one was already open.
 *
 * @param signal Caller's own cancellation signal, when they passed one.
 * @returns The signal to hand to the credentials API.
 */
function open(signal: AbortSignal | undefined): AbortSignal {
	pending?.abort();
	pending = new AbortController();
	return signal ? AbortSignal.any([pending.signal, signal]) : pending.signal;
}

/**
 * Passkey ceremonies as the browser can run them.
 *
 * Every call reports its outcome as a `Result`, so a dismissed prompt is an
 * ordinary value to branch on rather than an exception to catch.
 *
 * @example
 * let result = await Passkey.register(await options.json());
 */
export class Passkey {
	/**
	 * Whether this page can run a passkey ceremony at all.
	 *
	 * False on an insecure origin as well as on a browser without WebAuthn, so
	 * it is also what tells a local http page why nothing happens.
	 *
	 * @returns Whether the credentials API is available here.
	 */
	static isSupported(): boolean {
		return (
			typeof globalThis.PublicKeyCredential === "function" &&
			typeof globalThis.navigator?.credentials?.create === "function"
		);
	}

	/**
	 * Whether the browser can offer passkeys inside an input's autofill menu.
	 *
	 * Check this before rendering a sign-in field with `autocomplete="webauthn"`,
	 * since a browser without it needs an explicit button instead.
	 *
	 * @returns Whether conditional mediation is available.
	 */
	static async isAutofillSupported(): Promise<boolean> {
		if (!Passkey.isSupported()) return false;
		if (typeof PublicKeyCredential.isConditionalMediationAvailable !== "function") return false;
		return await PublicKeyCredential.isConditionalMediationAvailable().catch(() => false);
	}

	/**
	 * Whether the device itself can hold a passkey behind a biometric or PIN.
	 *
	 * @returns Whether a user-verifying platform authenticator is present.
	 */
	static async isPlatformSupported(): Promise<boolean> {
		if (!Passkey.isSupported()) return false;
		if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
			return false;
		}
		return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(
			() => false,
		);
	}

	/**
	 * Creates a passkey from the options a relying party issued.
	 *
	 * @param options Registration options, exactly as the server sent them.
	 * @param ceremony Per-call cancellation.
	 * @returns The response to post back, or why the ceremony did not finish.
	 * @example
	 * let result = await Passkey.register(options);
	 */
	static async register(
		options: PublicKeyCredentialCreationOptionsJSON,
		ceremony: Passkey.CeremonyOptions = {},
	): Promise<Result<RegistrationResponseJSON, PasskeyError>> {
		if (!Passkey.isSupported()) return failure(new UnsupportedError());

		try {
			let credential = await navigator.credentials.create({
				publicKey: toCreationOptions(options),
				signal: open(ceremony.signal),
			});
			if (!credential) return failure(new CancelledError());
			return success(toRegistrationResponse(credential as PublicKeyCredential));
		} catch (error) {
			return failure(toPasskeyError(error));
		}
	}

	/**
	 * Signs in with a passkey, prompting for one immediately.
	 *
	 * @param options Authentication options, exactly as the server sent them.
	 * @param ceremony Per-call cancellation.
	 * @returns The response to post back, or why the ceremony did not finish.
	 * @example
	 * let result = await Passkey.authenticate(options);
	 */
	static authenticate(
		options: PublicKeyCredentialRequestOptionsJSON,
		ceremony: Passkey.CeremonyOptions = {},
	): Promise<Result<AuthenticationResponseJSON, PasskeyError>> {
		return get(options, "optional", ceremony);
	}

	/**
	 * Offers passkeys through the browser's autofill menu.
	 *
	 * The promise stays pending until somebody picks a credential, so call it
	 * once as the sign-in page loads and leave it running; a later `register`
	 * or `authenticate` cancels it on its own.
	 *
	 * @param options Authentication options issued with no `allow` list.
	 * @param ceremony Per-call cancellation.
	 * @returns The response to post back, or why the ceremony did not finish.
	 * @example
	 * let result = await Passkey.autofill(options);
	 */
	static autofill(
		options: PublicKeyCredentialRequestOptionsJSON,
		ceremony: Passkey.CeremonyOptions = {},
	): Promise<Result<AuthenticationResponseJSON, PasskeyError>> {
		return get(options, "conditional", ceremony);
	}

	/**
	 * Cancels the ceremony currently open, if there is one.
	 *
	 * Use it when the person navigates away from the sign-in step, so a pending
	 * autofill prompt stops holding the browser's single ceremony slot.
	 */
	static cancel(): void {
		pending?.abort();
		pending = null;
	}
}

/**
 * Runs an assertion ceremony under one mediation mode.
 *
 * @param options Authentication options as the server sent them.
 * @param mediation Whether the browser prompts outright or waits in autofill.
 * @param ceremony Per-call cancellation.
 * @returns The response to post back, or why the ceremony did not finish.
 */
async function get(
	options: PublicKeyCredentialRequestOptionsJSON,
	mediation: CredentialMediationRequirement,
	ceremony: Passkey.CeremonyOptions,
): Promise<Result<AuthenticationResponseJSON, PasskeyError>> {
	if (!Passkey.isSupported()) return failure(new UnsupportedError());

	try {
		let credential = await navigator.credentials.get({
			publicKey: toRequestOptions(options),
			mediation,
			signal: open(ceremony.signal),
		});
		if (!credential) return failure(new CancelledError());
		return success(toAuthenticationResponse(credential as PublicKeyCredential));
	} catch (error) {
		return failure(toPasskeyError(error));
	}
}
