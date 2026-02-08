import { z } from "zod/v4";

const BASE_URL = new URL("https://cloudflare-dns.com/dns-query");

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
export type DnsCheckStatus = "ok" | "changed" | "error";

export interface DnsCheckResult {
	status: DnsCheckStatus;
	resolvedValue: string | null;
	responseTimeMs: number;
	errorMessage?: string;
}

// DNS record type to numeric type code mapping
// https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4
const RECORD_TYPE_CODES: Record<DnsRecordType, number> = {
	A: 1,
	AAAA: 28,
	CNAME: 5,
	MX: 15,
	TXT: 16,
	NS: 2,
};

const DnsResponseSchema = z.object({
	Status: z.number(),
	Answer: z
		.object({
			name: z.string(),
			type: z.number(),
			TTL: z.number(),
			data: z.string(),
		})
		.array()
		.optional(),
});

/**
 * Resolves DNS records for a domain using Cloudflare's DNS over HTTPS API.
 * Returns the resolved values and response time.
 */
export async function resolveDns(
	domain: string,
	recordType: DnsRecordType,
): Promise<{ values: string[]; responseTimeMs: number }> {
	let url = new URL(BASE_URL);
	url.searchParams.set("name", domain);
	url.searchParams.set("type", recordType);

	let startTime = performance.now();

	let response = await fetch(url, {
		headers: { accept: "application/dns-json" },
	});

	let responseTimeMs = Math.round(performance.now() - startTime);

	if (!response.ok) {
		throw new Error(`DNS query failed with status ${response.status}`);
	}

	let unparsedBody = await response.json();
	let body = DnsResponseSchema.parse(unparsedBody);

	// Status 0 means NOERROR (successful query)
	// Status 3 means NXDOMAIN (domain doesn't exist)
	if (body.Status !== 0) {
		throw new Error(`DNS query returned status code ${body.Status}`);
	}

	let typeCode = RECORD_TYPE_CODES[recordType];
	let values =
		body.Answer?.filter((record) => record.type === typeCode).map((record) => {
			// Clean up the data - TXT records are quoted
			let data = record.data;
			if (recordType === "TXT" && data.startsWith('"') && data.endsWith('"')) {
				data = data.slice(1, -1);
			}
			return data;
		}) ?? [];

	return { values, responseTimeMs };
}

/**
 * Performs a DNS check for a monitor.
 * Compares the resolved value against the expected value (if provided).
 */
export async function checkDns(
	domain: string,
	recordType: DnsRecordType,
	expectedValue: string | null,
	previousValue: string | null,
): Promise<DnsCheckResult> {
	try {
		let { values, responseTimeMs } = await resolveDns(domain, recordType);

		// Format the resolved values as a sorted, comma-separated string for comparison
		let resolvedValue = values.sort().join(", ") || null;

		let status: DnsCheckStatus = "ok";

		if (expectedValue !== null) {
			// If expected value is set, check against it
			// The expected value can be a single value or comma-separated list
			let expectedValues = expectedValue
				.split(",")
				.map((v) => v.trim())
				.sort()
				.join(", ");
			if (resolvedValue !== expectedValues) {
				status = "changed";
			}
		} else if (previousValue !== null && resolvedValue !== previousValue) {
			// If no expected value but we have a previous value, detect changes
			status = "changed";
		}

		return {
			status,
			resolvedValue,
			responseTimeMs,
		};
	} catch (error) {
		return {
			status: "error",
			resolvedValue: null,
			responseTimeMs: 0,
			errorMessage: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Gets human-readable status text for DNS check status.
 */
export function getDnsStatusText(status: DnsCheckStatus | null): string {
	switch (status) {
		case "ok":
			return "OK";
		case "changed":
			return "Changed";
		case "error":
			return "Error";
		default:
			return "Not Checked";
	}
}

/**
 * Gets the color/severity for the DNS status.
 */
export function getDnsStatusColor(
	status: DnsCheckStatus | null,
): "success" | "warning" | "error" | "neutral" {
	switch (status) {
		case "ok":
			return "success";
		case "changed":
			return "warning";
		case "error":
			return "error";
		default:
			return "neutral";
	}
}
