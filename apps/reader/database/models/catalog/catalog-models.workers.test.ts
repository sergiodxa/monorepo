/**
 * Drives the catalog's models inside workerd, against the real D1 this app binds as
 * `PLATFORM_DB` with the shipped migrations as its schema: the life-cycle writes on a
 * feed's row, the customer lookups and pages, and a delivery's processed mark.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:test";
import { Database } from "remix/data-table";
import { beforeAll, describe, expect, test } from "vitest";

import type { CatalogModels } from "~/database/models/catalog";

import feedsSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import billingSql from "~/database/catalog-migrations/0002-billing.sql?raw";
import { catalogModels } from "~/database/models/catalog";

/** The epoch milliseconds every write is stamped with, threaded rather than mocked. */
const NOW = 1_800_000_000_000;

let models: CatalogModels;

/** Applies one migration through D1's `exec`, which reads a statement per line. */
async function apply(schema: string): Promise<void> {
	let statements = schema
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join(" ")
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement !== "");

	for (let statement of statements) await env.PLATFORM_DB.exec(`${statement};`);
}

beforeAll(async () => {
	await apply(feedsSql);
	await apply(billingSql);
	models = catalogModels.bind({
		db: new Database(createD1DatabaseAdapter(env.PLATFORM_DB), { now: () => NOW }),
	});
});

/** Writes a catalog row for a URL no other test uses, and answers its id. */
async function feed(): Promise<string> {
	let id = `feed_${crypto.randomUUID()}`;
	unwrap(
		await models.feeds.create({
			id,
			feed_url: `https://${crypto.randomUUID()}.example.com/feed.xml`,
			title: "Untitled",
		}),
	);
	return id;
}

describe("a feed's catalog row", () => {
	test("is renamed, stamped, retired and revived in place", async () => {
		let id = await feed();

		expect(await models.feeds.rename(id, "Example")).toBe(true);
		expect(await models.feeds.stamp(id, NOW + 1)).toBe(true);
		expect(await models.feeds.retire(id, NOW + 2)).toBe(true);
		expect(await models.feeds.findBy({ id })).toMatchObject({
			title: "Example",
			last_active_at: NOW + 1,
			retired_at: NOW + 2,
		});

		expect(await models.feeds.revive(id)).toBe(true);
		expect(await models.feeds.findBy({ id })).toMatchObject({ retired_at: null });
	});

	test("reports every write against a purged feed as not landed", async () => {
		let id = await feed();

		expect(await models.feeds.purge(id)).toBe(true);
		expect(await models.feeds.purge(id)).toBe(false);
		expect(await models.feeds.stamp(id, NOW)).toBe(false);
		expect(await models.feeds.rename(id, "Gone")).toBe(false);
		expect(await models.feeds.retire(id, NOW)).toBe(false);
		expect(await models.feeds.revive(id)).toBe(false);
	});
});

describe("billing customers", () => {
	test("are found by subject and by the platform's id, within one connection", async () => {
		let subject = crypto.randomUUID();
		unwrap(
			await models.billingCustomers.create({
				subject,
				connection: "polar",
				provider_customer_id: `cus_${subject}`,
			}),
		);

		expect(await models.billingCustomers.forSubject(subject, "polar")).toMatchObject({
			provider_customer_id: `cus_${subject}`,
		});
		expect(await models.billingCustomers.forSubject(subject, "stripe")).toBeNull();
		expect(await models.billingCustomers.forProviderId("polar", `cus_${subject}`)).toMatchObject({
			subject,
		});
	});

	test("page one connection in subject order, resuming after the last subject", async () => {
		let connection = `conn_${crypto.randomUUID()}`;
		for (let subject of ["c", "a", "b"]) {
			unwrap(
				await models.billingCustomers.create({
					subject,
					connection,
					provider_customer_id: `cus_${subject}`,
				}),
			);
		}

		let first = await models.billingCustomers.page(connection, 2, null);
		expect(first.map((row) => row.subject)).toEqual(["a", "b"]);

		let rest = await models.billingCustomers.page(connection, 2, "b");
		expect(rest.map((row) => row.subject)).toEqual(["c"]);
	});
});

describe("billing deliveries", () => {
	test("are marked processed, which a missing one shrugs off", async () => {
		let id = crypto.randomUUID();
		unwrap(
			await models.billingDeliveries.create({
				id,
				type: "order.paid",
				payload: "{}",
				valid: true,
				processed: false,
				received_at: NOW,
			}),
		);

		await models.billingDeliveries.markProcessed(id);
		await models.billingDeliveries.markProcessed(crypto.randomUUID());

		let row = await models.billingDeliveries.findBy({ id });
		expect(row?.processed === true || Number(row?.processed) === 1).toBe(true);
	});
});
