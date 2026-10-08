/**
 * Reads an IANA RDAP bootstrap registry (RFC 9224) into a table of base URLs, kept in
 * memory and in a shared cache. A copy past its TTL is refreshed, and is still served
 * when the refresh fails, so an IANA outage never stops a lookup that worked yesterday.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { RequestOptions } from "./request.js";

import { RDAPError } from "./error.js";
import { suffixKey } from "./name.js";
import { requestJSON } from "./request.js";

/** The members of a bootstrap file this reader uses; `description` and extensions pass unread. */
const BOOTSTRAP_SCHEMA = s.object({
	version: s.string(),
	publication: s.string(),
	services: s.array(s.tuple([s.array(s.string()), s.array(s.string())])),
});

/** What the cache holds: the base URLs by label sequence and when they were fetched. */
const STORED_SCHEMA = s.object({
	fetchedAt: s.number(),
	services: s.record(s.string(), s.array(s.string())),
});

/** A bootstrap copy as the cache stores it. */
type Stored = s.InferOutput<typeof STORED_SCHEMA>;

/** A bootstrap copy ready for matching. */
export interface BootstrapTable {
	fetchedAt: number;
	/** Base URLs by lowercased label sequence, as the registry listed them. */
	services: Map<string, string[]>;
}

/** Where a registry is read from and how long a copy is trusted. */
export interface BootstrapOptions {
	/** The IANA registry's name (`dns`, later `ipv4`, `ipv6`, `asn`), which names its cache entry. */
	registry: string;
	url: string;
	cache: Cache;
	ttlMs: number;
	request: Omit<RequestOptions, "accept">;
}

/**
 * One bootstrap registry for the life of an `RDAP` instance. Concurrent lookups share
 * one in-flight load, so a batch of a thousand reads the cache once.
 */
export class Bootstrap {
	readonly #options: BootstrapOptions;
	#table: BootstrapTable | undefined;
	#loading: Promise<Result<BootstrapTable, RDAPError>> | undefined;

	/** @param options - The registry, its URL, the cache and the request bounds. */
	constructor(options: BootstrapOptions) {
		this.#options = options;
	}

	/**
	 * Answers the freshest table available: the in-memory copy while it is within its
	 * TTL, then the cache's, then IANA's. A failed fetch falls back to any copy at all,
	 * and fails `bootstrap-unavailable` only when there has never been one.
	 */
	async table(): Promise<Result<BootstrapTable, RDAPError>> {
		if (this.#table && this.#fresh(this.#table)) return success(this.#table);

		this.#loading ??= this.#load().finally(() => {
			this.#loading = undefined;
		});
		return this.#loading;
	}

	get #key(): string {
		return `rdap:bootstrap:${this.#options.registry}`;
	}

	#fresh(table: BootstrapTable): boolean {
		return Date.now() - table.fetchedAt < this.#options.ttlMs;
	}

	async #load(): Promise<Result<BootstrapTable, RDAPError>> {
		let cached = await this.#readCache();
		if (cached && (!this.#table || cached.fetchedAt > this.#table.fetchedAt)) {
			this.#table = cached;
		}
		if (this.#table && this.#fresh(this.#table)) return success(this.#table);

		let fetched = await this.#fetch();
		if (isSuccess(fetched)) {
			this.#table = fetched.data;
			await this.#options.cache.write(this.#key, stored(fetched.data));
			return fetched;
		}

		if (this.#table) return success(this.#table);
		return failure(
			new RDAPError(
				"bootstrap-unavailable",
				`The ${this.#options.registry} bootstrap file could not be fetched and no copy is cached`,
				{ url: this.#options.url },
				{ cause: fetched.error },
			),
		);
	}

	/** Reads the cached copy; an unreachable cache or an entry of the wrong shape is a miss. */
	async #readCache(): Promise<BootstrapTable | undefined> {
		let read = await this.#options.cache.read<Stored>(this.#key);
		if (isFailure(read) || read.data === null) return undefined;

		let parsed = s.parseSafe(STORED_SCHEMA, read.data);
		if (!parsed.success) return undefined;

		return {
			fetchedAt: parsed.value.fetchedAt,
			services: new Map(Object.entries(parsed.value.services)),
		};
	}

	async #fetch(): Promise<Result<BootstrapTable, RDAPError>> {
		let answered = await requestJSON(new URL(this.#options.url), {
			...this.#options.request,
			accept: "application/json",
		});
		if (isFailure(answered)) return answered;

		let parsed = s.parseSafe(BOOTSTRAP_SCHEMA, answered.data.json);
		if (!parsed.success) {
			return failure(
				new RDAPError("invalid-response", `${answered.data.url} is not a bootstrap file`, {
					url: answered.data.url,
				}),
			);
		}

		let services = new Map<string, string[]>();
		for (let [suffixes = [], urls = []] of parsed.value.services) {
			for (let suffix of suffixes) services.set(suffixKey(suffix), urls);
		}

		return success({ fetchedAt: Date.now(), services });
	}
}

/** A table in the form the cache stores, which JSON can write. */
function stored(table: BootstrapTable): Stored {
	return { fetchedAt: table.fetchedAt, services: Object.fromEntries(table.services) };
}

/**
 * Chooses the base URL to query from an entry's list: the first HTTPS one, as RFC 9224
 * asks, or the first of any scheme when the entry lists no HTTPS URL. The result ends in
 * a slash, so RFC 9082 paths resolve beneath it.
 *
 * @param urls - The base URLs one entry lists.
 * @returns The base URL, or `undefined` when no listed URL parses.
 */
export function baseUrl(urls: readonly string[]): URL | undefined {
	let parsed = urls.filter((url) => URL.canParse(url)).map((url) => new URL(url));
	let chosen = parsed.find((url) => url.protocol === "https:") ?? parsed[0];
	if (chosen === undefined) return undefined;

	if (!chosen.pathname.endsWith("/")) chosen.pathname += "/";
	return chosen;
}
