import type { Schema } from "remix/data-schema";

import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import type { HostMetadata } from "~/app/lib/host-metadata";

/** Schema for SSL validation DNS TXT records. */
const SSLValidationRecordSchema = s.object({
	txt_name: s.string(),
	txt_value: s.string(),
});

/** Schema for SSL configuration and status. */
const SSLSchema = s.object({
	status: s.string(),
	method: s.string(),
	type: s.string(),
	validation_records: s.optional(s.array(SSLValidationRecordSchema)),
	validation_errors: s.optional(s.array(s.object({ message: s.string() }))),
});

/** Schema for custom hostname from Cloudflare API. */
const CustomHostnameSchema = s.object({
	id: s.string(),
	hostname: s.string(),
	status: s.string(),
	ssl: SSLSchema,
	custom_metadata: s.optional(
		s.object({
			tenant_id: s.optional(s.string()),
			region: s.optional(s.string()),
		}),
	),
	created_at: s.string(),
});

/** Schema for Cloudflare API error object. */
const ErrorSchema = s.object({
	code: s.number(),
	message: s.string(),
});

/** Schema for pagination info in list responses. */
const ResultInfoSchema = s.object({
	page: s.number(),
	per_page: s.number(),
	total_count: s.number(),
	total_pages: s.number(),
});

/** Schema for single hostname API response. */
const SingleResponseSchema = s.object({
	result: CustomHostnameSchema,
	success: s.literal(true),
	errors: s.array(ErrorSchema),
	messages: s.array(s.string()),
});

/** Schema for list hostnames API response. */
const ListResponseSchema = s.object({
	result: s.array(CustomHostnameSchema),
	success: s.literal(true),
	errors: s.array(ErrorSchema),
	messages: s.array(s.string()),
	result_info: ResultInfoSchema,
});

/** Schema for error API response. */
const ErrorResponseSchema = s.object({
	success: s.literal(false),
	errors: s.array(ErrorSchema),
});

/** SSL validation record with DNS TXT name and value. */
type SSLValidationRecord = s.InferOutput<typeof SSLValidationRecordSchema>;

/** Custom hostname object from Cloudflare API. */
type CustomHostname = s.InferOutput<typeof CustomHostnameSchema>;

/**
 * Hostname service for Cloudflare for SaaS custom domain management.
 * Requires CF_API_TOKEN and CF_ZONE_ID environment variables.
 *
 * @see https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/
 */
export default class HostnameService {
	/** Base URL for the Cloudflare custom hostnames API. */
	private static get BASE_URL() {
		return `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames`;
	}

	/** Error thrown when Cloudflare API requests fail. */
	static ApiError = class extends Error {
		override name = "CloudflareApiError";
		constructor(
			message: string,
			/** HTTP status code from the API response. */
			public statusCode: number,
			/** Array of error details from Cloudflare. */
			public errors?: Array<{ code: number; message: string }>,
		) {
			super(message);
		}
	};

	/**
	 * Makes an authenticated request to Cloudflare API with schema validation.
	 * @param method - HTTP method.
	 * @param path - API path (appended to BASE_URL unless it starts with http).
	 * @param schema - Schema to validate the response against.
	 * @param body - Optional request body.
	 * @returns Validated response data.
	 * @throws {HostnameService.ApiError} When the API returns an error or validation fails.
	 */
	private static async request<Input, Output>(
		method: string,
		path: string,
		schema: Schema<Input, Output>,
		body?: unknown,
	): Promise<Output> {
		let url = path.startsWith("http") ? path : `${HostnameService.BASE_URL}${path}`;

		let response = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${env.CF_API_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		let data: unknown = await response.json();

		let errorResult = s.parseSafe(ErrorResponseSchema, data);
		if (errorResult.success) {
			let errorMessage = errorResult.value.errors[0]?.message ?? "Unknown error";
			throw new HostnameService.ApiError(errorMessage, response.status, errorResult.value.errors);
		}

		let result = s.parseSafe(schema, data);
		if (!result.success) {
			throw new HostnameService.ApiError(
				`Invalid Cloudflare API response: ${result.issues?.[0]?.message ?? "validation failed"}`,
				response.status,
			);
		}

		return result.value;
	}

	/**
	 * Makes an authenticated request that doesn't return a body.
	 * @param method - HTTP method.
	 * @param path - API path (appended to BASE_URL unless it starts with http).
	 * @throws {HostnameService.ApiError} When the API returns an error.
	 */
	private static async requestVoid(method: string, path: string): Promise<void> {
		let url = path.startsWith("http") ? path : `${HostnameService.BASE_URL}${path}`;

		let response = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${env.CF_API_TOKEN}`,
				"Content-Type": "application/json",
			},
		});

		let data: unknown = await response.json();

		let errorResult = s.parseSafe(ErrorResponseSchema, data);
		if (errorResult.success) {
			let errorMessage = errorResult.value.errors[0]?.message ?? "Unknown error";
			throw new HostnameService.ApiError(errorMessage, response.status, errorResult.value.errors);
		}
	}

	/**
	 * Creates a custom hostname with tenant metadata using TXT validation for SSL.
	 * @param hostname - The hostname to create.
	 * @param tenantId - Tenant ID to associate with the hostname.
	 * @param region - Optional DO location hint (defaults to "wnam", matching the
	 * worker entry's fallback when metadata omits it).
	 * @returns The created custom hostname.
	 */
	static async createHostname(
		hostname: string,
		tenantId: string,
		region?: HostMetadata["region"],
	): Promise<CustomHostname> {
		let metadata: HostMetadata = { tenant_id: tenantId, region: region ?? "wnam" };
		let response = await HostnameService.request("POST", "", SingleResponseSchema, {
			hostname,
			ssl: {
				method: "txt",
				type: "dv",
				settings: {
					min_tls_version: "1.2",
				},
			},
			custom_metadata: metadata,
		});

		return response.result;
	}

	/**
	 * Gets a custom hostname by ID.
	 * @param hostnameId - The hostname ID.
	 * @returns The custom hostname.
	 */
	static async getHostname(hostnameId: string): Promise<CustomHostname> {
		let response = await HostnameService.request("GET", `/${hostnameId}`, SingleResponseSchema);
		return response.result;
	}

	/**
	 * Gets a custom hostname by hostname string.
	 * @param hostname - The hostname string to look up.
	 * @returns The custom hostname or null if not found.
	 */
	static async getHostnameByName(hostname: string): Promise<CustomHostname | null> {
		let response = await HostnameService.request(
			"GET",
			`?hostname=${encodeURIComponent(hostname)}`,
			ListResponseSchema,
		);
		return response.result[0] ?? null;
	}

	/**
	 * Lists all custom hostnames for a tenant.
	 * Fetches all pages and filters client-side since Cloudflare doesn't support
	 * filtering by custom_metadata.
	 * @param tenantId - The tenant ID to filter by.
	 * @returns Array of custom hostnames belonging to the tenant.
	 */
	static async listHostnamesByTenant(tenantId: string): Promise<CustomHostname[]> {
		let allHostnames: CustomHostname[] = [];
		let page = 1;
		let hasMore = true;

		while (hasMore) {
			let response = await HostnameService.request(
				"GET",
				`?page=${page}&per_page=50`,
				ListResponseSchema,
			);

			allHostnames.push(...response.result);

			if (
				response.result_info.page >= response.result_info.total_pages ||
				response.result.length === 0
			) {
				hasMore = false;
			} else {
				page++;
			}
		}

		return allHostnames.filter((h) => h.custom_metadata?.tenant_id === tenantId);
	}

	/**
	 * Deletes a custom hostname.
	 * @param hostnameId - The hostname ID to delete.
	 */
	static async deleteHostname(hostnameId: string): Promise<void> {
		await HostnameService.requestVoid("DELETE", `/${hostnameId}`);
	}

	/**
	 * Refreshes SSL validation for a hostname to get updated validation records.
	 * @param hostnameId - The hostname ID to refresh.
	 * @returns The updated custom hostname.
	 */
	static async refreshHostname(hostnameId: string): Promise<CustomHostname> {
		let response = await HostnameService.request("PATCH", `/${hostnameId}`, SingleResponseSchema, {
			ssl: {
				method: "txt",
				type: "dv",
			},
		});
		return response.result;
	}

	/**
	 * Gets the DNS TXT validation record for a hostname.
	 * @param hostname - The custom hostname object.
	 * @returns The validation record or null if validation is not pending.
	 */
	static getValidationRecord(hostname: CustomHostname): SSLValidationRecord | null {
		if (hostname.ssl.status !== "pending_validation" || !hostname.ssl.validation_records?.length) {
			return null;
		}
		return hostname.ssl.validation_records[0] ?? null;
	}

	/**
	 * Checks if a hostname is fully active (both hostname and SSL are active).
	 * @param hostname - The custom hostname object.
	 * @returns True if both hostname and SSL status are "active".
	 */
	static isActive(hostname: CustomHostname): boolean {
		return hostname.status === "active" && hostname.ssl.status === "active";
	}

	/**
	 * Checks if a hostname is pending validation.
	 * @param hostname - The custom hostname object.
	 * @returns True if hostname or SSL is pending validation.
	 */
	static isPendingValidation(hostname: CustomHostname): boolean {
		return hostname.status === "pending" || hostname.ssl.status === "pending_validation";
	}

	/**
	 * Gets a human-readable status message for a hostname.
	 * @param hostname - The custom hostname object.
	 * @returns A user-friendly status string.
	 */
	static getStatusMessage(hostname: CustomHostname): string {
		if (HostnameService.isActive(hostname)) {
			return "Active";
		}

		if (hostname.ssl.validation_errors?.length) {
			return `Validation failed: ${hostname.ssl.validation_errors[0]?.message}`;
		}

		if (hostname.ssl.status === "pending_validation") {
			return "Pending DNS validation";
		}

		if (hostname.ssl.status === "pending_issuance") {
			return "SSL certificate being issued";
		}

		if (hostname.ssl.status === "pending_deployment") {
			return "SSL certificate being deployed";
		}

		if (hostname.status === "pending") {
			return "Pending activation";
		}

		return `Status: ${hostname.status} / SSL: ${hostname.ssl.status}`;
	}

	/**
	 * Creates a default subdomain for a tenant.
	 * Default subdomains don't need custom hostname creation because they're
	 * already under our zone.
	 * @param slug - The tenant slug.
	 * @returns The full subdomain (e.g., "{slug}.auth.sergiodxa.com").
	 */
	static createDefaultSubdomain(slug: string): string {
		return `${slug}.${env.PLATFORM_DOMAIN}`;
	}
}
