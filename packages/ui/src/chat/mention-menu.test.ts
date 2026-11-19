/**
 * Holds the mention rules to their contract: a mention opens only where its trigger starts a
 * word and the caret follows it, and matches list prefix hits before substring hits, ignoring
 * case, up to the limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { MentionPerson } from "./mention-menu.js";

import { mentionMatches, mentionQuery } from "./mention-menu.js";

const PEOPLE: MentionPerson[] = [
	{ id: "1", handle: "ana", name: "Ana Lima", initials: "AL" },
	{ id: "2", handle: "marco", name: "Marco Díaz", initials: "MD" },
	{ id: "3", handle: "jo", name: "Joanna Park", initials: "JP" },
	{ id: "4", handle: "dani", name: "Daniela Ruiz", initials: "DR" },
];

describe("mentionQuery", () => {
	test("reads the query after a trigger at the start of the text", () => {
		expect(mentionQuery("@an", 3)).toEqual({ start: 0, query: "an" });
	});

	test("reads an empty query right after the trigger", () => {
		expect(mentionQuery("hi @", 4)).toEqual({ start: 3, query: "" });
	});

	test("reads a trigger after a new line", () => {
		expect(mentionQuery("hi\n@jo", 6)).toEqual({ start: 3, query: "jo" });
	});

	test("ignores a trigger in the middle of a word, such as an email address", () => {
		expect(mentionQuery("me@host", 7)).toBeNull();
	});

	test("closes once a space follows the handle", () => {
		expect(mentionQuery("@ana ", 5)).toBeNull();
	});

	test("reads only up to the caret", () => {
		expect(mentionQuery("@marco", 3)).toEqual({ start: 0, query: "ma" });
	});

	test("reads handles with dots, dashes and letters in any script", () => {
		expect(mentionQuery("@jo.ña-1", 8)).toEqual({ start: 0, query: "jo.ña-1" });
	});

	test("finds nothing without a trigger", () => {
		expect(mentionQuery("hello", 5)).toBeNull();
		expect(mentionQuery("", 0)).toBeNull();
	});

	test("honors another trigger", () => {
		expect(mentionQuery("see #gen", 8, "#")).toEqual({ start: 4, query: "gen" });
		expect(mentionQuery("see @gen", 8, "#")).toBeNull();
	});
});

describe("mentionMatches", () => {
	test("an empty query lists people in order up to the limit", () => {
		expect(mentionMatches(PEOPLE, "", 2).map((person) => person.handle)).toEqual(["ana", "marco"]);
	});

	test("matches a handle or a word of the name by prefix, ignoring case", () => {
		expect(mentionMatches(PEOPLE, "MAR", 6).map((person) => person.handle)).toEqual(["marco"]);
		expect(mentionMatches(PEOPLE, "park", 6).map((person) => person.handle)).toEqual(["jo"]);
	});

	test("lists prefix matches before substring matches", () => {
		expect(mentionMatches(PEOPLE, "an", 6).map((person) => person.handle)).toEqual([
			"ana",
			"jo",
			"dani",
		]);
	});

	test("finds nobody for a query no one holds", () => {
		expect(mentionMatches(PEOPLE, "zz", 6)).toEqual([]);
	});
});
