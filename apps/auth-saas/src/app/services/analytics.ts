import { env } from "cloudflare:workers";

/**
 * Event types for analytics tracking.
 */
type EventType =
	| "authentication" // User authenticated
	| "registration" // New user registered
	| "verification" // Email verified
	| "logout"; // User logged out

/**
 * MAU count result from Analytics Engine query.
 */
interface MAUResult {
	tenant_id: string;
	mau: number;
}

/**
 * Analytics service for tracking authentication events and MAU.
 * Uses Cloudflare Analytics Engine for high-cardinality metrics.
 *
 * Data model in Analytics Engine:
 * - blob1: tenant_id
 * - blob2: event_type (mau, authentication, registration, etc.)
 * - blob3: subject_id
 * - blob4: month (YYYY-MM format for MAU tracking)
 * - double1: count (always 1 for individual events)
 * - index1: tenant_id (for efficient querying)
 */
export default class AnalyticsService {
	/**
	 * Track an authentication event for MAU counting.
	 * Should be called on successful authentication.
	 */
	static trackAuthentication(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7); // YYYY-MM

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "mau", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});

		// Also track as authentication event for metrics
		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "authentication", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	/**
	 * Track a user registration event.
	 */
	static trackRegistration(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "registration", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	/**
	 * Track an email verification event.
	 */
	static trackVerification(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "verification", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	/**
	 * Track a logout event.
	 */
	static trackLogout(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "logout", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	/**
	 * Track a generic event.
	 */
	static trackEvent(tenantId: string, eventType: EventType, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, eventType, subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	/**
	 * Query MAU for a specific tenant and month.
	 * Uses Analytics Engine SQL API.
	 *
	 * Note: This requires using the Cloudflare API to query Analytics Engine.
	 * The ANALYTICS binding only supports writing, not reading.
	 */
	static async queryMAU(tenantId: string, month: string): Promise<number> {
		// Analytics Engine queries require the Cloudflare API
		// Format: https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql
		let query = `
			SELECT COUNT(DISTINCT blob3) AS mau
			FROM auth-saas-analytics
			WHERE
				blob1 = '${tenantId}'
				AND blob2 = 'mau'
				AND blob4 = '${month}'
		`;

		let response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.CF_API_TOKEN}`,
					"Content-Type": "text/plain",
				},
				body: query,
			},
		);

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`Analytics Engine query failed: ${error}`);
		}

		let result = (await response.json()) as {
			data: Array<{ mau: number }>;
		};

		return result.data[0]?.mau ?? 0;
	}

	/**
	 * Query MAU for all tenants for a specific month.
	 * Used by the daily MAU reporting job.
	 */
	static async queryAllTenantsMAU(month: string): Promise<MAUResult[]> {
		let query = `
			SELECT
				blob1 AS tenant_id,
				COUNT(DISTINCT blob3) AS mau
			FROM auth-saas-analytics
			WHERE
				blob2 = 'mau'
				AND blob4 = '${month}'
			GROUP BY blob1
		`;

		let response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.CF_API_TOKEN}`,
					"Content-Type": "text/plain",
				},
				body: query,
			},
		);

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`Analytics Engine query failed: ${error}`);
		}

		let result = (await response.json()) as {
			data: MAUResult[];
		};

		return result.data;
	}

	/**
	 * Query total authentications for a tenant in a given month.
	 */
	static async queryAuthenticationCount(tenantId: string, month: string): Promise<number> {
		let query = `
			SELECT SUM(double1) AS count
			FROM auth-saas-analytics
			WHERE
				blob1 = '${tenantId}'
				AND blob2 = 'authentication'
				AND blob4 = '${month}'
		`;

		let response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.CF_API_TOKEN}`,
					"Content-Type": "text/plain",
				},
				body: query,
			},
		);

		if (!response.ok) {
			let error = await response.text();
			throw new Error(`Analytics Engine query failed: ${error}`);
		}

		let result = (await response.json()) as {
			data: Array<{ count: number }>;
		};

		return result.data[0]?.count ?? 0;
	}

	/**
	 * Get the current month in YYYY-MM format.
	 */
	static getCurrentMonth(): string {
		return new Date().toISOString().slice(0, 7);
	}
}
