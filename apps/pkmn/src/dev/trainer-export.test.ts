/**
 * Verifies the trainer export: the pure payload shaper derives the
 * `src/content/trainers/<id>.json` write path and a tab-indented JSON body from a
 * definition, and rejects invalid ids (blank, uppercase, dotted, traversal-ish,
 * over-length) before any path work; the derived path always passes the shared
 * path-safety guard. The server handler {@link runTrainerExport} is exercised end
 * to end with a real write into an allow-listed scratch target (removed
 * after), and guards that malformed payloads and unsafe ids fail without writing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { isFailure, isSuccess } from "@pkg/result";
import { afterAll, describe, expect, test } from "vitest";

import type { TrainerDefinition } from "~/content/trainers";

import { validateWritePath } from "./path-safety";
import {
	APP_ROOT,
	runTrainerExport,
	shapeTrainerExport,
	TRAINER_CONTENT_DIR,
	TrainerIdError,
} from "./trainer-export";

/** A minimal, valid definition tests clone and mutate to exercise one rule. */
function validTrainer(): TrainerDefinition {
	return {
		id: "rival-blue",
		name: "Blue",
		spriteId: null,
		quotes: { intro: "Let's battle!", win: "I win!", lose: "No way!" },
		party: [{ speciesId: "CHARMANDER", level: 5, moves: ["SCRATCH", "GROWL"] }],
	};
}

describe("shapeTrainerExport", () => {
	test("derives the write path from the id and a tab-indented JSON body", () => {
		let result = shapeTrainerExport(validTrainer());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.path).toBe(`${TRAINER_CONTENT_DIR}/rival-blue.json`);
			expect(result.data.contents.endsWith("\n")).toBe(true);
			expect(result.data.contents).toContain("\t");
			// The body round-trips to the original definition.
			expect(JSON.parse(result.data.contents)).toEqual(validTrainer());
		}
	});

	test("trims the id for both the path and the serialized body", () => {
		let result = shapeTrainerExport({ ...validTrainer(), id: "  rival-blue  " });
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.path).toBe(`${TRAINER_CONTENT_DIR}/rival-blue.json`);
			expect((JSON.parse(result.data.contents) as TrainerDefinition).id).toBe("rival-blue");
		}
	});

	test("the derived path always passes the path-safety guard", () => {
		let result = shapeTrainerExport(validTrainer());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(isSuccess(validateWritePath(result.data.path))).toBe(true);
	});

	describe("rejects invalid ids", () => {
		let cases: Array<[label: string, id: string]> = [
			["blank", ""],
			["whitespace only", "   "],
			["uppercase", "Rival"],
			["underscore", "rival_blue"],
			["space", "rival blue"],
			["leading hyphen", "-rival"],
			["trailing hyphen", "rival-"],
			["dot / extension", "rival.json"],
			["slash / traversal", "../rival"],
			["nested slash", "sub/rival"],
			["over 64 chars", "a".repeat(65)],
		];

		for (let [label, id] of cases) {
			test(label, () => {
				let result = shapeTrainerExport({ ...validTrainer(), id });
				expect(isFailure(result)).toBe(true);
				if (isFailure(result)) expect(result.error).toBeInstanceOf(TrainerIdError);
			});
		}
	});
});

describe("runTrainerExport", () => {
	// A dedicated id so the write lands under the real trainers dir and is removed.
	let SCRATCH_ID = "export-test-trainer";
	let SCRATCH_PATH = `${TRAINER_CONTENT_DIR}/${SCRATCH_ID}.json`;

	afterAll(async () => {
		await rm(resolve(APP_ROOT, SCRATCH_PATH), { force: true });
	});

	test("rejects a malformed payload without writing", async () => {
		let result = await runTrainerExport({ id: "x", name: "X", quotes: {}, party: [] });
		expect(isFailure(result)).toBe(true);
	});

	test("rejects an invalid id with a TrainerIdError", async () => {
		let result = await runTrainerExport({ ...validTrainer(), id: "Bad Id" });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(TrainerIdError);
	});

	test("validates and writes a definition into the trainers content dir", async () => {
		let definition = { ...validTrainer(), id: SCRATCH_ID };
		let result = await runTrainerExport(definition);
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.path).toBe(SCRATCH_PATH);
			expect(result.data.bytesWritten).toBeGreaterThan(0);

			let written = JSON.parse(await readFile(result.data.absolutePath, "utf8"));
			expect(written).toEqual(definition);
		}
	});
});
