/**
 * The control plane's models, bound per request and per job as `ctx.models` over the platform
 * D1 database. Each entry imports its module on first use, so an invocation evaluates only the
 * models it touches. Tenant state lives in each tenant's Durable Object, never here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

/** Every control-plane model, keyed by the name `ctx.models` exposes it under. */
export const models = createModels({
	customers: () => import("./customers"),
	tenants: () => import("./tenants"),
	memberships: () => import("./memberships"),
	domains: () => import("./domains"),
	agentClientBindings: () => import("./agent-client-bindings"),
	attackSignalAlerts: () => import("./attack-signal-alerts"),
	billingCheckouts: () => import("./billing-checkouts"),
	billingDeliveries: () => import("./billing-deliveries"),
	flagChanges: () => import("./flag-changes"),
	pendingSignups: () => import("./pending-signups"),
	tenantAddons: () => import("./tenant-addons"),
	tenantEntitlements: () => import("./tenant-entitlements"),
	tenantUsageDays: () => import("./tenant-usage-days"),
	tenantExportRuns: () => import("./tenant-export-runs"),
	tenantImportRuns: () => import("./tenant-import-runs"),
	tenantMemberInvitations: () => import("./tenant-member-invitations"),
});

/** The registry bound to one request or job, for a service handed `ctx.models`. */
export type Models = BoundRegistry<typeof models>;
