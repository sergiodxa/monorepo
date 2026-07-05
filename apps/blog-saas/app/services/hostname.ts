import { env } from "cloudflare:workers";

/** Result of creating a custom hostname on Cloudflare for SaaS. */
export interface CustomHostnameResult {
	id: string;
	status: string;
	sslStatus: string | null;
	validationTxtName: string | null;
	validationTxtValue: string | null;
}

interface CfHostnameResponse {
	success: boolean;
	result?: {
		id: string;
		status: string;
		ssl?: {
			status?: string;
			validation_records?: Array<{ txt_name?: string; txt_value?: string }>;
		};
		ownership_verification?: { name?: string; value?: string };
	};
}

/**
 * Cloudflare for SaaS custom-hostname lifecycle, tagging each hostname with the
 * `blog_id`/`region` metadata the worker entry reads to route custom domains.
 * Ported from `apps/auth-saas` with the metadata key renamed to `blog_id`.
 */
export class HostnameService {
	private base = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames`;

	private headers(): HeadersInit {
		return { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" };
	}

	/** Registers a custom hostname (TXT validation) bound to a blog + region. */
	async create(hostname: string, blogId: string, region: string): Promise<CustomHostnameResult> {
		let response = await fetch(this.base, {
			method: "POST",
			headers: this.headers(),
			body: JSON.stringify({
				hostname,
				ssl: { method: "txt", type: "dv" },
				custom_metadata: { blog_id: blogId, region },
			}),
		});
		let data = (await response.json()) as CfHostnameResponse;
		if (!data.success || !data.result) throw new Error("Custom hostname creation failed");
		return this.toResult(data);
	}

	/** Fetches the current validation/SSL status of a custom hostname. */
	async status(id: string): Promise<CustomHostnameResult> {
		let response = await fetch(`${this.base}/${id}`, { headers: this.headers() });
		let data = (await response.json()) as CfHostnameResponse;
		if (!data.success || !data.result) throw new Error("Custom hostname lookup failed");
		return this.toResult(data);
	}

	/** True when both the hostname and its SSL certificate are active. */
	isActive(result: CustomHostnameResult): boolean {
		return result.status === "active" && result.sslStatus === "active";
	}

	/** Deletes a custom hostname. */
	async destroy(id: string): Promise<void> {
		await fetch(`${this.base}/${id}`, { method: "DELETE", headers: this.headers() });
	}

	private toResult(data: CfHostnameResponse): CustomHostnameResult {
		let result = data.result!;
		let validation = result.ssl?.validation_records?.[0];
		return {
			id: result.id,
			status: result.status,
			sslStatus: result.ssl?.status ?? null,
			validationTxtName: validation?.txt_name ?? result.ownership_verification?.name ?? null,
			validationTxtValue: validation?.txt_value ?? result.ownership_verification?.value ?? null,
		};
	}
}
