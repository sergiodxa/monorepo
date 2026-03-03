import type { Schema } from "remix/data-schema";

import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

// ============================================================================
// SCHEMAS
// ============================================================================

const SSLValidationRecordSchema = s.object({
	txt_name: s.string(),
	txt_value: s.string(),
});

const SSLSchema = s.object({
	status: s.string(), // SSL status values are dynamic, validated loosely
	method: s.string(),
	type: s.string(),
	validation_records: s.optional(s.array(SSLValidationRecordSchema)),
	validation_errors: s.optional(s.array(s.object({ message: s.string() }))),
});

const CustomHostnameSchema = s.object({
	id: s.string(),
	hostname: s.string(),
	status: s.string(), // Hostname status values are dynamic, validated loosely
	ssl: SSLSchema,
	custom_metadata: s.optional(
		s.object({
			tenant_id: s.optional(s.string()),
			region: s.optional(s.string()),
		}),
	),
	created_at: s.string(),
});

const ErrorSchema = s.object({
	code: s.number(),
	message: s.string(),
});

const ResultInfoSchema = s.object({
	page: s.number(),
	per_page: s.number(),
	total_count: s.number(),
	total_pages: s.number(),
});

const SingleResponseSchema = s.object({
	result: CustomHostnameSchema,
	success: s.literal(true),
	errors: s.array(ErrorSchema),
	messages: s.array(s.string()),
});

const ListResponseSchema = s.object({
	result: s.array(CustomHostnameSchema),
	success: s.literal(true),
	errors: s.array(ErrorSchema),
	messages: s.array(s.string()),
	result_info: ResultInfoSchema,
});

const ErrorResponseSchema = s.object({
	success: s.literal(false),
	errors: s.array(ErrorSchema),
});

// ============================================================================
// TYPE DEFINITIONS (derived from schemas)
// ============================================================================

type SSLValidationRecord = s.InferOutput<typeof SSLValidationRecordSchema>;
type CustomHostname = s.InferOutput<typeof CustomHostnameSchema>;

/**
 * Hostname service for Cloudflare for SaaS custom domain management.
 * Requires CF_API_TOKEN and CF_ZONE_ID environment variables.
 *
 * @see https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/
 */
export default class HostnameService {
	private static get BASE_URL() {
		return `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames`;
	}

	static ApiError = class extends Error {
		override name = "CloudflareApiError";
		constructor(
			message: string,
			public statusCode: number,
			public errors?: Array<{ code: number; message: string }>,
		) {
			super(message);
		}
	};

	/**
	 * Make an authenticated request to Cloudflare API with schema validation.
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

		// Check for error response first
		let errorResult = s.parseSafe(ErrorResponseSchema, data);
		if (errorResult.success) {
			let errorMessage = errorResult.value.errors[0]?.message ?? "Unknown error";
			throw new HostnameService.ApiError(errorMessage, response.status, errorResult.value.errors);
		}

		// Validate against expected schema
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
	 * Make an authenticated DELETE request (no response body validation needed).
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

		// Check for error response
		let errorResult = s.parseSafe(ErrorResponseSchema, data);
		if (errorResult.success) {
			let errorMessage = errorResult.value.errors[0]?.message ?? "Unknown error";
			throw new HostnameService.ApiError(errorMessage, response.status, errorResult.value.errors);
		}
	}

	// ============================================================================
	// CUSTOM HOSTNAMES
	// ============================================================================

	/**
	 * Create a custom hostname with tenant metadata.
	 * Uses TXT validation method for SSL.
	 */
	static async createHostname(
		hostname: string,
		tenantId: string,
		region?: string,
	): Promise<CustomHostname> {
		let response = await HostnameService.request("POST", "", SingleResponseSchema, {
			hostname,
			ssl: {
				method: "txt",
				type: "dv",
				settings: {
					min_tls_version: "1.2",
				},
			},
			custom_metadata: {
				tenant_id: tenantId,
				region: region ?? "auto",
			},
		});

		return response.result;
	}

	/**
	 * Get a custom hostname by ID.
	 */
	static async getHostname(hostnameId: string): Promise<CustomHostname> {
		let response = await HostnameService.request("GET", `/${hostnameId}`, SingleResponseSchema);
		return response.result;
	}

	/**
	 * Get a custom hostname by hostname string.
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
	 * List all custom hostnames for a tenant.
	 */
	static async listHostnamesByTenant(tenantId: string): Promise<CustomHostname[]> {
		// Cloudflare doesn't support filtering by custom_metadata,
		// so we need to fetch all and filter client-side
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
	 * Delete a custom hostname.
	 */
	static async deleteHostname(hostnameId: string): Promise<void> {
		await HostnameService.requestVoid("DELETE", `/${hostnameId}`);
	}

	/**
	 * Refresh SSL validation for a hostname.
	 * Call this to get updated validation records.
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

	// ============================================================================
	// VALIDATION HELPERS
	// ============================================================================

	/**
	 * Get the DNS TXT validation record for a hostname.
	 * Returns null if validation is not pending.
	 */
	static getValidationRecord(hostname: CustomHostname): SSLValidationRecord | null {
		if (hostname.ssl.status !== "pending_validation" || !hostname.ssl.validation_records?.length) {
			return null;
		}
		return hostname.ssl.validation_records[0] ?? null;
	}

	/**
	 * Check if a hostname is fully active (hostname + SSL both active).
	 */
	static isActive(hostname: CustomHostname): boolean {
		return hostname.status === "active" && hostname.ssl.status === "active";
	}

	/**
	 * Check if a hostname is pending validation.
	 */
	static isPendingValidation(hostname: CustomHostname): boolean {
		return hostname.status === "pending" || hostname.ssl.status === "pending_validation";
	}

	/**
	 * Get human-readable status message.
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

	// ============================================================================
	// DEFAULT SUBDOMAIN
	// ============================================================================

	/**
	 * Create a default subdomain for a tenant.
	 * Format: {slug}.auth.sergiodxa.com
	 *
	 * Note: Default subdomains don't need custom hostname creation
	 * because they're already under our zone. This just tracks them.
	 */
	static createDefaultSubdomain(slug: string): string {
		return `${slug}.${env.PLATFORM_DOMAIN}`;
	}
}
