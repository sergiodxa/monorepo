/**
 * Unit tests for the `UserPreferences` data-access model: the not-yet-set lookup
 * branch, and `setLanguage`'s create-then-update-in-place behavior for the same
 * subject.
 *
 * The email opt-out is the part worth the most cases, because every uncertain state has to read
 * as "send it" — no row, no list, a list that names something else, a list holding a string this
 * app no longer sends — and only a stored refusal naming the email may stop it. A `wants` that
 * defaulted the other way would still pass a test that only checked the refusal.
 *
 * The two writers share one private upsert, so each is tested for both of its branches and for
 * leaving the other's field alone: they are the two independent settings on one row, and a write
 * that replaced the row rather than the field would silently reset a language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import UserPreferences from "~/app/data/user-preferences";
import { createTestDatabase } from "~/app/lib/test/db";
import { userPreferences } from "~/database/schema";

/**
 * Stores an `unsubscribed_emails` list the schema's type no longer admits, which is the only
 * way to seed the row a retired email leaves behind. Written as raw JSON on purpose: the point
 * of the case is a value the current `OptionalEmail` union cannot produce.
 */
async function storeRawUnsubscribed(db: Database, subjectId: string, json: string) {
	await UserPreferences.setUnsubscribedEmails(db, subjectId, []);
	await db.exec("UPDATE user_preferences SET unsubscribed_emails = ? WHERE subject_id = ?", [
		json,
		subjectId,
	]);
}

describe("UserPreferences.findBySubjectId", () => {
	test("returns null when the subject has never set any preferences", async () => {
		let { db } = createTestDatabase();
		expect(await UserPreferences.findBySubjectId(db, crypto.randomUUID())).toBeNull();
	});

	test("finds a subject's preferences row once one exists", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await UserPreferences.setLanguage(db, subjectId, "es");

		expect((await UserPreferences.findBySubjectId(db, subjectId))?.preferred_language).toBe("es");
	});

	test("never returns a different subject's preferences", async () => {
		let { db } = createTestDatabase();
		await UserPreferences.setLanguage(db, crypto.randomUUID(), "es");

		expect(await UserPreferences.findBySubjectId(db, crypto.randomUUID())).toBeNull();
	});
});

describe("UserPreferences.setLanguage", () => {
	test("creates a preferences row on first use", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();

		let row = await UserPreferences.setLanguage(db, subjectId, "fr");

		expect(row.subject_id).toBe(subjectId);
		expect(row.preferred_language).toBe("fr");
	});

	test("updates the existing row in place on a second call, instead of creating another", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let first = await UserPreferences.setLanguage(db, subjectId, "fr");

		let second = await UserPreferences.setLanguage(db, subjectId, "de");

		expect(second.id).toBe(first.id);
		expect(second.preferred_language).toBe("de");
		expect((await UserPreferences.findBySubjectId(db, subjectId))?.preferred_language).toBe("de");
	});

	test("clears the language back to null", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await UserPreferences.setLanguage(db, subjectId, "ja");

		let cleared = await UserPreferences.setLanguage(db, subjectId, null);

		expect(cleared.preferred_language).toBeNull();
	});

	test("leaves a stored opt-out alone", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await UserPreferences.setUnsubscribedEmails(db, subjectId, ["teamWeeklyDigest"]);

		let row = await UserPreferences.setLanguage(db, subjectId, "es");

		expect(row.unsubscribed_emails).toEqual(["teamWeeklyDigest"]);
	});
});

describe("UserPreferences.wants", () => {
	test("sends every optional email to a subject with no preferences row", () => {
		expect(UserPreferences.wants(null, "teamDailyDigest")).toBeTrue();
		expect(UserPreferences.wants(null, "teamWeeklyDigest")).toBeTrue();
	});

	/** A row exists for the language alone far more often than for an opt-out. */
	test("sends every optional email to a subject whose row has no list", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let row = await UserPreferences.setLanguage(db, subjectId, "es");

		expect(row.unsubscribed_emails).toBeNull();
		expect(UserPreferences.wants(row, "teamDailyDigest")).toBeTrue();
	});

	test("sends every optional email to a subject who has turned nothing off", async () => {
		let { db } = createTestDatabase();
		let row = await UserPreferences.setUnsubscribedEmails(db, crypto.randomUUID(), []);

		expect(UserPreferences.wants(row, "teamDailyDigest")).toBeTrue();
		expect(UserPreferences.wants(row, "teamWeeklyDigest")).toBeTrue();
	});

	test("stops only the email the stored list names", async () => {
		let { db } = createTestDatabase();
		let row = await UserPreferences.setUnsubscribedEmails(db, crypto.randomUUID(), [
			"teamDailyDigest",
		]);

		expect(UserPreferences.wants(row, "teamDailyDigest")).toBeFalse();
		expect(UserPreferences.wants(row, "teamWeeklyDigest")).toBeTrue();
	});

	test("stops both when both are named", async () => {
		let { db } = createTestDatabase();
		let row = await UserPreferences.setUnsubscribedEmails(db, crypto.randomUUID(), [
			"teamDailyDigest",
			"teamWeeklyDigest",
		]);

		expect(UserPreferences.wants(row, "teamDailyDigest")).toBeFalse();
		expect(UserPreferences.wants(row, "teamWeeklyDigest")).toBeFalse();
	});

	/**
	 * What makes retiring an email safe. A list is stored, so it cannot be ignored wholesale, and
	 * the string in it names nothing this app sends — which must not be read as a refusal of the
	 * emails it does.
	 */
	test("a retired email left in the stored list mutes nothing that is still sent", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await storeRawUnsubscribed(db, subjectId, '["teamMonthlyRecap"]');

		let row = await UserPreferences.findBySubjectId(db, subjectId);

		expect(row?.unsubscribed_emails?.map(String)).toEqual(["teamMonthlyRecap"]);
		expect(UserPreferences.wants(row, "teamDailyDigest")).toBeTrue();
		expect(UserPreferences.wants(row, "teamWeeklyDigest")).toBeTrue();
	});

	test("still honours a live refusal stored beside a retired one", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await storeRawUnsubscribed(db, subjectId, '["teamMonthlyRecap","teamDailyDigest"]');

		let row = await UserPreferences.findBySubjectId(db, subjectId);

		expect(UserPreferences.wants(row, "teamDailyDigest")).toBeFalse();
		expect(UserPreferences.wants(row, "teamWeeklyDigest")).toBeTrue();
	});
});

describe("UserPreferences.setUnsubscribedEmails", () => {
	test("creates a preferences row for a subject who has none", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();

		let row = await UserPreferences.setUnsubscribedEmails(db, subjectId, ["teamDailyDigest"]);

		expect(row.subject_id).toBe(subjectId);
		expect(row.unsubscribed_emails).toEqual(["teamDailyDigest"]);
		expect(await db.count(userPreferences)).toBe(1);
	});

	/**
	 * The form posts the whole list, so a second save has to replace it rather than merge into
	 * it: merging would make an unchecked switch unable to turn an email back on.
	 */
	test("replaces the whole stored list instead of adding to it", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		let first = await UserPreferences.setUnsubscribedEmails(db, subjectId, ["teamDailyDigest"]);

		let second = await UserPreferences.setUnsubscribedEmails(db, subjectId, ["teamWeeklyDigest"]);

		expect(second.id).toBe(first.id);
		expect(second.unsubscribed_emails).toEqual(["teamWeeklyDigest"]);
		expect(await db.count(userPreferences)).toBe(1);
	});

	test("re-subscribes to everything when the list comes back empty", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await UserPreferences.setUnsubscribedEmails(db, subjectId, [
			"teamDailyDigest",
			"teamWeeklyDigest",
		]);

		let cleared = await UserPreferences.setUnsubscribedEmails(db, subjectId, []);

		expect(cleared.unsubscribed_emails).toEqual([]);
		expect(UserPreferences.wants(cleared, "teamDailyDigest")).toBeTrue();
	});

	/** The two settings live on one row and are saved by two different forms. */
	test("never clobbers a language chosen earlier", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await UserPreferences.setLanguage(db, subjectId, "ja");

		let row = await UserPreferences.setUnsubscribedEmails(db, subjectId, ["teamWeeklyDigest"]);

		expect(row.preferred_language).toBe("ja");
		expect((await UserPreferences.findBySubjectId(db, subjectId))?.preferred_language).toBe("ja");
	});

	test("stores the opt-out against one subject only", async () => {
		let { db } = createTestDatabase();
		let optedOut = crypto.randomUUID();
		let other = crypto.randomUUID();
		await UserPreferences.setLanguage(db, other, "es");

		await UserPreferences.setUnsubscribedEmails(db, optedOut, ["teamDailyDigest"]);

		expect((await UserPreferences.findBySubjectId(db, other))?.unsubscribed_emails).toBeNull();
	});
});

describe("UserPreferences.findBySubjectIds", () => {
	test("returns an empty map for an empty list, without a query", async () => {
		let { db } = createTestDatabase();

		expect(await UserPreferences.findBySubjectIds(db, [])).toBeEmpty();
	});

	test("keys each subject's row by their subject id", async () => {
		let { db } = createTestDatabase();
		let one = crypto.randomUUID();
		let two = crypto.randomUUID();
		await UserPreferences.setLanguage(db, one, "es");
		await UserPreferences.setUnsubscribedEmails(db, two, ["teamDailyDigest"]);

		let found = await UserPreferences.findBySubjectIds(db, [one, two]);

		expect(found.size).toBe(2);
		expect(found.get(one)?.preferred_language).toBe("es");
		expect(found.get(two)?.unsubscribed_emails).toEqual(["teamDailyDigest"]);
	});

	/**
	 * Most members of most teams have no row at all, and the absence is what the caller reads as
	 * "the defaults" — a mapped placeholder would move that decision in here.
	 */
	test("leaves out a subject who has never set any preferences", async () => {
		let { db } = createTestDatabase();
		let known = crypto.randomUUID();
		let unknown = crypto.randomUUID();
		await UserPreferences.setLanguage(db, known, "fr");

		let found = await UserPreferences.findBySubjectIds(db, [known, unknown]);

		expect([...found.keys()]).toEqual([known]);
		expect(found.has(unknown)).toBeFalse();
		expect(found.get(unknown) ?? null).toBeNull();
	});

	test("returns an empty map when none of the subjects has a row", async () => {
		let { db } = createTestDatabase();
		await UserPreferences.setLanguage(db, crypto.randomUUID(), "es");

		expect(
			await UserPreferences.findBySubjectIds(db, [crypto.randomUUID(), crypto.randomUUID()]),
		).toBeEmpty();
	});

	/** One person in three teams appears three times in the due list. */
	test("asks once for a subject listed several times", async () => {
		let { db } = createTestDatabase();
		let subjectId = crypto.randomUUID();
		await UserPreferences.setUnsubscribedEmails(db, subjectId, ["teamWeeklyDigest"]);

		let found = await UserPreferences.findBySubjectIds(db, [subjectId, subjectId, subjectId]);

		expect(found.size).toBe(1);
		expect(found.get(subjectId)?.unsubscribed_emails).toEqual(["teamWeeklyDigest"]);
	});

	/** The pairing the digest job uses: one lookup, then the predicate per recipient. */
	test("feeds wants for a subject with a row and for one without", async () => {
		let { db } = createTestDatabase();
		let optedOut = crypto.randomUUID();
		let never = crypto.randomUUID();
		await UserPreferences.setUnsubscribedEmails(db, optedOut, ["teamDailyDigest"]);

		let found = await UserPreferences.findBySubjectIds(db, [optedOut, never]);

		expect(UserPreferences.wants(found.get(optedOut) ?? null, "teamDailyDigest")).toBeFalse();
		expect(UserPreferences.wants(found.get(never) ?? null, "teamDailyDigest")).toBeTrue();
	});
});
