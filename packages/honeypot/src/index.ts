/**
 * Honeypot fields for HTML forms: a trap field people never see and a signed token recording when
 * the form was rendered and which field is the trap. Verifying them refuses a filled trap or a
 * forged token outright and reports a render time no visitor can alter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { Base64Url, hmac } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

/** The token payload's current version; any other value is refused. */
const TOKEN_VERSION = 1;

/** What the token signs: its version, the issue time in milliseconds and the trap's name. */
const PAYLOAD_SCHEMA = s.object({ v: s.number(), iat: s.number(), trap: s.string() });

/** Letters a trap name is drawn from, which no browser autofill vocabulary matches as a whole. */
const TRAP_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** Letters after the prefix in a trap name. */
const TRAP_LENGTH = 8;

/** Milliseconds a token may appear issued in the future, absorbing clock differences. */
const CLOCK_SKEW_MS = 60_000;

/**
 * Issues and verifies honeypot fields with one secret, or several during a rotation.
 *
 * @example let honeypot = new Honeypot({ secret: env.HONEYPOT_SECRET });
 */
export class Honeypot {
	/** The form field the token travels in. */
	readonly tokenField: string;

	#secrets: readonly string[];
	#trapPrefix: string;
	#minMs: number;
	#maxAgeMs: number | undefined;

	/** @param options - The secret, the field names and the timing limits */
	constructor(options: Honeypot.Options) {
		this.#secrets = typeof options.secret === "string" ? [options.secret] : options.secret;
		this.tokenField = options.tokenField ?? "hp-token";
		this.#trapPrefix = options.trapPrefix ?? "hp_";
		this.#minMs = (options.minSeconds ?? 0) * 1000;
		this.#maxAgeMs = options.maxAge === undefined ? undefined : options.maxAge * 1000;
	}

	/**
	 * Mints the fields for one rendered form: a fresh trap name and a token signed with the first
	 * secret. Issue once per form, so two forms on a page carry different traps.
	 *
	 * @param options - The issue time, for tests
	 * @returns The field names and token value, or `misconfigured` when no secret can sign
	 */
	async issue(
		options: Honeypot.IssueOptions = {},
	): Promise<Result<Honeypot.Fields, HoneypotError>> {
		let secret = this.#secrets[0];
		if (secret === undefined || secret === "") return failure(new HoneypotError("misconfigured"));

		let trapField = this.#trapPrefix + randomLetters(TRAP_LENGTH);
		let payload = JSON.stringify({
			v: TOKEN_VERSION,
			iat: (options.now ?? new Date()).getTime(),
			trap: trapField,
		});
		let encoded = Base64Url.encode(payload);
		let mac = await hmac.sign(secret, encoded);
		if (isFailure(mac)) return failure(new HoneypotError("misconfigured"));

		return success({
			tokenField: this.tokenField,
			token: `${encoded}.${Base64Url.encode(mac.data)}`,
			trapField,
		});
	}

	/**
	 * Checks a submitted form. The token must verify under one of the secrets, the trap it names
	 * must be absent or empty, and the issue time must fall within the timing limits.
	 *
	 * @param form - The submitted body, parsed
	 * @param options - The verification time, for tests
	 * @returns When the form was rendered, or the reason the submission is refused
	 */
	async verify(
		form: FormData | URLSearchParams,
		options: Honeypot.VerifyOptions = {},
	): Promise<Result<Honeypot.Verification, HoneypotError>> {
		let token = form.get(this.tokenField);
		if (typeof token !== "string" || token === "") {
			return failure(new HoneypotError("missing-token"));
		}

		let payload = await this.#readToken(token);
		if (isFailure(payload)) return payload;

		let trap = form.get(payload.data.trap);
		if (trap !== null && (typeof trap !== "string" || trap !== "")) {
			return failure(new HoneypotError("trap-filled"));
		}

		let elapsedMs = (options.now ?? new Date()).getTime() - payload.data.iat;
		if (elapsedMs < -CLOCK_SKEW_MS || Math.max(elapsedMs, 0) < this.#minMs) {
			return failure(new HoneypotError("too-fast"));
		}
		if (this.#maxAgeMs !== undefined && elapsedMs > this.#maxAgeMs) {
			return failure(new HoneypotError("expired"));
		}

		return success({ renderedAt: new Date(payload.data.iat), elapsedMs });
	}

	/**
	 * Splits, authenticates and parses a token. The signature is checked before the payload is
	 * parsed, so only a payload this app signed reaches the JSON parser.
	 */
	async #readToken(
		token: string,
	): Promise<Result<s.InferOutput<typeof PAYLOAD_SCHEMA>, HoneypotError>> {
		if (this.#secrets.length === 0) return failure(new HoneypotError("misconfigured"));

		let parts = token.split(".");
		if (parts.length !== 2) return failure(new HoneypotError("invalid-token"));
		let [encoded = "", signature = ""] = parts;

		let mac = Base64Url.decode(signature);
		let body = Base64Url.decode(encoded);
		if (isFailure(mac) || isFailure(body)) return failure(new HoneypotError("invalid-token"));

		let authentic = false;
		for (let secret of this.#secrets) {
			let verified = await hmac.verify(secret, encoded, mac.data);
			if (!isFailure(verified) && verified.data) authentic = true;
		}
		if (!authentic) return failure(new HoneypotError("invalid-token"));

		let json: unknown;
		try {
			json = JSON.parse(new TextDecoder().decode(body.data));
		} catch {
			return failure(new HoneypotError("invalid-token"));
		}
		let parsed = s.parseSafe(PAYLOAD_SCHEMA, json);
		if (!parsed.success || parsed.value.v !== TOKEN_VERSION) {
			return failure(new HoneypotError("invalid-token"));
		}
		return success(parsed.value);
	}
}

/** The types a {@link Honeypot} takes and returns. */
export namespace Honeypot {
	/** How a honeypot is configured. */
	export interface Options {
		/**
		 * The signing secret. A list signs with its first entry and verifies with every entry, so a
		 * rotation keeps forms already open in a browser valid.
		 */
		secret: string | readonly string[];
		/** @default "hp-token" */
		tokenField?: string;
		/** The start of every trap name; the rest is random letters. @default "hp_" */
		trapPrefix?: string;
		/**
		 * Seconds a submission must take after render. A fast person is still a person, so the
		 * default refuses no speed; score speed with a spam filter instead.
		 *
		 * @default 0
		 */
		minSeconds?: number;
		/** Seconds after render a token expires. Unset keeps a form open overnight valid. */
		maxAge?: number;
	}

	/** Options for {@link Honeypot.issue}. */
	export interface IssueOptions {
		/** @default the current time */
		now?: Date;
	}

	/** Options for {@link Honeypot.verify}. */
	export interface VerifyOptions {
		/** @default the current time */
		now?: Date;
	}

	/** The fields one form renders. */
	export interface Fields {
		tokenField: string;
		token: string;
		/** The trap's name, random per issue so autofill never matches it. */
		trapField: string;
	}

	/** What a verified token proves. */
	export interface Verification {
		/** When the form was issued, as signed by this app. */
		renderedAt: Date;
		/** Milliseconds between render and verification. */
		elapsedMs: number;
	}

	/**
	 * Why a submission was refused. `trap-filled`, `missing-token` and `invalid-token` mark a bot;
	 * `too-fast` and `expired` come from the timing limits; `misconfigured` is a missing secret.
	 */
	export type ErrorCode =
		| "missing-token"
		| "invalid-token"
		| "trap-filled"
		| "too-fast"
		| "expired"
		| "misconfigured";
}

/**
 * A refused submission or an unusable configuration; `code` is what to branch on.
 *
 * @example if (error.code === "trap-filled") log.info("honeypot.trap", {});
 */
export class HoneypotError extends Error {
	override name = "HoneypotError";

	readonly code: Honeypot.ErrorCode;

	/** @param code - The reason */
	constructor(code: Honeypot.ErrorCode) {
		super(`Honeypot check failed: ${code}`);
		this.code = code;
	}
}

/** `length` random lowercase letters. The slight modulo bias leaves names unguessable enough. */
function randomLetters(length: number): string {
	let bytes = crypto.getRandomValues(new Uint8Array(length));
	return [...bytes].map((byte) => TRAP_ALPHABET[byte % TRAP_ALPHABET.length]).join("");
}
