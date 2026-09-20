/**
 * Exercises `checkAndSpendMailEnvelope` directly against a `Database` over a real
 * SQLite-backed `SqlStorage`, the way `sessions.test.ts` drives its own leaf module:
 * the hourly and daily caps each reset on their own fixed window, and the envelope is
 * the same counter regardless of which caller's address happens to match.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { checkAndSpendMailEnvelope } from "./mail-rate-limit";
import mailRateLimitMigration from "./tenant-migrations/0011-mail-rate-limit.sql?raw";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const START = 1_700_000_000_000;

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await driver.executeScript(mailRateLimitMigration);
	db = new Database(driver);

	vi.useFakeTimers();
	vi.setSystemTime(START);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("checkAndSpendMailEnvelope", () => {
	test("allows up to the hourly cap, then refuses further spends", async () => {
		for (let i = 0; i < 5; i++) {
			expect(await checkAndSpendMailEnvelope(db, { address: "jane@example.com" })).toEqual({
				ok: true,
			});
		}

		let refused = await checkAndSpendMailEnvelope(db, { address: "jane@example.com" });

		expect(refused).toEqual({ ok: false, retryAfterSeconds: expect.any(Number) });
		if (refused.ok) throw new Error("unreachable");
		expect(refused.retryAfterSeconds).toBeGreaterThan(0);
		expect(refused.retryAfterSeconds).toBeLessThanOrEqual(HOUR_MS / 1000);
	});

	test("has room again once the hourly window has fully elapsed", async () => {
		for (let i = 0; i < 5; i++) {
			await checkAndSpendMailEnvelope(db, { address: "jane@example.com" });
		}

		vi.setSystemTime(START + HOUR_MS - 1);
		expect(await checkAndSpendMailEnvelope(db, { address: "jane@example.com" })).toEqual({
			ok: false,
			retryAfterSeconds: expect.any(Number),
		});

		vi.setSystemTime(START + HOUR_MS);
		expect(await checkAndSpendMailEnvelope(db, { address: "jane@example.com" })).toEqual({
			ok: true,
		});
	});

	test("refuses past the daily cap even once separate hourly windows have room", async () => {
		// Three sends an hour, six hours apart, stays under every hourly cap while
		// climbing toward the daily one.
		for (let hour = 0; hour < 5; hour++) {
			vi.setSystemTime(START + hour * HOUR_MS);
			for (let i = 0; i < 3; i++) {
				expect(await checkAndSpendMailEnvelope(db, { address: "jane@example.com" })).toEqual({
					ok: true,
				});
			}
		}

		// 15 spent; the 16th refuses on the daily cap alone.
		vi.setSystemTime(START + 5 * HOUR_MS);
		let refused = await checkAndSpendMailEnvelope(db, { address: "jane@example.com" });
		expect(refused).toEqual({ ok: false, retryAfterSeconds: expect.any(Number) });
	});

	test("has room again once the daily window has fully elapsed", async () => {
		for (let hour = 0; hour < 5; hour++) {
			vi.setSystemTime(START + hour * HOUR_MS);
			for (let i = 0; i < 3; i++) {
				await checkAndSpendMailEnvelope(db, { address: "jane@example.com" });
			}
		}

		vi.setSystemTime(START + DAY_MS - 1);
		expect(await checkAndSpendMailEnvelope(db, { address: "jane@example.com" })).toEqual({
			ok: false,
			retryAfterSeconds: expect.any(Number),
		});

		vi.setSystemTime(START + DAY_MS);
		expect(await checkAndSpendMailEnvelope(db, { address: "jane@example.com" })).toEqual({
			ok: true,
		});
	});

	test("tracks every address's envelope independently", async () => {
		for (let i = 0; i < 5; i++) {
			await checkAndSpendMailEnvelope(db, { address: "jane@example.com" });
		}

		expect(await checkAndSpendMailEnvelope(db, { address: "jane@example.com" })).toEqual({
			ok: false,
			retryAfterSeconds: expect.any(Number),
		});
		expect(await checkAndSpendMailEnvelope(db, { address: "john@example.com" })).toEqual({
			ok: true,
		});
	});
});
