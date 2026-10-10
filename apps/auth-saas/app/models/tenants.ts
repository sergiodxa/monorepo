/**
 * Tenants: each an isolated OIDC/OAuth2 provider addressed by its own Durable Object, its own
 * issuer and its own subscription. Ownership and team access live in memberships, hostnames
 * in domains; this model owns the tenant row, its slug and the lapse rule paid writes obey.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Result } from "@sdxc/result";
import type { TableRow } from "remix/data-table";

import { createModel } from "@sdxc/data-model";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { failure, isFailure, success } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import { ne } from "remix/data-table";

import type { REGIONS } from "~/database/schema";

import { tenants } from "~/database/schema";

/** Cloudflare region codes a tenant's Durable Object can be placed in. */
export type Region = (typeof REGIONS)[number];

/** Mints a `ten_` TypeID for a new tenant row. */
const tenantId = typeid("ten");

/** Tenants one page of `listProvisioned` reads, when a caller does not choose. */
const DEFAULT_PROVISIONED_PAGE_SIZE = 100;

/** Where `listProvisioned` pages from, and how many rows it reads. */
export interface ListProvisionedInput {
	cursor?: string | null;
	limit?: number;
}

/** One page of provisioned tenants and the cursors around it. */
export interface ProvisionedPage {
	tenants: TenantRow[];
	cursors: KeysetCursors;
}

/**
 * Tenants, created active on the free plan; provisioning the tenant's Durable Object is a
 * separate step against its own storage.
 *
 * @example let tenant = await models.tenants.findBySlug("acme");
 */
export const Tenants = createModel(tenants, {
	optional: ["id", "region", "status", "plan_slug", "subscription_status", "cancel_at_period_end"],

	scopes: {
		ofCustomer: (query, customerId: string) => query.where({ customer_id: customerId }),
		/**
		 * Every tenant still running its own Durable Object: a suspended tenant enforces its
		 * suspension per request and still needs the sweeps an active one gets.
		 */
		provisioned: (query) => query.where(ne("status", "deleted")),
	},

	methods: {
		findBySlug(slug: string) {
			return this.findBy({ slug });
		},

		findByIssuer(issuer: string) {
			return this.findBy({ issuer });
		},

		/** The tenant a subscription id was recorded as the base plan of. */
		findBySubscriptionId(subscriptionId: string) {
			return this.findBy({ subscription_id: subscriptionId });
		},

		/**
		 * Pages through every provisioned tenant, oldest first, so a sweep that pages through to
		 * the end has reached every tenant that existed when it began.
		 *
		 * @returns A page and its cursors, or `InvalidCursorError` for a cursor of another ordering.
		 */
		async listProvisioned(
			input: ListProvisionedInput = {},
		): Promise<Result<ProvisionedPage, InvalidCursorError>> {
			let page = await Pagination.byKeyset(this.provisioned(), {
				orderBy: [
					["created_at", "asc"],
					["id", "asc"],
				],
				cursor: input.cursor ?? null,
				limit: input.limit ?? DEFAULT_PROVISIONED_PAGE_SIZE,
			});

			if (isFailure(page)) {
				if (page.error instanceof InvalidCursorError) return failure(page.error);
				throw page.error;
			}

			return success({ tenants: page.data.items, cursors: page.data.cursors });
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? tenantId(generateUUID()).toString(),
				region: values.region ?? "wnam",
				status: values.status ?? "active",
				plan_slug: values.plan_slug ?? "free",
				subscription_status: values.subscription_status ?? "active",
				cancel_at_period_end: values.cancel_at_period_end ?? false,
			};
		},
	},
});

/** One tenant row as the control plane stores it. */
export type TenantRow = TableRow<typeof tenants>;

/**
 * Generates a URL-safe, unique-ish slug from a tenant name: lowercased, non-alphanumerics
 * collapsed to hyphens, trimmed to 20 characters, with four random characters appended.
 *
 * @example generateTenantSlug("Acme, Inc."); // e.g. "acme-inc-4f9a"
 */
export function generateTenantSlug(name: string): string {
	let base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 20);

	let random = crypto.randomUUID().slice(0, 4);
	return `${base}-${random}`;
}

/**
 * Whether a tenant's lapse must refuse a paid-capability write. Token issuance and a custom
 * domain already serving as an issuer keep working through a lapse; each paid capability's
 * own write path checks this before it commits.
 *
 * @example if (isTenantWriteRestricted(tenant)) return lapsed();
 */
export function isTenantWriteRestricted(tenant: Pick<TenantRow, "lapsed_at">): boolean {
	return tenant.lapsed_at !== null;
}

export default Tenants;
