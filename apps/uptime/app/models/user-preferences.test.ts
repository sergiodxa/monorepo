/**
 * Unit tests for the user preferences model: the not-yet-set lookup
 * branch, and `setLanguage`'s create-then-update-in-place behavior for the subject.
 *
 * The email opt-out is the part worth the most cases, because every uncertain state has to read
 * as "send it" — no row, no list, a list that names something else, a list holding a string this
 * app no longer sends — and only a stored refusal naming the email may stop it. A `wants` that
 * defaulted the other way would still pass a test that only checked the refusal.
 *
 * The two writers share one upsert keyed on the subject, so each is tested for touching only its
 * own field on that shared row, so a save cannot silently reset the other setting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { wantsEmail } from "~/app/models/user-preferences";
import { userPreferences } from "~/database/schema";

/**
 * Stores an `unsubscribed_emails` list the schema's type no longer admits, which is the only
 * way to seed the row a retired email leaves behind. Written as raw JSON on purpose: the point
 * of the case is a value the current `OptionalEmail` union cannot produce.
 */
async function storeRawUnsubscribed(db: Database, subjectId: string, json: string) {
	unwrap(
		await bindModels(db, recordJobs().jobs).userPreferences.setUnsubscribedEmails(subjectId, []),
	);
	await db.exec("UPDATE user_preferences SET unsubscribed_emails = ? WHERE subject_id = ?", [
		json,
		subjectId,
	]);
}

/** Models over a fresh database, with the database itself for counting rows. */
function setup() {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db, recordJobs().jobs) };
}

describe("userPreferences.findBy", () => {
	test("returns null when the subject has never set any preferences", async () => {
		let { models } = setup();
		expect(await models.userPreferences.findBy({ subject_id: crypto.randomUUID() })).toBeNull();
	});

	test("finds a subject's preferences row once one exists", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		unwrap(await models.userPreferences.setLanguage(subjectId, "es"));

		expect(
			(await models.userPreferences.findBy({ subject_id: subjectId }))?.preferred_language,
		).toBe("es");
	});

	test("never returns a different subject's preferences", async () => {
		let { models } = setup();
		unwrap(await models.userPreferences.setLanguage(crypto.randomUUID(), "es"));

		expect(await models.userPreferences.findBy({ subject_id: crypto.randomUUID() })).toBeNull();
	});
});

describe("userPreferences.setLanguage", () => {
	test("creates a preferences row on first use", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();

		let row = unwrap(await models.userPreferences.setLanguage(subjectId, "fr"));

		expect(row.subject_id).toBe(subjectId);
		expect(row.preferred_language).toBe("fr");
	});

	test("updates the existing row in place on a second call, instead of creating another", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let first = unwrap(await models.userPreferences.setLanguage(subjectId, "fr"));

		let second = unwrap(await models.userPreferences.setLanguage(subjectId, "de"));

		expect(second.id).toBe(first.id);
		expect(second.preferred_language).toBe("de");
		expect(
			(await models.userPreferences.findBy({ subject_id: subjectId }))?.preferred_language,
		).toBe("de");
	});

	test("clears the language back to null", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		unwrap(await models.userPreferences.setLanguage(subjectId, "ja"));

		let cleared = unwrap(await models.userPreferences.setLanguage(subjectId, null));

		expect(cleared.preferred_language).toBeNull();
	});

	test("leaves a stored opt-out alone", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		unwrap(await models.userPreferences.setUnsubscribedEmails(subjectId, ["teamWeeklyDigest"]));

		let row = unwrap(await models.userPreferences.setLanguage(subjectId, "es"));

		expect(row.unsubscribed_emails).toEqual(["teamWeeklyDigest"]);
	});
});

describe("wantsEmail", () => {
	test("sends every optional email to a subject with no preferences row", () => {
		expect(wantsEmail(null, "teamDailyDigest")).toBe(true);
		expect(wantsEmail(null, "teamWeeklyDigest")).toBe(true);
	});

	/** A row exists for the language alone far more often than for an opt-out. */
	test("sends every optional email to a subject whose row has no list", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let row = unwrap(await models.userPreferences.setLanguage(subjectId, "es"));

		expect(row.unsubscribed_emails).toBeNull();
		expect(wantsEmail(row, "teamDailyDigest")).toBe(true);
	});

	test("sends every optional email to a subject who has turned nothing off", async () => {
		let { models } = setup();
		let row = unwrap(await models.userPreferences.setUnsubscribedEmails(crypto.randomUUID(), []));

		expect(wantsEmail(row, "teamDailyDigest")).toBe(true);
		expect(wantsEmail(row, "teamWeeklyDigest")).toBe(true);
	});

	test("stops only the email the stored list names", async () => {
		let { models } = setup();
		let row = unwrap(
			await models.userPreferences.setUnsubscribedEmails(crypto.randomUUID(), ["teamDailyDigest"]),
		);

		expect(wantsEmail(row, "teamDailyDigest")).toBe(false);
		expect(wantsEmail(row, "teamWeeklyDigest")).toBe(true);
	});

	test("stops both when both are named", async () => {
		let { models } = setup();
		let row = unwrap(
			await models.userPreferences.setUnsubscribedEmails(crypto.randomUUID(), [
				"teamDailyDigest",
				"teamWeeklyDigest",
			]),
		);

		expect(wantsEmail(row, "teamDailyDigest")).toBe(false);
		expect(wantsEmail(row, "teamWeeklyDigest")).toBe(false);
	});

	/**
	 * What makes retiring an email safe. A list is stored, so it cannot be ignored wholesale, and
	 * the string in it names nothing this app sends — which must not be read as a refusal of the
	 * emails it does.
	 */
	test("a retired email left in the stored list mutes nothing that is still sent", async () => {
		let { db, models } = setup();
		let subjectId = crypto.randomUUID();
		await storeRawUnsubscribed(db, subjectId, '["teamMonthlyRecap"]');

		let row = await models.userPreferences.findBy({ subject_id: subjectId });

		expect(row?.unsubscribed_emails?.map(String)).toEqual(["teamMonthlyRecap"]);
		expect(wantsEmail(row, "teamDailyDigest")).toBe(true);
		expect(wantsEmail(row, "teamWeeklyDigest")).toBe(true);
	});

	test("still honours a live refusal stored beside a retired one", async () => {
		let { db, models } = setup();
		let subjectId = crypto.randomUUID();
		await storeRawUnsubscribed(db, subjectId, '["teamMonthlyRecap","teamDailyDigest"]');

		let row = await models.userPreferences.findBy({ subject_id: subjectId });

		expect(wantsEmail(row, "teamDailyDigest")).toBe(false);
		expect(wantsEmail(row, "teamWeeklyDigest")).toBe(true);
	});
});

describe("userPreferences.setUnsubscribedEmails", () => {
	test("creates a preferences row for a subject who has none", async () => {
		let { db, models } = setup();
		let subjectId = crypto.randomUUID();

		let row = unwrap(
			await models.userPreferences.setUnsubscribedEmails(subjectId, ["teamDailyDigest"]),
		);

		expect(row.subject_id).toBe(subjectId);
		expect(row.unsubscribed_emails).toEqual(["teamDailyDigest"]);
		expect(await db.count(userPreferences)).toBe(1);
	});

	/**
	 * The form posts the whole list, so a second save replaces it entirely — only
	 * full replacement lets an unchecked switch turn an email back on.
	 */
	test("replaces the whole stored list instead of adding to it", async () => {
		let { db, models } = setup();
		let subjectId = crypto.randomUUID();
		let first = unwrap(
			await models.userPreferences.setUnsubscribedEmails(subjectId, ["teamDailyDigest"]),
		);

		let second = unwrap(
			await models.userPreferences.setUnsubscribedEmails(subjectId, ["teamWeeklyDigest"]),
		);

		expect(second.id).toBe(first.id);
		expect(second.unsubscribed_emails).toEqual(["teamWeeklyDigest"]);
		expect(await db.count(userPreferences)).toBe(1);
	});

	test("re-subscribes to everything when the list comes back empty", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		unwrap(
			await models.userPreferences.setUnsubscribedEmails(subjectId, [
				"teamDailyDigest",
				"teamWeeklyDigest",
			]),
		);

		let cleared = unwrap(await models.userPreferences.setUnsubscribedEmails(subjectId, []));

		expect(cleared.unsubscribed_emails).toEqual([]);
		expect(wantsEmail(cleared, "teamDailyDigest")).toBe(true);
	});

	/** The two settings live on one row and are saved by two different forms. */
	test("never clobbers a language chosen earlier", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		unwrap(await models.userPreferences.setLanguage(subjectId, "ja"));

		let row = unwrap(
			await models.userPreferences.setUnsubscribedEmails(subjectId, ["teamWeeklyDigest"]),
		);

		expect(row.preferred_language).toBe("ja");
		expect(
			(await models.userPreferences.findBy({ subject_id: subjectId }))?.preferred_language,
		).toBe("ja");
	});

	test("stores the opt-out against one subject only", async () => {
		let { models } = setup();
		let optedOut = crypto.randomUUID();
		let other = crypto.randomUUID();
		unwrap(await models.userPreferences.setLanguage(other, "es"));

		unwrap(await models.userPreferences.setUnsubscribedEmails(optedOut, ["teamDailyDigest"]));

		expect(
			(await models.userPreferences.findBy({ subject_id: other }))?.unsubscribed_emails,
		).toBeNull();
	});
});

describe("userPreferences.findBySubjectIds", () => {
	test("returns an empty map for an empty list, without a query", async () => {
		let { models } = setup();

		expect((await models.userPreferences.findBySubjectIds([])).size).toBe(0);
	});

	test("keys each subject's row by their subject id", async () => {
		let { models } = setup();
		let one = crypto.randomUUID();
		let two = crypto.randomUUID();
		unwrap(await models.userPreferences.setLanguage(one, "es"));
		unwrap(await models.userPreferences.setUnsubscribedEmails(two, ["teamDailyDigest"]));

		let found = await models.userPreferences.findBySubjectIds([one, two]);

		expect(found.size).toBe(2);
		expect(found.get(one)?.preferred_language).toBe("es");
		expect(found.get(two)?.unsubscribed_emails).toEqual(["teamDailyDigest"]);
	});

	/**
	 * Most members of most teams have no row at all, and the absence is what the caller reads as
	 * "the defaults" — a mapped placeholder would move that decision in here.
	 */
	test("leaves out a subject who has never set any preferences", async () => {
		let { models } = setup();
		let known = crypto.randomUUID();
		let unknown = crypto.randomUUID();
		unwrap(await models.userPreferences.setLanguage(known, "fr"));

		let found = await models.userPreferences.findBySubjectIds([known, unknown]);

		expect([...found.keys()]).toEqual([known]);
		expect(found.has(unknown)).toBe(false);
		expect(found.get(unknown) ?? null).toBeNull();
	});

	test("returns an empty map when none of the subjects has a row", async () => {
		let { models } = setup();
		unwrap(await models.userPreferences.setLanguage(crypto.randomUUID(), "es"));

		expect(
			(await models.userPreferences.findBySubjectIds([crypto.randomUUID(), crypto.randomUUID()]))
				.size,
		).toBe(0);
	});

	/** One person in three teams appears three times in the due list. */
	test("asks once for a subject listed several times", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		unwrap(await models.userPreferences.setUnsubscribedEmails(subjectId, ["teamWeeklyDigest"]));

		let found = await models.userPreferences.findBySubjectIds([subjectId, subjectId, subjectId]);

		expect(found.size).toBe(1);
		expect(found.get(subjectId)?.unsubscribed_emails).toEqual(["teamWeeklyDigest"]);
	});

	/** The pairing the digest job uses: one lookup, then the predicate per recipient. */
	test("feeds wants for a subject with a row and for one without", async () => {
		let { models } = setup();
		let optedOut = crypto.randomUUID();
		let never = crypto.randomUUID();
		unwrap(await models.userPreferences.setUnsubscribedEmails(optedOut, ["teamDailyDigest"]));

		let found = await models.userPreferences.findBySubjectIds([optedOut, never]);

		expect(wantsEmail(found.get(optedOut) ?? null, "teamDailyDigest")).toBe(false);
		expect(wantsEmail(found.get(never) ?? null, "teamDailyDigest")).toBe(true);
	});
});
