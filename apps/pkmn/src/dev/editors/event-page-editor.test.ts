/**
 * Verifies the pure event page/command editing logic without a DOM: the page and
 * command factories mint schema-valid defaults, the recursive command-tree operations
 * (insert / append / update / remove / read) address commands by {@link CommandPath}
 * and rebuild immutably, `show-choices` and `conditional-branch` nesting is edited in
 * place, choice/else management is honored, and the produced pages round-trip through
 * the `map-schema` validator via a full map.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { isSuccess } from "@pkg/result";

import type { EventCommand } from "~/presentation/render/map-schema";

import { loadMap } from "~/presentation/overworld/map-loader";

import {
	addChoice,
	appendCommand,
	clonePage,
	type CommandPath,
	defaultCommand,
	defaultPage,
	insertCommand,
	readCommand,
	removeChoice,
	removeCommand,
	toggleElse,
	updateCommand,
} from "./event-page-editor";
import { MapEditor } from "./map-editor";

/** A root-level path to the command at `index`. */
function at(index: number): CommandPath {
	return [{ index, branch: "then" }];
}

describe("defaultPage", () => {
	test("mints a schema-default page (no conditions/graphic, fixed movement, action)", () => {
		let page = defaultPage();
		expect(page.conditions).toEqual({});
		expect(page.graphic).toBeNull();
		expect(page.autonomousMovement.type).toBe("fixed");
		expect(page.trigger).toBe("action");
		expect(page.commands).toEqual([]);
	});
});

describe("defaultCommand", () => {
	test("mints each kind with the discriminant set", () => {
		expect(defaultCommand("text").kind).toBe("text");
		expect(defaultCommand("heal-party")).toEqual({ kind: "heal-party" });
		expect(defaultCommand("show-choices")).toMatchObject({
			kind: "show-choices",
			choices: [{ label: "", commands: [] }],
		});
		expect(defaultCommand("conditional-branch")).toMatchObject({
			kind: "conditional-branch",
			then: [],
		});
	});

	test("seeds species/item pickers from the supplied real ids", () => {
		let wild = defaultCommand("wild-encounter", { speciesId: "PIKACHU" });
		expect(wild).toMatchObject({ kind: "wild-encounter", speciesId: "PIKACHU" });
		let give = defaultCommand("give-item", { itemId: "POTION" });
		expect(give).toMatchObject({ kind: "give-item", itemId: "POTION", count: 1 });
	});
});

describe("root command operations", () => {
	test("appendCommand adds to the end of the root list, immutably", () => {
		let base: EventCommand[] = [];
		let next = appendCommand(base, [], defaultCommand("text"));
		expect(next.length).toBe(1);
		expect(base.length).toBe(0); // input untouched
	});

	test("insertCommand inserts at the last step's index (clamped)", () => {
		let list: EventCommand[] = [
			{ kind: "text", text: "a" },
			{ kind: "text", text: "b" },
		];
		let next = insertCommand(list, at(1), { kind: "text", text: "mid" });
		expect(next.map((c) => (c.kind === "text" ? c.text : c.kind))).toEqual(["a", "mid", "b"]);
	});

	test("updateCommand replaces the addressed command", () => {
		let list: EventCommand[] = [{ kind: "wait", frames: 10 }];
		let next = updateCommand(list, at(0), { kind: "wait", frames: 99 });
		expect(next[0]).toEqual({ kind: "wait", frames: 99 });
	});

	test("removeCommand drops the addressed command", () => {
		let list: EventCommand[] = [
			{ kind: "text", text: "a" },
			{ kind: "text", text: "b" },
		];
		let next = removeCommand(list, at(0));
		expect(next).toEqual([{ kind: "text", text: "b" }]);
	});

	test("readCommand returns the addressed command or null", () => {
		let list: EventCommand[] = [{ kind: "heal-party" }];
		expect(readCommand(list, at(0))).toEqual({ kind: "heal-party" });
		expect(readCommand(list, at(5))).toBeNull();
		expect(readCommand(list, [])).toBeNull();
	});
});

describe("nested show-choices editing", () => {
	test("appends a command into a chosen choice's branch", () => {
		let list: EventCommand[] = [
			{
				kind: "show-choices",
				prompt: undefined,
				choices: [
					{ label: "Yes", commands: [] },
					{ label: "No", commands: [] },
				],
			},
		];
		// Append into choice 1's ("No") command list.
		let choicePath: CommandPath = [{ index: 0, branch: "choice", choice: 1 }];
		let next = appendCommand(list, choicePath, { kind: "text", text: "nope" });
		let command = next[0]!;
		expect(command.kind).toBe("show-choices");
		if (command.kind === "show-choices") {
			expect(command.choices[0]!.commands).toEqual([]);
			expect(command.choices[1]!.commands).toEqual([{ kind: "text", text: "nope" }]);
		}
	});

	test("addChoice / removeChoice manage the choice list (keeping one)", () => {
		let list: EventCommand[] = [defaultCommand("show-choices")];
		let two = addChoice(list, at(0), "Second");
		let first = two[0]!;
		expect(first.kind === "show-choices" && first.choices.length).toBe(2);

		let back = removeChoice(two, at(0), 1);
		let only = back[0]!;
		expect(only.kind === "show-choices" && only.choices.length).toBe(1);

		// Cannot drop the last remaining choice.
		let stillOne = removeChoice(back, at(0), 0);
		let last = stillOne[0]!;
		expect(last.kind === "show-choices" && last.choices.length).toBe(1);
	});
});

describe("nested conditional-branch editing", () => {
	test("appends into the then branch and reads it back through its path", () => {
		let list: EventCommand[] = [defaultCommand("conditional-branch")];
		let thenPath: CommandPath = [{ index: 0, branch: "then" }];
		let next = appendCommand(list, thenPath, { kind: "face-player" });
		let command = next[0]!;
		expect(command.kind).toBe("conditional-branch");
		if (command.kind === "conditional-branch") {
			expect(command.then).toEqual([{ kind: "face-player" }]);
		}
	});

	test("toggleElse adds then drops the else branch", () => {
		let list: EventCommand[] = [defaultCommand("conditional-branch")];
		let withElse = toggleElse(list, at(0));
		let a = withElse[0]!;
		expect(a.kind === "conditional-branch" && a.else).toEqual([]);

		let withoutElse = toggleElse(withElse, at(0));
		let b = withoutElse[0]!;
		expect(b.kind === "conditional-branch" && b.else).toBeUndefined();
	});

	test("edits a command nested two levels deep (else → then)", () => {
		// A conditional-branch whose else holds another conditional-branch.
		let inner: EventCommand = defaultCommand("conditional-branch");
		let outer: EventCommand = {
			kind: "conditional-branch",
			condition: {},
			then: [],
			else: [inner],
		};
		let list: EventCommand[] = [outer];
		// Path: outer[0].else[0].then — append a text into the inner then.
		let deep: CommandPath = [
			{ index: 0, branch: "else" },
			{ index: 0, branch: "then" },
		];
		let next = appendCommand(list, deep, { kind: "text", text: "deep" });
		let top = next[0]!;
		expect(top.kind).toBe("conditional-branch");
		if (top.kind === "conditional-branch") {
			let nested = top.else![0]!;
			expect(nested.kind === "conditional-branch" && nested.then).toEqual([
				{ kind: "text", text: "deep" },
			]);
		}
	});
});

describe("clonePage", () => {
	test("deep-copies a page so mutating the copy does not leak", () => {
		let page = { ...defaultPage(), commands: [{ kind: "move", steps: ["up"] } as EventCommand] };
		let copy = clonePage(page);
		let command = copy.commands[0]!;
		if (command.kind === "move") command.steps.push("down");
		let original = page.commands[0]!;
		expect(original.kind === "move" && original.steps).toEqual(["up"]);
	});
});

describe("a dialog-shaped event round-trips through loadMap", () => {
	test("a page with nested commands validates as part of a map", () => {
		let editor = new MapEditor({ id: "events-map" });
		editor.createMap(4, 4);
		let placed = editor.addEvent(1, 1)!;

		// Build a page's command list the way the dialog would, through the helpers.
		let commands: EventCommand[] = [];
		commands = appendCommand(commands, [], defaultCommand("text"));
		commands = appendCommand(commands, [], defaultCommand("show-choices"));
		commands = appendCommand(commands, [{ index: 1, branch: "choice", choice: 0 }], {
			kind: "control-self-switch",
			name: "A",
			value: true,
		});
		commands = appendCommand(commands, [], defaultCommand("conditional-branch"));
		commands = toggleElse(commands, at(2));

		editor.setEventPages(placed.id, [{ ...defaultPage(), trigger: "parallel", commands }]);

		let map = editor.toMapData();
		expect(isSuccess(loadMap(map))).toBe(true);
	});
});
