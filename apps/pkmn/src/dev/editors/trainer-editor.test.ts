/**
 * Verifies the {@link TrainerEditor} as pure logic: field setters (id, name,
 * sprite, quotes) mutate the snapshot; party mutations add/remove/reorder members
 * and enforce the {@link MAX_PARTY_SIZE} cap; per-member setters change species,
 * clamp levels, and clean/cap move lists (dropping the field when empty). The
 * editor is exercised without a DOM, and its snapshots are checked to satisfy the
 * trainer schema so the in-progress state can never drift past what exports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { isSuccess } from "@pkg/result";

import { MAX_PARTY_SIZE, parseTrainer } from "~/content/trainers";

import { TrainerEditor } from "./trainer-editor";

/** Builds an editor seeded with a valid, exportable single-member trainer. */
function seededEditor(): TrainerEditor {
	return new TrainerEditor({
		id: "rival-blue",
		name: "Blue",
		spriteId: null,
		quotes: { intro: "Let's battle!", win: "I win!", lose: "No way!" },
		party: [{ speciesId: "CHARMANDER", level: 5 }],
	});
}

describe("field setters", () => {
	test("setId/setName trim and update the snapshot", () => {
		let editor = new TrainerEditor();
		expect(editor.setId("  rival-blue  ").id).toBe("rival-blue");
		expect(editor.setName("  Blue  ").name).toBe("Blue");
	});

	test("setSpriteId sets and clears the sprite", () => {
		let editor = new TrainerEditor();
		expect(editor.setSpriteId("rival-front").spriteId).toBe("rival-front");
		expect(editor.setSpriteId(null).spriteId).toBeNull();
	});

	test("setQuote updates one quote and leaves the others", () => {
		let editor = seededEditor();
		let next = editor.setQuote("win", "Too easy!");
		expect(next.quotes.win).toBe("Too easy!");
		expect(next.quotes.intro).toBe("Let's battle!");
	});
});

describe("party mutations", () => {
	test("addMember appends a member seeded with the species and a default level", () => {
		let editor = new TrainerEditor();
		let next = editor.addMember("BULBASAUR");
		expect(next.party).toHaveLength(1);
		expect(next.party[0]!.speciesId).toBe("BULBASAUR");
		expect(next.party[0]!.level).toBeGreaterThanOrEqual(1);
	});

	test("addMember respects an explicit starting level", () => {
		let editor = new TrainerEditor();
		expect(editor.addMember("SQUIRTLE", 10).party[0]!.level).toBe(10);
	});

	test("addMember stops at the party cap", () => {
		let editor = new TrainerEditor();
		for (let i = 0; i < MAX_PARTY_SIZE + 3; i++) editor.addMember("RATTATA");
		expect(editor.partySize).toBe(MAX_PARTY_SIZE);
		expect(editor.canAddMember).toBe(false);
	});

	test("removeMember drops the member at the index", () => {
		let editor = new TrainerEditor();
		editor.addMember("BULBASAUR");
		editor.addMember("CHARMANDER");
		let next = editor.removeMember(0);
		expect(next.party).toHaveLength(1);
		expect(next.party[0]!.speciesId).toBe("CHARMANDER");
	});

	test("removeMember is a no-op for an out-of-range index", () => {
		let editor = new TrainerEditor();
		editor.addMember("BULBASAUR");
		expect(editor.removeMember(5).party).toHaveLength(1);
	});

	test("moveMemberUp/Down reorder the party", () => {
		let editor = new TrainerEditor();
		editor.addMember("BULBASAUR");
		editor.addMember("CHARMANDER");
		editor.addMember("SQUIRTLE");

		let up = editor.moveMemberUp(2);
		expect(up.party.map((m) => m.speciesId)).toEqual(["BULBASAUR", "SQUIRTLE", "CHARMANDER"]);

		let down = editor.moveMemberDown(0);
		expect(down.party.map((m) => m.speciesId)).toEqual(["SQUIRTLE", "BULBASAUR", "CHARMANDER"]);
	});

	test("moveMemberUp on the first member and moveMemberDown on the last are no-ops", () => {
		let editor = new TrainerEditor();
		editor.addMember("BULBASAUR");
		editor.addMember("CHARMANDER");
		expect(editor.moveMemberUp(0).party.map((m) => m.speciesId)).toEqual([
			"BULBASAUR",
			"CHARMANDER",
		]);
		expect(editor.moveMemberDown(1).party.map((m) => m.speciesId)).toEqual([
			"BULBASAUR",
			"CHARMANDER",
		]);
	});
});

describe("per-member setters", () => {
	test("setMemberSpecies changes the species", () => {
		let editor = seededEditor();
		expect(editor.setMemberSpecies(0, "VENUSAUR").party[0]!.speciesId).toBe("VENUSAUR");
	});

	test("setMemberLevel clamps below the minimum and truncates fractions", () => {
		let editor = seededEditor();
		expect(editor.setMemberLevel(0, 0).party[0]!.level).toBe(1);
		expect(editor.setMemberLevel(0, 7.9).party[0]!.level).toBe(7);
	});

	test("setMemberMoves keeps non-empty ids and caps at four", () => {
		let editor = seededEditor();
		let next = editor.setMemberMoves(0, ["TACKLE", "", "GROWL", "EMBER", "SLASH", "BITE"]);
		expect(next.party[0]!.moves).toEqual(["TACKLE", "GROWL", "EMBER", "SLASH"]);
	});

	test("setMemberMoves drops the moves field when the list is empty", () => {
		let editor = seededEditor();
		editor.setMemberMoves(0, ["TACKLE"]);
		let cleared = editor.setMemberMoves(0, ["", ""]);
		expect(cleared.party[0]!.moves).toBeUndefined();
	});
});

describe("snapshots stay valid and isolated", () => {
	test("a seeded editor's snapshot satisfies the trainer schema", () => {
		expect(isSuccess(parseTrainer(seededEditor().toDefinition()))).toBe(true);
	});

	test("mutating a returned snapshot does not affect the editor", () => {
		let editor = seededEditor();
		let snapshot = editor.toDefinition();
		snapshot.party[0]!.level = 99;
		snapshot.party.push({ speciesId: "MEWTWO", level: 70 });
		expect(editor.toDefinition().party).toHaveLength(1);
		expect(editor.toDefinition().party[0]!.level).toBe(5);
	});
});
