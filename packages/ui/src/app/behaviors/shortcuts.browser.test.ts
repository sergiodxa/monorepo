/**
 * Drives the shortcut registry with real keystrokes: layers ranked page < sheet < modal,
 * sequences and their timeout, keys ignored while typing, the Escape ladder, and shortcuts
 * declared in markup with `data-shortcut`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { ESCAPE_PRIORITY, ShortcutRegistry, shortcutGlyphs } from "./shortcuts.js";

let controller: AbortController;
let registry: ShortcutRegistry;
let ran: string[];

beforeEach(() => {
	controller = new AbortController();
	registry = new ShortcutRegistry({ sequenceTimeout: 150 });
	registry.listen(document, controller.signal);
	ran = [];
	document.body.focus();
});

afterEach(() => {
	controller.abort();
	document.body.replaceChildren();
});

/** Registers `keys` recording `name` when it runs. */
function record(
	keys: string,
	name: string,
	extra: Partial<Parameters<ShortcutRegistry["register"]>[0]> = {},
) {
	registry.register({ keys, run: () => void ran.push(name), signal: controller.signal, ...extra });
}

/** Builds an element from markup and appends it to the page. */
function append<T extends Element>(markup: string): T {
	let template = document.createElement("template");
	template.innerHTML = markup.trim();
	let node = template.content.firstElementChild!;
	document.body.appendChild(node);
	return node as T;
}

/** Resolves after `ms` milliseconds. */
function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("ShortcutRegistry", () => {
	test("runs a single key and default-prevents it", async () => {
		record("c", "create");
		await userEvent.keyboard("c");
		expect(ran).toEqual(["create"]);
	});

	test("lets the open modal's key win over the page's, and keeps page keys inert under it", async () => {
		let dialog = append<HTMLDialogElement>("<dialog><button>Inside</button></dialog>");
		record("x", "page-x");
		record("j", "page-j");
		record("x", "modal-x", { scope: dialog });

		await userEvent.keyboard("x");
		expect(ran).toEqual(["page-x"]);

		dialog.showModal();
		await userEvent.keyboard("x");
		await userEvent.keyboard("j");
		expect(ran).toEqual(["page-x", "modal-x"]);
	});

	test("answers a global key under a modal, below the modal's own", async () => {
		let dialog = append<HTMLDialogElement>("<dialog><button>Inside</button></dialog>");
		record("mod+k", "toggle", { global: true });
		dialog.showModal();

		await userEvent.keyboard("{Control>}k{/Control}");
		expect(ran).toEqual(["toggle"]);

		record("mod+k", "modal-own", { scope: dialog });
		await userEvent.keyboard("{Control>}k{/Control}");
		expect(ran).toEqual(["toggle", "modal-own"]);
	});

	test("ranks an open sheet over the page, and the page again once it closes", async () => {
		let sheet = append<HTMLElement>('<aside popover="manual">Details</aside>');
		record("e", "page-e");
		record("e", "sheet-e", { scope: sheet });

		sheet.showPopover();
		await userEvent.keyboard("e");
		sheet.hidePopover();
		await userEvent.keyboard("e");

		expect(ran).toEqual(["sheet-e", "page-e"]);
	});

	test("breaks a tie in one layer by priority", async () => {
		record("escape", "close", { priority: ESCAPE_PRIORITY.close });
		record("escape", "selection", { priority: ESCAPE_PRIORITY.selection });
		await userEvent.keyboard("{Escape}");
		expect(ran).toEqual(["selection"]);
	});

	test("walks the Escape ladder as each handler declines once it has nothing to clear", async () => {
		let selected = 2;
		let filters = 1;
		registry.register({
			keys: "escape",
			priority: ESCAPE_PRIORITY.selection,
			run: () => (selected > 0 ? void (selected = 0) : false),
			signal: controller.signal,
		});
		registry.register({
			keys: "escape",
			priority: ESCAPE_PRIORITY.filters,
			run: () => (filters > 0 ? void (filters = 0) : false),
			signal: controller.signal,
		});
		record("escape", "close", { priority: ESCAPE_PRIORITY.close });

		await userEvent.keyboard("{Escape}");
		expect([selected, filters, ran.length]).toEqual([0, 1, 0]);
		await userEvent.keyboard("{Escape}");
		expect([selected, filters, ran.length]).toEqual([0, 0, 0]);
		await userEvent.keyboard("{Escape}");
		expect(ran).toEqual(["close"]);
	});

	test("runs a g sequence, and drops its first key after the timeout", async () => {
		record("g m", "monitors");
		record("m", "mark");

		await userEvent.keyboard("gm");
		expect(ran).toEqual(["monitors"]);

		await userEvent.keyboard("g");
		await wait(250);
		await userEvent.keyboard("m");
		expect(ran).toEqual(["monitors", "mark"]);
	});

	test("ignores keys typed into a field, except the ones registered to answer there", async () => {
		let input = append<HTMLInputElement>('<input aria-label="Search">');
		record("j", "next");
		record("escape", "clear", { whileTyping: true });

		input.focus();
		await userEvent.keyboard("j{Escape}");

		expect(ran).toEqual(["clear"]);
		expect(input.value).toBe("j");
	});

	test("clicks an element declared with data-shortcut, and focuses a declared field", async () => {
		let clicks = 0;
		let link = append<HTMLButtonElement>('<button data-shortcut="g i">Incidents</button>');
		link.addEventListener("click", () => void clicks++);
		let field = append<HTMLInputElement>(
			'<input type="search" data-shortcut="/" aria-label="Search">',
		);

		await userEvent.keyboard("gi");
		expect(clicks).toBe(1);

		await userEvent.keyboard("/");
		expect(document.activeElement).toBe(field);
		expect(field.value).toBe("");
	});

	test("scopes a declared shortcut to the dialog it sits in", async () => {
		let clicks: string[] = [];
		let page = append<HTMLButtonElement>('<button data-shortcut="d">Page delete</button>');
		let dialog = append<HTMLDialogElement>(
			'<dialog><button data-shortcut="d">Dialog delete</button></dialog>',
		);
		page.addEventListener("click", () => void clicks.push("page"));
		dialog.querySelector("button")!.addEventListener("click", () => void clicks.push("dialog"));

		await userEvent.keyboard("d");
		dialog.showModal();
		await userEvent.keyboard("d");

		expect(clicks).toEqual(["page", "dialog"]);
	});

	test("lists labelled shortcuts with their groups, registered and declared, once each", () => {
		append(
			'<nav data-shortcut-group="Navigation"><a href="#m" data-shortcut="g m">Monitors</a><a href="#m2" data-shortcut="g m">Monitors</a></nav>',
		);
		registry.register({
			keys: ["j", "arrowdown"],
			label: "Next row",
			group: "Lists",
			run: () => {},
			signal: controller.signal,
		});
		registry.register({ keys: "x", run: () => {}, signal: controller.signal });

		expect(registry.list(document)).toEqual([
			{ keys: ["j", "arrowdown"], label: "Next row", group: "Lists" },
			{ keys: ["g m"], label: "Monitors", group: "Navigation" },
		]);
	});

	test("dispatches change as shortcuts come and go", () => {
		let changes = 0;
		registry.addEventListener("change", () => void changes++);
		let remove = registry.register({ keys: "x", run: () => {} });
		remove();
		expect(changes).toBe(2);
	});

	test("prints the caps a hint shows", () => {
		expect(shortcutGlyphs("g m", true)).toEqual(["G", "M"]);
		expect(shortcutGlyphs("mod+k", true)).toEqual(["⌘", "K"]);
		expect(shortcutGlyphs("mod+k", false)).toEqual(["Ctrl", "K"]);
		expect(shortcutGlyphs("arrowdown", true)).toEqual(["↓"]);
		expect(shortcutGlyphs("J", true)).toEqual(["⇧", "J"]);
		expect(shortcutGlyphs("?", true)).toEqual(["?"]);
	});
});
