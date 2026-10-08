/**
 * The RDAP client: given the cache and user agent once, it finds a domain's registry
 * through the IANA bootstrap file, queries it with every hop checked, and answers the
 * registration as plain camelCase data. Constructing one does no work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { EPP_STATUSES } from "./status.js";

import { baseUrl, Bootstrap } from "./bootstrap.js";
import { toDomain } from "./document.js";
import { RDAPError } from "./error.js";
import { domainName, longestSuffix, suffixKey } from "./name.js";
import { requestJSON } from "./request.js";

/** IANA's DNS bootstrap registry. */
const IANA_DNS_BOOTSTRAP = "https://data.iana.org/rdap/dns.json";

/** The media types a query accepts: RDAP's own, and the plain JSON some registries answer with. */
const RDAP_ACCEPT = "application/rdap+json, application/json";

/** One mebibyte; notices and nested entities keep real responses well under it. */
const DEFAULT_MAX_BYTES = 1024 * 1024;

/** The cap on the bootstrap file, which IANA keeps an order of magnitude below it. */
const BOOTSTRAP_MAX_BYTES = 1024 * 1024;

/**
 * Looks up registration data at the registry that holds it.
 *
 * @example let rdap = new RDAP({ cache: new MemoryCache(), userAgent: "ExampleMonitor/1.0" });
 */
export class RDAP {
	readonly #userAgent: string;
	readonly #timeoutMs: number;
	readonly #maxBytes: number;
	readonly #servers: Map<string, string[]>;
	readonly #dns: Bootstrap;

	/** @param options - The cache, user agent, overrides and bounds every lookup shares. */
	constructor(options: RDAP.Options) {
		this.#userAgent = options.userAgent;
		this.#timeoutMs = toMs(options.timeout ?? "10 seconds");
		this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
		this.#servers = new Map(
			Object.entries(options.servers ?? {}).map(([suffix, url]) => [suffixKey(suffix), [url]]),
		);
		this.#dns = new Bootstrap({
			registry: "dns",
			url: options.bootstrap ?? IANA_DNS_BOOTSTRAP,
			cache: options.cache,
			ttlMs: toMs(options.bootstrapTtl ?? "1 day"),
			request: { ...this.#request, maxBytes: BOOTSTRAP_MAX_BYTES },
		});
	}

	/**
	 * Looks up a registered domain at its registry, in one request chain with no retry.
	 * The name is the registration (`example.co.uk`); a name below one answers
	 * `not-found`. `rate-limited` and `server-error` carry `retryAfter` when the server said.
	 *
	 * @param name - The registered domain, in Unicode or A-label form.
	 * @param options - Whether to ask the registrar's server too.
	 * @returns The registration, or why there is none.
	 * @example let domain = await rdap.domain("example.com");
	 */
	async domain(
		name: string,
		options: RDAP.LookupOptions = {},
	): Promise<Result<RDAP.Domain, RDAPError>> {
		let normalized = domainName(name);
		if (isFailure(normalized)) return normalized;
		let { labels } = normalized.data;

		let base = await this.#serverFor(labels);
		if (isFailure(base)) return base;
		if (base.data === null) {
			let tld = labels.at(-1) ?? "";
			return failure(
				new RDAPError("unsupported-tld", `No RDAP server is known for .${tld}`, { tld }),
			);
		}

		let found = await this.#query(
			new URL(`domain/${normalized.data.name}`, base.data),
			normalized.data.name,
		);
		if (isFailure(found)) return found;
		if (!options.related) return found;

		return success(await this.#withRegistrar(found.data));
	}

	/**
	 * The registry base URL for a name: a `servers` override first, then the bootstrap
	 * file, by longest matching suffix. A batch groups its names by this to pace each
	 * registry separately.
	 *
	 * @param name - Any name under the registry, in Unicode or A-label form.
	 * @returns The base URL, ending in a slash, or `null` for a TLD nothing lists.
	 * @example let server = await rdap.server("example.com"); // https://rdap.verisign.com/com/v1/
	 */
	async server(name: string): Promise<Result<URL | null, RDAPError>> {
		let normalized = domainName(name);
		if (isFailure(normalized)) return normalized;
		return this.#serverFor(normalized.data.labels);
	}

	get #request() {
		return { userAgent: this.#userAgent, timeoutMs: this.#timeoutMs, maxBytes: this.#maxBytes };
	}

	async #serverFor(labels: string[]): Promise<Result<URL | null, RDAPError>> {
		let override = longestSuffix(labels, this.#servers);
		if (override) return success(baseUrl(override) ?? null);

		let table = await this.#dns.table();
		if (isFailure(table)) return table;

		let urls = longestSuffix(labels, table.data.services);
		return success(urls ? (baseUrl(urls) ?? null) : null);
	}

	async #query(url: URL, queried: string): Promise<Result<RDAP.Domain, RDAPError>> {
		let answered = await requestJSON(url, { ...this.#request, accept: RDAP_ACCEPT });
		if (isFailure(answered)) return answered;
		return toDomain(answered.data.json, answered.data.url, queried);
	}

	/**
	 * Fills the registrar fields the registry left empty from the registrar's own record.
	 * The registry's dates and statuses stand, and a registrar server that fails leaves
	 * the registry's answer as it was.
	 */
	async #withRegistrar(domain: RDAP.Domain): Promise<RDAP.Domain> {
		let current = domain.registrar;
		let complete = current?.name && current.ianaId && current.abuseEmail;
		if (complete || domain.relatedUrl === null) return domain;

		let related = await this.#query(new URL(domain.relatedUrl), domain.name);
		if (!isSuccess(related) || related.data.registrar === null) return domain;

		let theirs = related.data.registrar;
		return {
			...domain,
			registrar: {
				name: current?.name ?? theirs.name,
				ianaId: current?.ianaId ?? theirs.ianaId,
				abuseEmail: current?.abuseEmail ?? theirs.abuseEmail,
			},
		};
	}
}

/** The options and data an {@link RDAP} client takes and answers. */
export namespace RDAP {
	/** The wiring given once per client. */
	export interface Options {
		/** Where the parsed bootstrap file is kept between isolates. */
		cache: Cache;
		/** Sent on every request; a registry that rate-limits by client identifies the operator by it. */
		userAgent: string;
		/**
		 * The DNS bootstrap file's URL, for a mirror.
		 *
		 * @default "https://data.iana.org/rdap/dns.json"
		 */
		bootstrap?: string;
		/**
		 * Base URLs by TLD or label sequence, matched before the bootstrap file, for a
		 * registry whose RDAP service IANA does not list yet.
		 */
		servers?: Record<string, string>;
		/**
		 * How long a fetched bootstrap file is trusted before a refresh; an older copy is
		 * still served when the refresh fails.
		 *
		 * @default "1 day"
		 */
		bootstrapTtl?: DurationInput;
		/**
		 * One deadline per request chain, covering its redirects and the body.
		 *
		 * @default "10 seconds"
		 */
		timeout?: DurationInput;
		/**
		 * The largest registry response body read, in bytes.
		 *
		 * @default 1048576
		 */
		maxBytes?: number;
	}

	/** What one lookup asks beyond the registry's answer. */
	export interface LookupOptions {
		/**
		 * Queries the registrar's server through the `related` link and fills the
		 * registrar fields the registry left empty.
		 *
		 * @default false
		 */
		related?: boolean;
	}

	/** A domain's registration as its registry publishes it. */
	export interface Domain {
		/** A-label form, lowercased, no trailing dot. */
		name: string;
		/** U-label form when the registry published one, otherwise `null`. */
		unicodeName: string | null;
		/** The registry's object id. */
		handle: string | null;
		/** Epoch milliseconds of the `expiration` event, `null` when the registry publishes none. */
		expiresAt: number | null;
		/** Epoch milliseconds of the `registration` event. */
		registeredAt: number | null;
		/** Epoch milliseconds of the `last changed` event. */
		updatedAt: number | null;
		/** EPP status codes, such as `clientTransferProhibited`; an unknown value is kept as written. */
		status: Status[];
		registrar: Registrar | null;
		/** Lowercased, no trailing dot, in the order published. */
		nameservers: string[];
		/** `secureDNS.delegationSigned`; `null` when the registry does not say. */
		dnssec: boolean | null;
		/** The `related` RDAP link, the registrar's own record on a thin registry. */
		relatedUrl: string | null;
		/** The URL that answered, after redirects. */
		server: string;
		/** The response as the registry sent it, for fields this model omits. */
		document: unknown;
	}

	/** The registrar of record, as the registry's entity describes it. */
	export interface Registrar {
		/** The `fn` of the registrar's jCard. */
		name: string | null;
		/** The `IANA Registrar ID` public id. */
		ianaId: string | null;
		/** The email of the registrar's `abuse` entity, from its jCard. */
		abuseEmail: string | null;
	}

	/** A status code in its EPP spelling. */
	export type EppStatus = (typeof EPP_STATUSES)[number];

	/** An EPP status, or a value outside `EPP_STATUSES` kept as the registry wrote it. */
	export type Status = EppStatus | (string & {});
}
