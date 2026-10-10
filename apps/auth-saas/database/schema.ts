/**
 * The control plane's D1 tables as `remix/data-table` definitions: which tenants exist, who
 * administers each, which hostnames reach them and what each is billed. The models in
 * `app/models/` read and write through these; `database/migrations/` creates them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColumnBuilder } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** The billing identity tenants belong to, joined to the provider's own customer record. */
export const customers = table({
	name: "customers",
	primaryKey: "id",
	timestamps: true,
	columns: {
		id: c.text(),
		name: c.text(),
		provider_connection: c.text().default("polar"),
		provider_customer_id: c.text().nullable(),
		internal: c.boolean().default(false),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** The Cloudflare region codes a tenant's Durable Object can be placed in. */
export const REGIONS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

/** Every tenant: its own Durable Object, issuer, plan and subscription state. */
export const tenants = table({
	name: "tenants",
	primaryKey: "id",
	timestamps: true,
	columns: {
		id: c.text(),
		customer_id: c.text(),
		name: c.text(),
		slug: c.text(),
		issuer: c.text(),
		region: c.enum(REGIONS).default("wnam"),
		status: c.enum(["active", "suspended", "deleted"] as const).default("active"),
		/** Free text, so the plan catalog adds a tier with no schema change. */
		plan_slug: c.text().default("free"),
		subscription_status: c.text().default("active"),
		subscription_id: c.text().nullable(),
		current_period_end: c.integer().nullable(),
		cancel_at_period_end: c.boolean().default(false),
		grace_until: c.integer().nullable(),
		lapsed_at: c.integer().nullable(),
		deleted_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * Who may administer a tenant, at what role. `subject_id` names a subject inside the platform
 * tenant's own object, so it carries no foreign key.
 */
export const memberships = table({
	name: "memberships",
	primaryKey: "id",
	timestamps: true,
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		subject_id: c.text(),
		role: c.enum(["owner", "admin", "member"] as const),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** The hostnames reaching a tenant: its platform subdomain and any custom domain. */
export const domains = table({
	name: "domains",
	primaryKey: "id",
	timestamps: true,
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		hostname: c.text(),
		kind: c.enum(["platform", "custom"] as const),
		status: c.enum(["pending", "active", "failed"] as const).default("pending"),
		certificate_status: c.text().nullable(),
		verification_name: c.text().nullable(),
		verification_value: c.text().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** Which tenant a machine credential registered against the platform tenant may reach. */
export const agentClientBindings = table({
	name: "agent_client_bindings",
	primaryKey: "client_id",
	columns: {
		client_id: c.text(),
		tenant_id: c.text(),
		created_at: c.integer(),
	},
});

/** One row per tenant and day an attack-signal alert went out, spending that day's alert. */
export const attackSignalAlerts = table({
	name: "attack_signal_alerts",
	primaryKey: ["tenant_id", "day"],
	timestamps: true,
	columns: {
		tenant_id: c.text(),
		day: c.integer(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** Checkout attempts, written before a checkout session leaves the process. */
export const billingCheckouts = table({
	name: "billing_checkouts",
	primaryKey: "attempt_id",
	columns: {
		attempt_id: c.text(),
		tenant_id: c.text(),
		customer_id: c.text(),
		product_slug: c.text(),
		kind: c.enum(["base", "addon"] as const),
		checkout_id: c.text().nullable(),
		created_at: c.integer(),
	},
});

/** Billing webhook deliveries, keyed on the platform's own delivery id for deduplication. */
export const billingDeliveries = table({
	name: "billing_deliveries",
	primaryKey: "id",
	columns: {
		id: c.text(),
		type: c.text(),
		payload: c.text(),
		valid: c.boolean(),
		processed: c.boolean().default(false),
		received_at: c.integer(),
	},
});

/** The append-only trail of accepted release-flag and kill-switch writes. */
export const flagChanges = table({
	name: "flag_change",
	primaryKey: "id",
	columns: {
		id: c.text(),
		key: c.text(),
		before: c.text().nullable(),
		after: c.text(),
		actor: c.text(),
		at: c.integer(),
	},
});

/** The organization name a `/signup` submission claimed, held until its email verifies. */
export const pendingSignups = table({
	name: "pending_signups",
	primaryKey: "subject_id",
	columns: {
		subject_id: c.text(),
		organization_name: c.text(),
		created_at: c.integer(),
	},
});

/** A tenant's subscriptions beyond its base plan, each with its own status and period. */
export const tenantAddons = table({
	name: "tenant_addons",
	primaryKey: "id",
	timestamps: true,
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		product_slug: c.text(),
		subscription_id: c.text(),
		status: c.text(),
		current_period_end: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** The local projection of what each tenant holds, one row per tenant. */
export const tenantEntitlements = table({
	name: "tenant_entitlements",
	primaryKey: "tenant_id",
	timestamps: true,
	columns: {
		tenant_id: c.text(),
		products: c.json() as ColumnBuilder<string[]>,
		features: c.json() as ColumnBuilder<Record<string, boolean>>,
		read_at: c.integer(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One tenant's closed usage figures for one day. */
export const tenantUsageDays = table({
	name: "tenant_usage_day",
	primaryKey: ["tenant_id", "day"],
	timestamps: true,
	columns: {
		tenant_id: c.text(),
		day: c.integer(),
		subjects: c.integer(),
		sessions: c.integer(),
		tokens: c.integer(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** The states an import or export run moves through. */
export const RUN_STATUSES = ["queued", "running", "completed", "failed"] as const;

/** A tenant's bulk-export jobs against its own directory. */
export const tenantExportRuns = table({
	name: "tenant_export_runs",
	primaryKey: "id",
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		include_credentials: c.boolean(),
		status: c.enum(RUN_STATUSES),
		cursor: c.text().nullable(),
		report_key: c.text().nullable(),
		total: c.integer().nullable(),
		processed: c.integer().default(0),
		started_at: c.integer().nullable(),
		finished_at: c.integer().nullable(),
		created_at: c.integer(),
	},
});

/** A tenant's bulk-import jobs against its own directory. */
export const tenantImportRuns = table({
	name: "tenant_import_runs",
	primaryKey: "id",
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		mode: c.enum(["validate", "apply"] as const),
		source_key: c.text(),
		report_key: c.text().nullable(),
		status: c.enum(RUN_STATUSES),
		total: c.integer().nullable(),
		processed: c.integer().default(0),
		created: c.integer().default(0),
		updated: c.integer().default(0),
		failed: c.integer().default(0),
		cursor: c.integer().default(0),
		started_at: c.integer().nullable(),
		finished_at: c.integer().nullable(),
		created_at: c.integer(),
	},
});

/** Invitations to administer a tenant, by email, for an address with no dashboard account. */
export const tenantMemberInvitations = table({
	name: "tenant_member_invitations",
	primaryKey: "id",
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		email: c.text(),
		role: c.enum(["owner", "admin", "member"] as const),
		token_hash: c.text(),
		invited_by: c.text(),
		expires_at: c.integer(),
		accepted_at: c.integer().nullable(),
		created_at: c.integer(),
	},
});
