import { env } from "cloudflare:workers";

/**
 * SSL status for a custom hostname.
 */
type SSLStatus =
	| "initializing"
	| "pending_validation"
	| "pending_issuance"
	| "pending_deployment"
	| "active"
	| "pending_deletion"
	| "deleted";

/**
 * Hostname status.
 */
type HostnameStatus =
	| "active"
	| "pending"
	| "active_redeploying"
	| "moved"
	| "pending_deletion"
	| "deleted"
	| "pending_blocked"
	| "pending_migration"
	| "pending_provisioned"
	| "test_pending"
	| "test_active"
	| "test_active_apex"
	| "test_blocked"
	| "test_failed"
	| "provisioned"
	| "blocked";

/**
 * SSL validation record for DNS TXT validation.
 */
interface SSLValidationRecord {
	txt_name: string;
	txt_value: string;
}

/**
 * Custom hostname object from Cloudflare API.
 */
interface CustomHostname {
	id: string;
	hostname: string;
	status: HostnameStatus;
	ssl: {
		status: SSLStatus;
		method: "http" | "txt" | "email";
		type: "dv";
		validation_records?: SSLValidationRecord[];
		validation_errors?: Array<{ message: string }>;
	};
	custom_metadata?: {
		tenant_id?: string;
		region?: string;
	};
	created_at: string;
}

/**
 * Response from Cloudflare API list endpoint.
 */
interface ListResponse {
	result: CustomHostname[];
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	messages: string[];
	result_info: {
		page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
	};
}

/**
 * Response from Cloudflare API single hostname endpoint.
 */
interface SingleResponse {
	result: CustomHostname;
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	messages: string[];
}

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
	 * Make an authenticated request to Cloudflare API.
	 */
	private static async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		let url = path.startsWith("http") ? path : `${HostnameService.BASE_URL}${path}`;

		let response = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${env.CF_API_TOKEN}`,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		let data = (await response.json()) as
			| SingleResponse
			| ListResponse
			| { success: boolean; errors: Array<{ code: number; message: string }> };

		if (!data.success) {
			let errorMessage = data.errors?.[0]?.message ?? "Unknown error";
			throw new HostnameService.ApiError(errorMessage, response.status, data.errors);
		}

		return data as T;
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
		let response = await HostnameService.request<SingleResponse>("POST", "", {
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
		let response = await HostnameService.request<SingleResponse>("GET", `/${hostnameId}`);
		return response.result;
	}

	/**
	 * Get a custom hostname by hostname string.
	 */
	static async getHostnameByName(hostname: string): Promise<CustomHostname | null> {
		let response = await HostnameService.request<ListResponse>(
			"GET",
			`?hostname=${encodeURIComponent(hostname)}`,
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
			let response = await HostnameService.request<ListResponse>(
				"GET",
				`?page=${page}&per_page=50`,
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
		await HostnameService.request("DELETE", `/${hostnameId}`);
	}

	/**
	 * Refresh SSL validation for a hostname.
	 * Call this to get updated validation records.
	 */
	static async refreshHostname(hostnameId: string): Promise<CustomHostname> {
		let response = await HostnameService.request<SingleResponse>("PATCH", `/${hostnameId}`, {
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
