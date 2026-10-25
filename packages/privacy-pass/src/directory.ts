/**
 * An issuer's key directory, RFC 9578 §4: fetched from its well-known URL through
 * `@sdxc/outbound`, imported once, and served from memory for as long as the issuer's
 * `Cache-Control` allows, so an origin verifies tokens without a request per redemption.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { Base64Url } from "@sdxc/crypto";
import { toMs } from "@sdxc/duration";
import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { IssuerKey } from "./blind-rsa.js";

import { importTokenKey } from "./blind-rsa.js";
import { PrivacyPassError } from "./errors.js";
import { BLIND_RSA_TOKEN_TYPE } from "./token.js";

/** The media type RFC 9578 §8.3.1 registers for the directory. */
const DIRECTORY_MEDIA_TYPE = "application/private-token-issuer-directory";

/** A directory lists a handful of keys; anything larger is not one. */
const MAX_DIRECTORY_BYTES = 64 * 1024;

/** The `max-age` directive of a `Cache-Control` value. */
const MAX_AGE = /(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/i;

/** The members of the directory this package reads; unknown members are ignored. */
const DIRECTORY_SCHEMA = s.object({
	"token-keys": s.array(
		s.object({
			"token-type": s.number(),
			"token-key": s.string(),
			"not-before": s.optional(s.number()),
		}),
	),
});

/** Where an origin's verifier reads issuer keys from. */
export interface IssuerKeySource {
	/**
	 * The issuer's current keys, most preferred first.
	 *
	 * @returns The keys, or `issuer-unavailable` when they cannot be obtained
	 */
	keys(): Promise<Result<readonly IssuerKey[], PrivacyPassError>>;
}

/**
 * The Blind RSA keys one issuer publishes. Keep one instance per issuer for the life of
 * the Worker: concurrent callers share one fetch, and later ones read the cached keys
 * until the directory's `max-age` runs out.
 *
 * @example let directory = new IssuerDirectory({ issuer: "demo-pat.issuer.cloudflare.com" });
 */
export class IssuerDirectory implements IssuerKeySource {
	/** The issuer's server name, as a challenge's `issuer_name` carries it. */
	readonly issuer: string;

	#timeout: DurationInput;
	#defaultMaxAge: number;
	#cached: { keys: readonly IssuerKey[]; expiresAt: number } | null = null;
	#pending: Promise<Result<readonly IssuerKey[], PrivacyPassError>> | null = null;

	/** @param options - The issuer and how long to wait for and keep its directory */
	constructor(options: IssuerDirectory.Options) {
		this.issuer = options.issuer;
		this.#timeout = options.timeout ?? "10 seconds";
		this.#defaultMaxAge = toMs(options.defaultMaxAge ?? "1 hour");
	}

	/** The directory's URL, `https://<issuer>/.well-known/private-token-issuer-directory`. */
	get url(): string {
		return `https://${this.issuer}/.well-known/private-token-issuer-directory`;
	}

	/**
	 * The issuer's Blind RSA keys in its order of preference, fetched when the cache is empty
	 * or expired. Entries of other token types, and keys this package cannot import, are
	 * skipped; a directory left with none fails.
	 *
	 * @returns The keys, or `issuer-unavailable` when the directory cannot be fetched or read
	 */
	async keys(): Promise<Result<readonly IssuerKey[], PrivacyPassError>> {
		if (this.#cached !== null && this.#cached.expiresAt > Date.now()) {
			return success(this.#cached.keys);
		}
		this.#pending ??= this.#fetch().finally(() => {
			this.#pending = null;
		});
		return this.#pending;
	}

	/** Drops the cached keys, so the next {@link IssuerDirectory.keys} call fetches again. */
	clear(): void {
		this.#cached = null;
	}

	/**
	 * Fetches, validates and imports the directory, caching the keys on success.
	 *
	 * @returns The imported keys, or why they could not be read
	 */
	async #fetch(): Promise<Result<readonly IssuerKey[], PrivacyPassError>> {
		let followed = await follow(this.url, {
			ports: "default",
			timeout: this.#timeout,
			headers: { accept: `${DIRECTORY_MEDIA_TYPE}, application/json;q=0.9` },
		});
		if (isFailure(followed)) return unavailable(followed.error.message, followed.error);

		let { response } = followed.data;
		if (response.status !== 200) {
			release(response.body);
			return unavailable(`The issuer directory answered HTTP ${response.status}`);
		}

		let body = await readText(response, { maxBytes: MAX_DIRECTORY_BYTES });
		if (isFailure(body)) return unavailable(body.error.message, body.error);

		let json = wrap(() => JSON.parse(body.data.text) as unknown);
		if (isFailure(json)) return unavailable("The issuer directory is not JSON", json.error);
		let directory = s.parseSafe(DIRECTORY_SCHEMA, json.data);
		if (!directory.success) return unavailable("The issuer directory lists no token keys");

		let keys: IssuerKey[] = [];
		for (let entry of directory.value["token-keys"]) {
			if (entry["token-type"] !== BLIND_RSA_TOKEN_TYPE) continue;
			let bytes = Base64Url.decode(entry["token-key"]);
			if (isFailure(bytes)) continue;
			let notBefore = entry["not-before"];
			let key = await importTokenKey(
				bytes.data,
				notBefore === undefined ? null : new Date(notBefore * 1000),
			);
			if (!isFailure(key)) keys.push(key.data);
		}
		if (keys.length === 0) return unavailable("The issuer directory has no usable Blind RSA key");

		this.#cached = { keys, expiresAt: Date.now() + this.#maxAge(response.headers) };
		return success(keys);
	}

	/**
	 * How long the response may be reused: its `max-age`, or the configured default when
	 * the issuer sent none.
	 *
	 * @param headers - The directory response's headers
	 * @returns Milliseconds
	 */
	#maxAge(headers: Headers): number {
		let match = MAX_AGE.exec(headers.get("cache-control") ?? "");
		return match === null ? this.#defaultMaxAge : Number(match[1]) * 1000;
	}
}

/** The options an {@link IssuerDirectory} is built with. */
export namespace IssuerDirectory {
	/** Configuration for one issuer's directory. */
	export interface Options {
		/** The issuer's server name, such as `demo-pat.issuer.cloudflare.com`. */
		issuer: string;
		/**
		 * How long one fetch may take.
		 *
		 * @default "10 seconds"
		 */
		timeout?: DurationInput;
		/**
		 * How long keys are kept when the directory response carries no `max-age`.
		 *
		 * @default "1 hour"
		 */
		defaultMaxAge?: DurationInput;
	}
}

/**
 * The failure for a directory that could not be fetched or read.
 *
 * @param message - What went wrong
 * @param cause - The underlying failure
 * @returns The failure
 */
function unavailable(message: string, cause?: Error): Result<never, PrivacyPassError> {
	return failure(
		new PrivacyPassError(
			"issuer-unavailable",
			message,
			cause === undefined ? undefined : { cause },
		),
	);
}
