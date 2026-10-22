/**
 * Tests for the notes model on a migrated in-memory database: a note's slug is its publish
 * instant in base-36 seconds, and a second note in the same second, deleted or not, takes the
 * same slug with a digit appended so every note keeps a permalink of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { noteSlugAt } from "~/app/models/notes";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

/** A publish instant every test schedules its notes at. */
const AT = "2026-10-12T12:00:00.000Z";

describe("noteSlugAt", () => {
	test("is the epoch seconds in base 36, six characters until 2038", () => {
		expect(noteSlugAt(Date.parse(AT))).toBe(Math.floor(Date.parse(AT) / 1000).toString(36));
		expect(noteSlugAt(Date.parse(AT))).toHaveLength(6);
		expect(noteSlugAt(Date.parse("2040-01-01T00:00:00.000Z"))).toHaveLength(7);
	});
});

describe("notes.nextSlug", () => {
	test("appends a digit for each note already holding the second, deleted ones included", async () => {
		let db = await testDatabase();
		let authorId = await seedAuthor(db);
		let notes = bindModels(db).notes;
		let base = noteSlugAt(Date.parse(AT));

		expect(await notes.nextSlug(AT)).toBe(base);
		unwrap(
			await notes.create({
				author_id: authorId,
				published_at: AT,
				meta: { slug: base, content: "a" },
			}),
		);
		expect(await notes.nextSlug(AT)).toBe(`${base}1`);

		let second = unwrap(
			await notes.create({
				author_id: authorId,
				published_at: AT,
				meta: { slug: `${base}1`, content: "b" },
			}),
		);
		await notes.tombstone(second?.id ?? "");
		expect(await notes.nextSlug(AT)).toBe(`${base}2`);
	});

	test("reads a note published on save at the current second", async () => {
		let db = await testDatabase();
		let before = noteSlugAt(Date.now());
		let slug = await bindModels(db).notes.nextSlug(null);
		expect([before, noteSlugAt(Date.now())]).toContain(slug);
	});
});
