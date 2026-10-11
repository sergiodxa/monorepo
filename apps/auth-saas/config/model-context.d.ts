/**
 * What the control plane's model callbacks and methods read besides the database: the rest of
 * the registry, bound to the same request or job, so a model reaching another one is
 * type-checked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BoundModels } from "@sdxc/data-model";

import type { AgentClientBindings } from "~/app/models/agent-client-bindings";
import type { AttackSignalAlerts } from "~/app/models/attack-signal-alerts";
import type { BillingCheckouts } from "~/app/models/billing-checkouts";
import type { BillingDeliveries } from "~/app/models/billing-deliveries";
import type { Customers } from "~/app/models/customers";
import type { Domains } from "~/app/models/domains";
import type { FlagChanges } from "~/app/models/flag-changes";
import type { Memberships } from "~/app/models/memberships";
import type { PendingSignups } from "~/app/models/pending-signups";
import type { TenantAddons } from "~/app/models/tenant-addons";
import type { TenantEntitlements } from "~/app/models/tenant-entitlements";
import type { TenantExportRuns } from "~/app/models/tenant-export-runs";
import type { TenantImportRuns } from "~/app/models/tenant-import-runs";
import type { TenantMemberInvitations } from "~/app/models/tenant-member-invitations";
import type { TenantUsageDays } from "~/app/models/tenant-usage-days";
import type { Tenants } from "~/app/models/tenants";

/**
 * The registry's entries, resolved one at a time when read, so a model method calling a
 * sibling leaves the rest of the registry's type alone.
 */
interface ControlPlaneModels {
	customers: typeof Customers;
	tenants: typeof Tenants;
	memberships: typeof Memberships;
	domains: typeof Domains;
	agentClientBindings: typeof AgentClientBindings;
	attackSignalAlerts: typeof AttackSignalAlerts;
	billingCheckouts: typeof BillingCheckouts;
	billingDeliveries: typeof BillingDeliveries;
	flagChanges: typeof FlagChanges;
	pendingSignups: typeof PendingSignups;
	tenantAddons: typeof TenantAddons;
	tenantEntitlements: typeof TenantEntitlements;
	tenantUsageDays: typeof TenantUsageDays;
	tenantExportRuns: typeof TenantExportRuns;
	tenantImportRuns: typeof TenantImportRuns;
	tenantMemberInvitations: typeof TenantMemberInvitations;
}

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Every model, bound to the same database and unit of work as the one calling. */
		models: BoundModels<ControlPlaneModels>;
	}
}

export {};
