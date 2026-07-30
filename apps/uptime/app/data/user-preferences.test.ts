/**
 * Unit tests for the `UserPreferences` data-access model: the not-yet-set lookup
 * branch, and `setLanguage`'s create-then-update-in-place behavior for the same
 * subject.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import UserPreferences from "~/app/data/user-preferences";
import { createTestDatabase } from "~/app/lib/test/db";

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
});
