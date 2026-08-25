/**
 * Unit tests for the `TrialConversion` data-access model: the once-only snapshot
 * written when a lead becomes an account, and the once-only stamp written when that
 * account starts paying. Both run repeatedly with the same subject in production —
 * conversion on every sign-in, entitlement on every renewal — so what is pinned here
 * is that a second call leaves the row exactly as the first one wrote it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { TrialSignup } from "~/app/data/trial-conversion";

import TrialConversion, { trialConversionUrls } from "~/app/data/trial-conversion";
import { createTestDatabase } from "~/app/lib/test/db";
import { trialConversions } from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OWNER_ID = "subject-1";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** A signup snapshot, with any field overridable per test. */
async function record(overrides: Partial<TrialSignup> = {}) {
	return await TrialConversion.recordSignup(db, {
		ownerId: OWNER_ID,
		leadCreatedAt: Date.now() - 5 * MS_PER_DAY,
		emailsSent: 4,
		urls: ["https://a.example"],
		watchCount: 1,
		signedUpAt: Date.now(),
		...overrides,
	});
}

describe("TrialConversion.recordSignup", () => {
	test("stores the snapshot the report is drawn from", async () => {
		let leadCreatedAt = Date.now() - 9 * MS_PER_DAY;
		let signedUpAt = Date.now();

		await record({
			leadCreatedAt,
			signedUpAt,
			emailsSent: 7,
			urls: ["https://a", "https://b"],
			watchCount: 3,
		});

		let row = await TrialConversion.findByOwner(db, OWNER_ID);
		expect(row?.lead_created_at).toBe(leadCreatedAt);
		expect(row?.signed_up_at).toBe(signedUpAt);
		expect(row?.emails_sent).toBe(7);
		expect(row?.watch_count).toBe(3);
		expect(row?.paid_at).toBeNull();
		expect(trialConversionUrls(row ?? { urls: "[]" })).toEqual(["https://a", "https://b"]);
	});

	test("stores no address, so unsubscribing still deletes every trace of the lead", async () => {
		await record();

		let row = await TrialConversion.findByOwner(db, OWNER_ID);
		expect(JSON.stringify(row)).not.toContain("@");
	});

	/**
	 * The rule the whole table depends on. Conversion runs on every sign-in, and every
	 * column here is a measurement taken at the first one, so the row keeps those values
	 * even once a converted lead's digests push the email count higher.
	 */
	test("a second sign-in changes nothing about the row the first one wrote", async () => {
		let firstSignUp = Date.now() - 3 * MS_PER_DAY;
		await record({ signedUpAt: firstSignUp, emailsSent: 2, watchCount: 1 });

		let createdAgain = await record({
			signedUpAt: Date.now(),
			emailsSent: 9,
			watchCount: 4,
			urls: ["https://a.example", "https://later.example"],
		});

		expect(createdAgain).toBe(false);
		let row = await TrialConversion.findByOwner(db, OWNER_ID);
		expect(row?.signed_up_at).toBe(firstSignUp);
		expect(row?.emails_sent).toBe(2);
		expect(row?.watch_count).toBe(1);
		expect(await db.findMany(trialConversions, {})).toHaveLength(1);
	});

	test("reports whether it was the call that created the row", async () => {
		expect(await record()).toBe(true);
		expect(await record()).toBe(false);
	});

	test("keeps one account's record apart from another's", async () => {
		await record();
		await record({ ownerId: "subject-2", emailsSent: 1 });

		expect((await TrialConversion.findByOwner(db, "subject-2"))?.emails_sent).toBe(1);
		expect(await db.findMany(trialConversions, {})).toHaveLength(2);
	});
});

describe("TrialConversion.markPaid", () => {
	test("stamps the first payment", async () => {
		await record();
		let paidAt = Date.now();

		expect(await TrialConversion.markPaid(db, OWNER_ID, paidAt)).toBe(true);
		expect((await TrialConversion.findByOwner(db, OWNER_ID))?.paid_at).toBe(paidAt);
	});

	/**
	 * Entitlement is re-asserted on every renewal and by the daily reconciliation sweep,
	 * so the stamp holds the first payment's instant — one that moved with them would
	 * report a conversion time that grew for as long as the customer stayed subscribed.
	 */
	test("a second entitlement event does not move the stamp", async () => {
		await record();
		let firstPayment = Date.now() - 30 * MS_PER_DAY;
		await TrialConversion.markPaid(db, OWNER_ID, firstPayment);

		let movedIt = await TrialConversion.markPaid(db, OWNER_ID, Date.now());

		expect(movedIt).toBe(false);
		expect((await TrialConversion.findByOwner(db, OWNER_ID))?.paid_at).toBe(firstPayment);
	});

	test("is a silent no-op for an account that never came through the trial", async () => {
		expect(await TrialConversion.markPaid(db, "stranger", Date.now())).toBe(false);
	});
});

describe("the report's two windows", () => {
	test("lists signups and payments by the date each one is asked about", async () => {
		let day = 24 * 60 * 60 * 1000;
		let base = Date.UTC(2026, 6, 1);

		await record({ ownerId: "early", signedUpAt: base });
		await record({ ownerId: "inside", signedUpAt: base + day });
		await record({ ownerId: "late", signedUpAt: base + 2 * day });
		await TrialConversion.markPaid(db, "early", base + day + 60_000);

		let signedUp = await TrialConversion.listSignedUpBetween(db, base + day, base + 2 * day);
		expect(signedUp.map((row) => row.owner_id)).toEqual(["inside"]);

		let paid = await TrialConversion.listPaidBetween(db, base + day, base + 2 * day);
		expect(paid.map((row) => row.owner_id)).toEqual(["early"]);
	});

	test("an unpaid account is never in the paid window, however wide it is", async () => {
		await record();

		expect(await TrialConversion.listPaidBetween(db, 0, Date.now() + 1)).toHaveLength(0);
	});
});

describe("trialConversionUrls", () => {
	test("reads the stored list back", () => {
		expect(trialConversionUrls({ urls: '["https://a","https://b"]' })).toEqual([
			"https://a",
			"https://b",
		]);
	});

	/** A report that threw on one malformed row would take the whole day's email down with it. */
	test("answers with nothing rather than throwing on a value it cannot read", () => {
		expect(trialConversionUrls({ urls: "not json" })).toHaveLength(0);
		expect(trialConversionUrls({ urls: '{"a":1}' })).toHaveLength(0);
		expect(trialConversionUrls({ urls: '["https://a", 7]' })).toEqual(["https://a"]);
	});
});
