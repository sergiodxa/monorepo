import { env } from "cloudflare:workers";

/**
 * Event types for analytics tracking.
 */
type EventType = "authentication" | "registration" | "verification" | "logout";

/**
 * MAU count result from Analytics Engine query.
 */
interface MAUResult {
	tenant_id: string;
	mau: number;
}

/** UUID v4 regex pattern for tenant/subject ID validation. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** YYYY-MM pattern for month validation. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates that a string is a valid UUID v4.
 * Prevents SQL injection by ensuring only safe characters.
 * @param value - The string to validate.
 * @param field - The field name for error messages.
 * @throws AnalyticsValidationError if validation fails.
 */
function validateUUID(value: string, field: string): void {
	if (!UUID_PATTERN.test(value)) {
		throw new AnalyticsValidationError(`Invalid ${field}: must be a valid UUID`);
	}
}

/**
 * Validates that a string is a valid YYYY-MM month format.
 * Prevents SQL injection by ensuring only safe characters.
 * @param value - The string to validate.
 * @throws AnalyticsValidationError if validation fails.
 */
function validateMonth(value: string): void {
	if (!MONTH_PATTERN.test(value)) {
		throw new AnalyticsValidationError("Invalid month: must be in YYYY-MM format");
	}
}

/**
 * Escapes single quotes in SQL string literals.
 * Used as defense-in-depth after validation.
 * @param value - The string to escape.
 * @returns The escaped string with single quotes doubled.
 */
function escapeSqlString(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Error thrown when analytics input validation fails.
 */
class AnalyticsValidationError extends Error {
	/**
	 * Creates a new AnalyticsValidationError.
	 * @param message - The error message.
	 */
	constructor(message: string) {
		super(message);
		this.name = "AnalyticsValidationError";
	}
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
	 * @param tenantId - The tenant identifier.
	 * @param subjectId - The user identifier.
	 */
	static trackAuthentication(tenantId: string, subjectId: string): void {
		let month = new Date().toISOString().slice(0, 7);

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "mau", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});

		env.ANALYTICS.writeDataPoint({
			blobs: [tenantId, "authentication", subjectId, month],
			doubles: [1],
			indexes: [tenantId],
		});
	}

	/**
	 * Track a user registration event.
	 * @param tenantId - The tenant identifier.
	 * @param subjectId - The user identifier.
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
	 * @param tenantId - The tenant identifier.
	 * @param subjectId - The user identifier.
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
	 * @param tenantId - The tenant identifier.
	 * @param subjectId - The user identifier.
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
	 * @param tenantId - The tenant identifier.
	 * @param eventType - The type of event to track.
	 * @param subjectId - The user identifier.
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
	 * Uses Analytics Engine SQL API via Cloudflare API (the ANALYTICS binding only supports writing).
	 * @param tenantId - The tenant identifier.
	 * @param month - The month in YYYY-MM format.
	 * @returns The number of unique active users for the month.
	 * @throws Error if the Analytics Engine query fails.
	 */
	static async queryMAU(tenantId: string, month: string): Promise<number> {
		validateUUID(tenantId, "tenantId");
		validateMonth(month);

		let query = `
			SELECT COUNT(DISTINCT blob3) AS mau
			FROM auth-saas-analytics
			WHERE
				blob1 = '${escapeSqlString(tenantId)}'
				AND blob2 = 'mau'
				AND blob4 = '${escapeSqlString(month)}'
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
	 * @param month - The month in YYYY-MM format.
	 * @returns Array of tenant IDs with their MAU counts.
	 * @throws Error if the Analytics Engine query fails.
	 */
	static async queryAllTenantsMAU(month: string): Promise<MAUResult[]> {
		validateMonth(month);

		let query = `
			SELECT
				blob1 AS tenant_id,
				COUNT(DISTINCT blob3) AS mau
			FROM auth-saas-analytics
			WHERE
				blob2 = 'mau'
				AND blob4 = '${escapeSqlString(month)}'
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
	 * @param tenantId - The tenant identifier.
	 * @param month - The month in YYYY-MM format.
	 * @returns The total number of authentication events.
	 * @throws Error if the Analytics Engine query fails.
	 */
	static async queryAuthenticationCount(tenantId: string, month: string): Promise<number> {
		validateUUID(tenantId, "tenantId");
		validateMonth(month);

		let query = `
			SELECT SUM(double1) AS count
			FROM auth-saas-analytics
			WHERE
				blob1 = '${escapeSqlString(tenantId)}'
				AND blob2 = 'authentication'
				AND blob4 = '${escapeSqlString(month)}'
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
	 * @returns The current month string.
	 */
	static getCurrentMonth(): string {
		return new Date().toISOString().slice(0, 7);
	}
}
