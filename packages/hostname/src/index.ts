/**
 * Cloudflare for SaaS custom-hostname client.
 *
 * A single, DI-friendly wrapper over the Cloudflare custom hostnames API
 * (`https://api.cloudflare.com/client/v4/zones/{zone}/custom_hostnames`). It
 * schema-validates API responses (so malformed payloads surface as
 * {@link HostnameApiError} instead of `undefined`) and exposes an instance API
 * that can be registered with `@pkg/service-container` and constructed from
 * per-app configuration.
 *
 * The stored `custom_metadata` key that identifies the owning entity is
 * configurable via the constructor (`metadataKey`), so a caller keys hostnames
 * by whatever entity id it owns (e.g. a `tenant_id` or `blog_id`) — nothing
 * about the metadata written to Cloudflare changes.
 *
 * @see https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";

/** Schema for SSL validation DNS TXT records. */
let SSLValidationRecordSchema = s.object({
	txt_name: s.string(),
	txt_value: s.string(),
});

/** Schema for SSL configuration and status. */
let SSLSchema = s.object({
	status: s.string(),
	method: s.optional(s.string()),
	type: s.optional(s.string()),
	validation_records: s.optional(s.array(SSLValidationRecordSchema)),
	validation_errors: s.optional(s.array(s.object({ message: s.string() }))),
});

/** Schema for the ownership verification fallback TXT record. */
let OwnershipVerificationSchema = s.object({
	name: s.optional(s.string()),
	value: s.optional(s.string()),
});

/** Schema for a custom hostname object returned by the Cloudflare API. */
let CustomHostnameSchema = s.object({
	id: s.string(),
	hostname: s.string(),
	status: s.string(),
	ssl: SSLSchema,
	custom_metadata: s.optional(s.record(s.string(), s.optional(s.string()))),
	ownership_verification: s.optional(OwnershipVerificationSchema),
	created_at: s.optional(s.string()),
});

/** Schema for a Cloudflare API error object. */
let ErrorSchema = s.object({
	code: s.number(),
	message: s.string(),
});

/** Schema for pagination info in list responses. */
let ResultInfoSchema = s.object({
	page: s.number(),
	per_page: s.number(),
	total_count: s.number(),
	total_pages: s.number(),
});

/** Schema for a single-hostname API response. */
let SingleResponseSchema = s.object({
	result: CustomHostnameSchema,
	success: s.literal(true),
	errors: s.array(ErrorSchema),
	messages: s.array(s.string()),
});

/** Schema for a list-hostnames API response. */
let ListResponseSchema = s.object({
	result: s.array(CustomHostnameSchema),
	success: s.literal(true),
	errors: s.array(ErrorSchema),
	messages: s.array(s.string()),
	result_info: ResultInfoSchema,
});

/** Schema for an error API response. */
let ErrorResponseSchema = s.object({
	success: s.literal(false),
	errors: s.array(ErrorSchema),
});

/** SSL validation record with DNS TXT name and value. */
export type SSLValidationRecord = s.InferOutput<typeof SSLValidationRecordSchema>;

/** Raw custom hostname object as returned by the Cloudflare API. */
export type CustomHostname = s.InferOutput<typeof CustomHostnameSchema>;

/**
 * Normalized result of a custom-hostname operation.
 *
 * Exposes both the flattened validation fields (`sslStatus`,
 * `validationTxtName`, `validationTxtValue`) used by status-polling callers and
 * the nested `ssl` object / `hostname` / `createdAt` fields used by model-layer
 * callers, so a single shape satisfies every consumer.
 */
export interface HostnameResult {
	/** Cloudflare's custom hostname ID. */
	id: string;
	/** The custom hostname (e.g. `blog.example.com`). */
	hostname: string;
	/** Hostname activation status (e.g. `pending`, `active`). */
	status: string;
	/** SSL certificate status, or `null` when the API omits it. */
	sslStatus: string | null;
	/** DNS TXT record name required for DV validation, or `null`. */
	validationTxtName: string | null;
	/** DNS TXT record value required for DV validation, or `null`. */
	validationTxtValue: string | null;
	/** SSL validation errors reported by Cloudflare, if any. */
	sslValidationErrors: Array<{ message: string }>;
	/** ISO timestamp of when the hostname was created, or `null`. */
	createdAt: string | null;
	/** Owning-entity id read from `custom_metadata`, or `null`. */
	entityId: string | null;
	/** Region hint read from `custom_metadata`, or `null`. */
	region: string | null;
	/**
	 * Nested SSL view mirroring the Cloudflare payload, retained so callers that
	 * previously read `result.ssl.status` keep working.
	 */
	ssl: {
		/** SSL certificate status. */
		status: string | null;
		/** DV validation records, if present. */
		validationRecords: SSLValidationRecord[];
		/** SSL validation errors, if present. */
		validationErrors: Array<{ message: string }>;
	};
}

/** Error thrown when a Cloudflare custom-hostname API request fails. */
export class HostnameApiError extends Error {
	override name = "CloudflareApiError";

	/**
	 * @param message - Human-readable error message.
	 * @param statusCode - HTTP status code from the API response.
	 * @param errors - Optional array of error details from Cloudflare.
	 */
	constructor(
		message: string,
		/** HTTP status code from the API response. */
		public statusCode: number,
		/** Array of error details from Cloudflare. */
		public errors?: Array<{ code: number; message: string }>,
	) {
		super(message);
	}
}

/** Options for constructing a {@link HostnameClient}. */
export interface HostnameClientOptions {
	/** Cloudflare API token with custom-hostname edit permission. */
	apiToken: string;
	/** Cloudflare zone ID that owns the custom hostnames. */
	zoneId: string;
	/**
	 * Platform apex used to build default subdomains (e.g. `auth.sergiodxa.com`).
	 * Required only if {@link HostnameClient.createDefaultSubdomain} is called.
	 */
	platformDomain?: string;
	/**
	 * `custom_metadata` key used to tag the owning entity. Defaults to
	 * `"tenant_id"` (auth-saas); blog-saas passes `"blog_id"`. This controls both
	 * what is written by {@link HostnameClient.create} and what
	 * {@link HostnameClient.listByEntity} filters on.
	 */
	metadataKey?: string;
}

/**
 * Client for managing Cloudflare for SaaS custom hostnames.
 *
 * @example
 * ```ts
 * let client = new HostnameClient({
 * 	apiToken: env.CF_API_TOKEN,
 * 	zoneId: env.CF_ZONE_ID,
 * 	platformDomain: env.PLATFORM_DOMAIN,
 * 	metadataKey: "tenant_id",
 * });
 *
 * let result = await client.create("blog.example.com", tenantId, "wnam");
 * if (HostnameClient.isPendingValidation(result)) {
 * 	let record = HostnameClient.getValidationTxtRecord(result);
 * }
 * ```
 */
export class HostnameClient {
	/** Cloudflare API token. */
	private apiToken: string;
	/** Cloudflare zone ID. */
	private zoneId: string;
	/** Platform apex for default subdomains. */
	private platformDomain?: string;
	/** `custom_metadata` key identifying the owning entity. */
	private metadataKey: string;

	/**
	 * @param options - Client configuration.
	 */
	constructor(options: HostnameClientOptions) {
		this.apiToken = options.apiToken;
		this.zoneId = options.zoneId;
		this.platformDomain = options.platformDomain;
		this.metadataKey = options.metadataKey ?? "tenant_id";
	}

	/** Base URL for this client's Cloudflare custom hostnames endpoint. */
	private get baseUrl(): string {
		return `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/custom_hostnames`;
	}

	/** Authorization headers for Cloudflare API requests. */
	private headers(): HeadersInit {
		return {
			Authorization: `Bearer ${this.apiToken}`,
			"Content-Type": "application/json",
		};
	}

	/**
	 * Makes an authenticated request to the Cloudflare API with schema validation.
	 * @param method - HTTP method.
	 * @param path - API path (appended to the base URL unless it starts with `http`).
	 * @param schema - Schema to validate the response against.
	 * @param body - Optional request body serialized as JSON.
	 * @returns The validated response payload.
	 * @throws {HostnameApiError} When the API returns an error or the response fails validation.
	 */
	private async request<Input, Output>(
		method: string,
		path: string,
		schema: Schema<Input, Output>,
		body?: unknown,
	): Promise<Output> {
		let url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

		let response = await fetch(url, {
			method,
			headers: this.headers(),
			body: body ? JSON.stringify(body) : undefined,
		});

		let data: unknown = await response.json();

		let errorResult = s.parseSafe(ErrorResponseSchema, data);
		if (errorResult.success) {
			let message = errorResult.value.errors[0]?.message ?? "Unknown error";
			throw new HostnameApiError(message, response.status, errorResult.value.errors);
		}

		let result = s.parseSafe(schema, data);
		if (!result.success) {
			throw new HostnameApiError(
				`Invalid Cloudflare API response: ${result.issues?.[0]?.message ?? "validation failed"}`,
				response.status,
			);
		}

		return result.value;
	}

	/**
	 * Makes an authenticated request that does not return a meaningful body.
	 * @param method - HTTP method.
	 * @param path - API path (appended to the base URL unless it starts with `http`).
	 * @throws {HostnameApiError} When the API returns an error.
	 */
	private async requestVoid(method: string, path: string): Promise<void> {
		let url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

		let response = await fetch(url, { method, headers: this.headers() });

		let data: unknown = await response.json();

		let errorResult = s.parseSafe(ErrorResponseSchema, data);
		if (errorResult.success) {
			let message = errorResult.value.errors[0]?.message ?? "Unknown error";
			throw new HostnameApiError(message, response.status, errorResult.value.errors);
		}
	}

	/**
	 * Normalizes a raw Cloudflare hostname object into a {@link HostnameResult}.
	 * @param hostname - The raw custom hostname from the API.
	 * @returns The normalized result.
	 */
	private toResult(hostname: CustomHostname): HostnameResult {
		let validationRecords = hostname.ssl.validation_records ?? [];
		let validationErrors = hostname.ssl.validation_errors ?? [];
		let firstRecord = validationRecords[0];
		let ownership = hostname.ownership_verification;
		let metadata = hostname.custom_metadata ?? {};

		return {
			id: hostname.id,
			hostname: hostname.hostname,
			status: hostname.status,
			sslStatus: hostname.ssl.status ?? null,
			validationTxtName: firstRecord?.txt_name ?? ownership?.name ?? null,
			validationTxtValue: firstRecord?.txt_value ?? ownership?.value ?? null,
			sslValidationErrors: validationErrors,
			createdAt: hostname.created_at ?? null,
			entityId: metadata[this.metadataKey] ?? null,
			region: metadata.region ?? null,
			ssl: {
				status: hostname.ssl.status ?? null,
				validationRecords,
				validationErrors,
			},
		};
	}

	/**
	 * Creates a custom hostname tagged with entity metadata, using DV/TXT SSL validation.
	 * @param hostname - The hostname to create.
	 * @param entityId - Owning-entity id stored under the configured metadata key.
	 * @param region - Optional DO location hint stored in `custom_metadata.region` (defaults to `"wnam"`).
	 * @returns The created hostname.
	 * @throws {HostnameApiError} When the API returns an error.
	 * @example
	 * ```ts
	 * let result = await client.create("blog.example.com", tenantId, "wnam");
	 * ```
	 */
	async create(hostname: string, entityId: string, region?: string): Promise<HostnameResult> {
		let response = await this.request("POST", "", SingleResponseSchema, {
			hostname,
			ssl: {
				method: "txt",
				type: "dv",
				settings: { min_tls_version: "1.2" },
			},
			custom_metadata: { [this.metadataKey]: entityId, region: region ?? "wnam" },
		});

		return this.toResult(response.result);
	}

	/**
	 * Gets a custom hostname by its Cloudflare ID.
	 * @param id - The hostname ID.
	 * @returns The hostname.
	 * @throws {HostnameApiError} When the API returns an error.
	 */
	async status(id: string): Promise<HostnameResult> {
		let response = await this.request("GET", `/${id}`, SingleResponseSchema);
		return this.toResult(response.result);
	}

	/**
	 * Gets a custom hostname by its hostname string.
	 * @param hostname - The hostname string to look up.
	 * @returns The hostname, or `null` if none matches.
	 * @throws {HostnameApiError} When the API returns an error.
	 */
	async getByName(hostname: string): Promise<HostnameResult | null> {
		let response = await this.request(
			"GET",
			`?hostname=${encodeURIComponent(hostname)}`,
			ListResponseSchema,
		);
		let first = response.result[0];
		return first ? this.toResult(first) : null;
	}

	/**
	 * Lists all custom hostnames owned by an entity.
	 *
	 * Cloudflare cannot filter by `custom_metadata`, so this fetches every page
	 * and filters client-side on the configured metadata key.
	 * @param entityId - The owning-entity id to filter by.
	 * @returns The matching hostnames.
	 * @throws {HostnameApiError} When the API returns an error.
	 */
	async listByEntity(entityId: string): Promise<HostnameResult[]> {
		let all: CustomHostname[] = [];
		let page = 1;
		let hasMore = true;

		while (hasMore) {
			let response = await this.request("GET", `?page=${page}&per_page=50`, ListResponseSchema);

			all.push(...response.result);

			if (
				response.result_info.page >= response.result_info.total_pages ||
				response.result.length === 0
			) {
				hasMore = false;
			} else {
				page++;
			}
		}

		return all
			.filter((hostname) => hostname.custom_metadata?.[this.metadataKey] === entityId)
			.map((hostname) => this.toResult(hostname));
	}

	/**
	 * Deletes a custom hostname.
	 * @param id - The hostname ID to delete.
	 * @throws {HostnameApiError} When the API returns an error.
	 */
	async delete(id: string): Promise<void> {
		await this.requestVoid("DELETE", `/${id}`);
	}

	/**
	 * Refreshes SSL validation for a hostname to obtain updated validation records.
	 * @param id - The hostname ID to refresh.
	 * @returns The refreshed hostname.
	 * @throws {HostnameApiError} When the API returns an error.
	 */
	async refresh(id: string): Promise<HostnameResult> {
		let response = await this.request("PATCH", `/${id}`, SingleResponseSchema, {
			ssl: { method: "txt", type: "dv" },
		});
		return this.toResult(response.result);
	}

	/**
	 * Builds the default subdomain for a slug under the configured platform domain.
	 *
	 * Default subdomains do not need a custom hostname because they already live
	 * under the platform's own zone.
	 * @param slug - The entity slug.
	 * @returns The full subdomain (e.g. `"{slug}.auth.sergiodxa.com"`).
	 * @throws {TypeError} When `platformDomain` was not provided to the constructor.
	 * @example
	 * ```ts
	 * client.createDefaultSubdomain("acme"); // "acme.auth.sergiodxa.com"
	 * ```
	 */
	createDefaultSubdomain(slug: string): string {
		if (!this.platformDomain) {
			throw new TypeError(
				"HostnameClient.createDefaultSubdomain requires `platformDomain` to be configured",
			);
		}
		return `${slug}.${this.platformDomain}`;
	}

	/**
	 * Checks whether a hostname is fully active (both hostname and SSL are active).
	 * @param result - The hostname result.
	 * @returns `true` if both the hostname status and SSL status are `"active"`.
	 */
	static isActive(result: HostnameResult): boolean {
		return result.status === "active" && result.sslStatus === "active";
	}

	/**
	 * Checks whether a hostname is pending validation.
	 * @param result - The hostname result.
	 * @returns `true` if the hostname is pending or the SSL is pending validation.
	 */
	static isPendingValidation(result: HostnameResult): boolean {
		return result.status === "pending" || result.sslStatus === "pending_validation";
	}

	/**
	 * Gets the DNS TXT validation record for a hostname pending validation.
	 * @param result - The hostname result.
	 * @returns The TXT record `{ name, value }`, or `null` when validation is not pending or no record exists.
	 */
	static getValidationTxtRecord(result: HostnameResult): { name: string; value: string } | null {
		if (result.sslStatus !== "pending_validation") return null;
		if (!result.validationTxtName || !result.validationTxtValue) return null;
		return { name: result.validationTxtName, value: result.validationTxtValue };
	}

	/**
	 * Builds a human-readable status message for a hostname.
	 * @param result - The hostname result.
	 * @returns A user-friendly status string.
	 */
	static getStatusMessage(result: HostnameResult): string {
		if (HostnameClient.isActive(result)) return "Active";

		if (result.sslValidationErrors.length) {
			return `Validation failed: ${result.sslValidationErrors[0]?.message}`;
		}

		if (result.sslStatus === "pending_validation") return "Pending DNS validation";
		if (result.sslStatus === "pending_issuance") return "SSL certificate being issued";
		if (result.sslStatus === "pending_deployment") return "SSL certificate being deployed";
		if (result.status === "pending") return "Pending activation";

		return `Status: ${result.status} / SSL: ${result.sslStatus}`;
	}
}
