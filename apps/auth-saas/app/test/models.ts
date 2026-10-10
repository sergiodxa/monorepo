/**
 * The control plane's models bound to a test database, the same registry a request binds,
 * so a test seeds and asserts through the code the app runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Models } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";

import type { Models as BoundModels } from "~/app/models";
import type { TenantRow } from "~/app/models/tenants";

import { models } from "~/app/models";

/**
 * Binds every model to `db`.
 *
 * @param db A database from `createTestDatabase()`.
 */
export function bindModels(db: Database): BoundModels {
	return models.bind({ db });
}

/**
 * Publishes the models bound to `db` on a job context a test built by hand, the way the
 * dispatcher's `models()` middleware does for a real run.
 *
 * @param ctx The job context a test created with `createJobContext`.
 * @param db The database the job reads.
 */
export function publishModels(
	ctx: { set(key: object, value: unknown, options: { property: string }): void },
	db: Database,
): void {
	ctx.set(Models, bindModels(db), { property: "models" });
}

/**
 * Writes a customer and a tenant under it, slugged and issued from `name`, so a row that
 * references a tenant has one to point at.
 *
 * @param models The models a test bound with `bindModels`.
 * @param name The customer's and the tenant's name.
 * @returns The tenant row.
 */
export async function seedTenant(models: BoundModels, name: string): Promise<TenantRow> {
	let customer = unwrap(await models.customers.create({ name }));
	let slug = name.toLowerCase();
	return unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name,
			slug,
			issuer: `https://${slug}.example.com`,
		}),
	);
}
