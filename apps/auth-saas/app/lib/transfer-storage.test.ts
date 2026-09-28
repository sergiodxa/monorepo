/**
 * Proves the R2 round trip and the download ticket's mint/spend mechanism in
 * isolation from any job or route, since neither is wired into one yet.
 *
 * `writeTransferFile`/`readTransferFileLines` are proven against an in-memory
 * R2 bucket: several NDJSON lines written come back in order, and a
 * `startLine` skips the rows a previous tick already consumed, and each put
 * and get is metered as an R2 operation on the open cost ledger.
 * `mintTransferDownloadTicket`/`spendTransferDownloadTicket` are proven round
 * trip: a mint then a spend succeeds once, a second spend of the same ticket
 * fails, and an expired ticket fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createAnalyticsEngine, createR2Bucket } from "@sdxc/cloudflare-mocks";
import { gte } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { flush, runWithLedger } from "~/app/lib/cost-ledger";
import { COST_RESOURCES } from "~/app/lib/cost-rates";
import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import {
	mintTransferDownloadTicket,
	readTransferFileLines,
	spendTransferDownloadTicket,
	transferDownloadTickets,
	writeTransferFile,
} from "./transfer-storage";

/** Collects an async iterable of strings into an array, for equality assertions. */
async function collect(lines: AsyncIterable<string>): Promise<string[]> {
	let collected: string[] = [];
	for await (let line of lines) collected.push(line);
	return collected;
}

/**
 * Yields a fixed list of strings as an `AsyncIterable`, the shape a batching writer produces.
 *
 * @yields Each value of `values`, in order.
 */
async function* asyncLines(values: string[]): AsyncGenerator<string> {
	for (let value of values) yield value;
}

describe("writeTransferFile / readTransferFileLines", () => {
	test("reads back every written NDJSON line, in order", async () => {
		let bucket = createR2Bucket();
		let rows = ['{"id":1}', '{"id":2}', '{"id":3}'];

		await writeTransferFile(bucket, "exports/acme/subjects.ndjson", asyncLines(rows));

		let read = await collect(readTransferFileLines(bucket, "exports/acme/subjects.ndjson"));

		expect(read).toEqual(rows);
	});

	test("meters a write as an R2 Class A operation and a read as a Class B one", async () => {
		let bucket = createR2Bucket();
		let analytics = createAnalyticsEngine();

		await runWithLedger("tenant_1", "queue", async () => {
			await writeTransferFile(bucket, "exports/acme/subjects.ndjson", asyncLines(['{"id":1}']));
			await collect(readTransferFileLines(bucket, "exports/acme/subjects.ndjson"));
			flush({ ANALYTICS: analytics });
		});

		let encoded = analytics.dataPoints[0]?.blobs?.[3];
		if (typeof encoded !== "string") throw new Error("the ledger wrote no quantities");
		let quantities = encoded.split(",").map(Number);
		expect(quantities[COST_RESOURCES.indexOf("r2ClassAOperations")]).toBe(1);
		expect(quantities[COST_RESOURCES.indexOf("r2ClassBOperations")]).toBe(1);
	});

	test("skips the rows named by startLine", async () => {
		let bucket = createR2Bucket();
		let rows = ['{"id":1}', '{"id":2}', '{"id":3}', '{"id":4}'];

		await writeTransferFile(bucket, "imports/acme/directory.ndjson", asyncLines(rows));

		let read = await collect(
			readTransferFileLines(bucket, "imports/acme/directory.ndjson", { startLine: 2 }),
		);

		expect(read).toEqual(['{"id":3}', '{"id":4}']);
	});

	test("also accepts a pre-built ReadableStream", async () => {
		let bucket = createR2Bucket();
		let stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('{"id":1}\n{"id":2}\n'));
				controller.close();
			},
		});

		await writeTransferFile(bucket, "exports/acme/direct.ndjson", stream);

		let read = await collect(readTransferFileLines(bucket, "exports/acme/direct.ndjson"));

		expect(read).toEqual(['{"id":1}', '{"id":2}']);
	});

	test("reading a key that was never written fails", async () => {
		let bucket = createR2Bucket();

		await expect(collect(readTransferFileLines(bucket, "missing.ndjson"))).rejects.toThrow(
			/not found/,
		);
	});
});

describe("mintTransferDownloadTicket / spendTransferDownloadTicket", () => {
	let db: Database;
	let tenantId: string;

	beforeEach(async () => {
		db = await createTestDatabase();

		let customer = await Customer.create(db, { name: "Acme" });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme",
			slug: "acme",
			issuer: "https://acme.example.com",
		});
		tenantId = tenant.id;
	});

	test("a minted ticket spends once and hands back the object it named", async () => {
		let ticket = await mintTransferDownloadTicket(db, {
			r2Key: "exports/acme/subjects.ndjson",
			tenantId,
		});

		let spent = await spendTransferDownloadTicket(db, { ticket });

		expect(spent).toEqual({
			ok: true,
			r2Key: "exports/acme/subjects.ndjson",
			tenantId,
		});
	});

	test("a second spend of the same ticket fails", async () => {
		let ticket = await mintTransferDownloadTicket(db, {
			r2Key: "exports/acme/subjects.ndjson",
			tenantId,
		});

		await spendTransferDownloadTicket(db, { ticket });
		let replay = await spendTransferDownloadTicket(db, { ticket });

		expect(replay).toEqual({ ok: false, reason: "invalid-ticket" });
	});

	test("an expired ticket fails", async () => {
		let ticket = await mintTransferDownloadTicket(db, {
			r2Key: "exports/acme/subjects.ndjson",
			tenantId,
		});

		// Every row this table can hold expires on the same schedule, so backdating
		// the one row a fresh mint just wrote is the whole setup an expiry test needs.
		await db.updateMany(
			transferDownloadTickets,
			{ expires_at: Date.now() - 1 },
			{ where: gte("id", "") },
		);

		let spent = await spendTransferDownloadTicket(db, { ticket });

		expect(spent).toEqual({ ok: false, reason: "invalid-ticket" });
	});

	test("a tampered or unknown ticket fails", async () => {
		await mintTransferDownloadTicket(db, {
			r2Key: "exports/acme/subjects.ndjson",
			tenantId,
		});

		let spent = await spendTransferDownloadTicket(db, { ticket: "not-a-real-ticket" });

		expect(spent).toEqual({ ok: false, reason: "invalid-ticket" });
	});
});
