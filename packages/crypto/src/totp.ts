/**
 * Time-based one-time passwords, RFC 6238 over the package's HMAC primitive.
 *
 * Second-factor enrollment and verification need three things that are easy to
 * get subtly wrong: a base32 shared secret, the dynamic truncation of a MAC over
 * the current time step, and a drift window that still compares in constant time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Bytes } from "./lib/bytes.js";

import { CryptoError } from "./errors.js";
import { hmac } from "./hmac.js";
import { decode as decodeBase32, encode as encodeBase32 } from "./lib/base32.js";
import { randomBytes } from "./random.js";
import { timingSafeEqual } from "./timing-safe-equal.js";

/** Hash functions RFC 6238 allows for TOTP. */
const SUPPORTED_ALGORITHMS = ["SHA-1", "SHA-256", "SHA-512"] as const;

/** Default time step in seconds, as authenticator apps assume. */
const DEFAULT_STEP_SECONDS = 30;

/** Default number of digits in a generated code. */
const DEFAULT_DIGITS = 6;

/** Default hash, kept at SHA-1 because that is what enrollment apps support. */
const DEFAULT_ALGORITHM = "SHA-1";

/** Default number of steps accepted on either side of the current one. */
const DEFAULT_WINDOW = 1;

/** Default shared secret size in bytes, the 160 bits RFC 4226 recommends. */
const DEFAULT_SECRET_BYTES = 20;

/** Dynamic truncation keeps 31 bits, so ten digits is the most it can express. */
const MAX_DIGITS = 10;

/** Width of the big-endian counter the MAC is computed over. */
const COUNTER_BYTES = 8;

/** Milliseconds per second, for turning a timestamp into a step counter. */
const MS_PER_SECOND = 1000;

/** A submitted code must be digits only, so a formatted string never matches. */
const DIGITS_PATTERN = /^\d+$/;

/**
 * Types for the `totp` operations.
 */
export namespace totp {
	/** Hash function inside the HMAC a code is derived from. */
	export type Algorithm = (typeof SUPPORTED_ALGORITHMS)[number];

	/** Shared secret size. */
	export interface SecretOptions {
		/**
		 * Secret size in bytes.
		 * @default 20
		 */
		bytes?: number;
	}

	/** Parameters that must agree between the generator and the verifier. */
	export interface CodeOptions {
		/**
		 * Point in time to generate for, as a `Date` or epoch milliseconds.
		 * @default Date.now()
		 */
		at?: Date | number;
		/**
		 * Time step in seconds.
		 * @default 30
		 */
		step?: number;
		/**
		 * Digits in the code.
		 * @default 6
		 */
		digits?: number;
		/**
		 * Hash function to key.
		 * @default "SHA-1"
		 */
		algorithm?: Algorithm;
	}

	/** Verification parameters, including how much clock drift to accept. */
	export interface VerifyOptions extends CodeOptions {
		/**
		 * Steps accepted on either side of the current one.
		 * @default 1
		 */
		window?: number;
	}

	/** Enrollment URI fields shown by an authenticator app. */
	export interface UriOptions {
		/** Service name shown as the account issuer. */
		issuer: string;
		/** Account identifier, usually an email address or username. */
		account: string;
		/**
		 * Digits in the code.
		 * @default 6
		 */
		digits?: number;
		/**
		 * Time step in seconds.
		 * @default 30
		 */
		step?: number;
		/**
		 * Hash function to key.
		 * @default "SHA-1"
		 */
		algorithm?: Algorithm;
	}
}

/** Validated parameters shared by generation and verification. */
interface Parameters {
	/** Digits in the code. */
	digits: number;
	/** Time step in seconds. */
	step: number;
	/** Hash function inside the HMAC. */
	algorithm: totp.Algorithm;
}

/**
 * Applies defaults and rejects parameters that cannot produce a valid code.
 *
 * Bad parameters are a caller mistake, so resolution surfaces a `Failure`
 * naming the problem for the caller to fix.
 *
 * @param options Caller-supplied parameters.
 * @returns Resolved parameters, or the reason they are unusable.
 */
function resolve(options: totp.CodeOptions): Result<Parameters, CryptoError> {
	let digits = options.digits ?? DEFAULT_DIGITS;
	if (!Number.isInteger(digits) || digits < 1 || digits > MAX_DIGITS) {
		return failure(new CryptoError(`TOTP digits must be an integer between 1 and ${MAX_DIGITS}`));
	}

	let step = options.step ?? DEFAULT_STEP_SECONDS;
	if (!Number.isInteger(step) || step < 1) {
		return failure(new CryptoError("TOTP step must be a positive whole number of seconds"));
	}

	let algorithm = options.algorithm ?? DEFAULT_ALGORITHM;
	if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
		return failure(new CryptoError("TOTP algorithm must be SHA-1, SHA-256, or SHA-512"));
	}

	return success({ digits, step, algorithm });
}

/**
 * Converts a moment in time into the RFC 6238 step counter.
 *
 * @param at `Date`, epoch milliseconds, or nothing for the current time.
 * @param step Time step in seconds.
 * @returns Number of whole steps elapsed since the Unix epoch.
 */
function counterFor(at: totp.CodeOptions["at"], step: number): number {
	let milliseconds = at instanceof Date ? at.getTime() : (at ?? Date.now());
	return Math.floor(milliseconds / MS_PER_SECOND / step);
}

/**
 * Encodes a step counter as the 8-byte big-endian block the MAC covers.
 *
 * @param counter Step counter, which must not be negative.
 * @returns Eight bytes in network order.
 */
function counterBlock(counter: number): Bytes {
	let block = new Uint8Array(COUNTER_BYTES);
	new DataView(block.buffer).setBigUint64(0, BigInt(counter));
	return block;
}

/**
 * Derives the code for one specific step counter, applying RFC 4226 dynamic
 * truncation: the top bit of the selected MAC window is cleared so the
 * value stays positive before reducing modulo `10 ** digits`.
 *
 * @param key Decoded shared secret.
 * @param counter Step counter to derive for.
 * @param parameters Resolved digits and hash function.
 * @returns The code as a zero-padded string, or why it could not be derived.
 */
async function codeFor(
	key: Bytes,
	counter: number,
	parameters: Parameters,
): Promise<Result<string, CryptoError>> {
	let mac = await hmac.sign(key, counterBlock(counter), { hash: parameters.algorithm });
	if (isFailure(mac)) return mac;

	let bytes = mac.data;
	let offset = (bytes[bytes.length - 1] ?? 0) & 0x0f;
	let value =
		(((bytes[offset] ?? 0) & 0x7f) << 24) |
		((bytes[offset + 1] ?? 0) << 16) |
		((bytes[offset + 2] ?? 0) << 8) |
		(bytes[offset + 3] ?? 0);

	return success(String(value % 10 ** parameters.digits).padStart(parameters.digits, "0"));
}

/**
 * Generates a random base32 shared secret ready for enrollment.
 *
 * The result is unpadded uppercase base32 because that is the only encoding
 * authenticator apps accept in a QR code or a typed setup key.
 *
 * @param options Secret size.
 * @returns Base32 secret to store for the account and show once during enrollment.
 * @throws {RangeError} If `options.bytes` is not an integer the runtime can fill.
 * @example
 * let secret = totp.generateSecret(); // "JBSWY3DPEHPK3PXP..."
 */
function generateSecret(options: totp.SecretOptions = {}): string {
	return encodeBase32(randomBytes(options.bytes ?? DEFAULT_SECRET_BYTES));
}

/**
 * Generates the code for a secret at a point in time.
 *
 * @param secret Base32 shared secret.
 * @param options Time, step, digits, and hash function.
 * @returns The current code, or why it could not be derived.
 * @example
 * let code = await totp.code(secret, { at: new Date("2026-01-01T00:00:00Z") });
 */
async function generateCode(
	secret: string,
	options: totp.CodeOptions = {},
): Promise<Result<string, CryptoError>> {
	let parameters = resolve(options);
	if (isFailure(parameters)) return parameters;

	let key = decodeBase32(secret);
	if (isFailure(key)) return key;

	return codeFor(key.data, counterFor(options.at, parameters.data.step), parameters.data);
}

/**
 * Checks a submitted code against the current step and the drift window.
 *
 * Every step in the window is compared in constant time even after a match,
 * so timing never reveals which step matched.
 *
 * @param secret Base32 shared secret.
 * @param code Code submitted by the user.
 * @param options Time, step, digits, hash function, and drift window.
 * @returns Whether the code is valid, or why it could not be checked.
 * @example
 * let ok = await totp.verify(secret, form.code, { window: 1 });
 */
async function verifyCode(
	secret: string,
	code: string,
	options: totp.VerifyOptions = {},
): Promise<Result<boolean, CryptoError>> {
	let parameters = resolve(options);
	if (isFailure(parameters)) return parameters;

	let window = options.window ?? DEFAULT_WINDOW;
	if (!Number.isInteger(window) || window < 0) {
		return failure(new CryptoError("TOTP window must be a non-negative whole number of steps"));
	}

	let key = decodeBase32(secret);
	if (isFailure(key)) return key;

	if (!DIGITS_PATTERN.test(code) || code.length !== parameters.data.digits) return success(false);

	let counter = counterFor(options.at, parameters.data.step);
	let matched = false;

	for (let offset = -window; offset <= window; offset++) {
		if (counter + offset < 0) continue;
		let expected = await codeFor(key.data, counter + offset, parameters.data);
		if (isFailure(expected)) return expected;
		if (timingSafeEqual(expected.data, code)) matched = true;
	}

	return success(matched);
}

/**
 * Builds the `otpauth://` URI an authenticator app scans during enrollment.
 *
 * The issuer appears both in the label and as a query parameter, which is what
 * apps need to group and name the entry consistently.
 *
 * @param secret Base32 shared secret.
 * @param options Issuer, account, and the parameters the app must mirror.
 * @returns URI to render as a QR code or offer as a manual setup link.
 * @example
 * totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });
 */
function buildUri(secret: string, options: totp.UriOptions): string {
	let label = `${encodeURIComponent(options.issuer)}:${encodeURIComponent(options.account)}`;
	let query = new URLSearchParams({
		secret,
		issuer: options.issuer,
		algorithm: (options.algorithm ?? DEFAULT_ALGORITHM).replace("-", ""),
		digits: String(options.digits ?? DEFAULT_DIGITS),
		period: String(options.step ?? DEFAULT_STEP_SECONDS),
	});

	return `otpauth://totp/${label}?${query.toString().replaceAll("+", "%20")}`;
}

/**
 * RFC 6238 one-time passwords: secrets, codes, verification, and enrollment URIs.
 *
 * @example
 * let secret = totp.generateSecret();
 * let uri = totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });
 * let ok = await totp.verify(secret, submittedCode, { window: 1 });
 */
export const totp = {
	generateSecret,
	code: generateCode,
	verify: verifyCode,
	uri: buildUri,
};
