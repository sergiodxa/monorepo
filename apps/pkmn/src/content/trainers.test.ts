/**
 * Verifies the trainer format's validation and loader: a well-formed definition
 * parses into a typed value, while an empty or oversized party, missing quotes,
 * blank ids, bad levels, and surplus moves each fail with a
 * {@link TrainerValidationError}. Unknown ids parse, so authored trainers stay
 * loadable as content shifts, and the shipped sample trainer is covered too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	MAX_MOVES_PER_MEMBER,
	MAX_PARTY_SIZE,
	parseTrainer,
	type TrainerDefinition,
	TrainerValidationError,
} from "./trainers";
import sampleTrainer from "./trainers/youngster-joey.json";

/** A minimal, valid definition tests clone and mutate to exercise one rule at a time. */
function validTrainer(): TrainerDefinition {
	return {
		id: "rival-blue",
		name: "Blue",
		spriteId: null,
		quotes: { intro: "Let's battle!", win: "I win!", lose: "No way!" },
		party: [{ speciesId: "CHARMANDER", level: 5, moves: ["SCRATCH", "GROWL"] }],
	};
}

describe("parseTrainer accepts valid definitions", () => {
	test("a fully-populated trainer parses", () => {
		let result = parseTrainer(validTrainer());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.id).toBe("rival-blue");
			expect(result.data.party).toHaveLength(1);
			expect(result.data.party[0]!.moves).toEqual(["SCRATCH", "GROWL"]);
		}
	});

	test("spriteId may be omitted entirely", () => {
		let trainer = validTrainer();
		delete (trainer as { spriteId?: unknown }).spriteId;
		expect(isSuccess(parseTrainer(trainer))).toBe(true);
	});

	test("spriteId may be a manifest image id", () => {
		let result = parseTrainer({ ...validTrainer(), spriteId: "rival-front" });
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.spriteId).toBe("rival-front");
	});

	test("a party member's moves may be omitted", () => {
		let trainer = validTrainer();
		trainer.party = [{ speciesId: "PIKACHU", level: 12 }];
		expect(isSuccess(parseTrainer(trainer))).toBe(true);
	});

	test("empty quote strings are allowed (quotes are required keys, not required text)", () => {
		let result = parseTrainer({ ...validTrainer(), quotes: { intro: "", win: "", lose: "" } });
		expect(isSuccess(result)).toBe(true);
	});

	test("a full party of six parses", () => {
		let trainer = validTrainer();
		trainer.party = Array.from({ length: MAX_PARTY_SIZE }, () => ({
			speciesId: "RATTATA",
			level: 3,
		}));
		expect(isSuccess(parseTrainer(trainer))).toBe(true);
	});

	test("unknown species/move ids parse (loader does not resolve against a roster)", () => {
		let trainer = validTrainer();
		trainer.party = [{ speciesId: "NOT_A_REAL_SPECIES", level: 5, moves: ["MADE_UP_MOVE"] }];
		expect(isSuccess(parseTrainer(trainer))).toBe(true);
	});

	test("the shipped sample trainer parses", () => {
		expect(isSuccess(parseTrainer(sampleTrainer))).toBe(true);
	});
});

describe("parseTrainer rejects malformed definitions", () => {
	let cases: Array<[label: string, value: unknown]> = [
		["null", null],
		["not an object", "trainer"],
		[
			"missing id",
			(() => {
				let t = validTrainer();
				delete (t as { id?: unknown }).id;
				return t;
			})(),
		],
		["blank id", { ...validTrainer(), id: "" }],
		["blank name", { ...validTrainer(), name: "" }],
		[
			"missing quotes",
			(() => {
				let t = validTrainer();
				delete (t as { quotes?: unknown }).quotes;
				return t;
			})(),
		],
		["quotes missing a key", { ...validTrainer(), quotes: { intro: "hi", win: "gg" } }],
		["quote wrong type", { ...validTrainer(), quotes: { intro: 1, win: "gg", lose: "no" } }],
		["empty party", { ...validTrainer(), party: [] }],
		[
			"party over the max",
			{
				...validTrainer(),
				party: Array.from({ length: MAX_PARTY_SIZE + 1 }, () => ({
					speciesId: "RATTATA",
					level: 3,
				})),
			},
		],
		["member missing speciesId", { ...validTrainer(), party: [{ level: 5 }] }],
		["member blank speciesId", { ...validTrainer(), party: [{ speciesId: "", level: 5 }] }],
		["member missing level", { ...validTrainer(), party: [{ speciesId: "RATTATA" }] }],
		["member level zero", { ...validTrainer(), party: [{ speciesId: "RATTATA", level: 0 }] }],
		[
			"member fractional level",
			{ ...validTrainer(), party: [{ speciesId: "RATTATA", level: 5.5 }] },
		],
		[
			"member with too many moves",
			{
				...validTrainer(),
				party: [
					{
						speciesId: "RATTATA",
						level: 5,
						moves: Array.from({ length: MAX_MOVES_PER_MEMBER + 1 }, () => "TACKLE"),
					},
				],
			},
		],
	];

	for (let [label, value] of cases) {
		test(label, () => {
			let result = parseTrainer(value);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(TrainerValidationError);
		});
	}
});
