/**
 * Holds the board to its contract in a real browser: columns sit side by side and scroll
 * inside the board, an empty column says so, a mouse drag moves a card to another column and
 * posts its move form with that column's value, Escape cancels, and a click stays a click.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Board, boardMoveFormId } from "./board.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

beforeAll(async () => {
	await page.viewport(1280, 800);
});

afterAll(async () => {
	await page.viewport(414, 896);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a three-column board, the last two columns empty, `width` pixels wide and `height` tall. */
function mount(width = 900, height?: number): HTMLElement {
	mounted = render(
		<div style={`inline-size:${width}px${height ? `;block-size:${height}px` : ""}`}>
			<Board
				id="test-board"
				label="Issues by status"
				labels={{ moved: "Moved to {column}" }}
				style={height ? "block-size:100%" : undefined}
			>
				<Board.Column value="todo" title="Todo" count={2} empty="No issues">
					<Board.Card
						value="A-1"
						move={{ action: "/move/A-1", name: "status", fields: { next: "board" } }}
					>
						<a href="#a-1">First card</a>
					</Board.Card>
					<Board.Card value="A-2" move={{ action: "/move/A-2", name: "status" }}>
						<a href="#a-2">Second card</a>
					</Board.Card>
				</Board.Column>
				<Board.Column value="started" title="In progress" count={0} empty="No issues" />
				<Board.Column value="done" title="Done" count={0} empty="No issues" />
			</Board>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="board"]')!;
}

/** Waits for the island to attach its listeners. */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 50));
}

/** The middle of an element, in viewport pixels. */
function centre(element: Element): { x: number; y: number } {
	let rect = element.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Fires a pointer event of `type` at a point on `target`. */
function pointer(target: EventTarget, type: string, point: { x: number; y: number }) {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
			clientX: point.x,
			clientY: point.y,
		}),
	);
}

/** Drags a card onto a column, stepping the pointer so the drag passes its threshold. */
function drag(card: Element, column: Element, release = true) {
	let from = centre(card);
	let to = centre(column);
	pointer(card, "pointerdown", from);
	pointer(document, "pointermove", { x: from.x + 10, y: from.y + 10 });
	pointer(document, "pointermove", to);
	if (release) pointer(document, "pointerup", to);
}

describe("Board", () => {
	test("lays its columns side by side at their set width, scrolling inside the board", () => {
		let board = mount(800);
		let columns = [...board.querySelectorAll<HTMLElement>('[data-slot="board-column"]')];
		let scroller = board.querySelector<HTMLElement>('[data-slot="board-columns"]')!;

		expect(columns).toHaveLength(3);
		expect(columns[1]!.getBoundingClientRect().top).toBe(columns[0]!.getBoundingClientRect().top);
		expect(Math.round(columns[0]!.getBoundingClientRect().width)).toBe(288);
		expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
		expect(board.getBoundingClientRect().width).toBe(800);
	});

	test("a phone-narrow board shows one column and a sliver of the next", () => {
		let board = mount(360);
		let column = board.querySelector<HTMLElement>('[data-slot="board-column"]')!;
		expect(column.getBoundingClientRect().width).toBeLessThan(360);
		expect(column.getBoundingClientRect().width).toBeGreaterThan(280);
	});

	test("an empty column shows its empty line, a column with cards does not", () => {
		let board = mount();
		let [todo, started] = board.querySelectorAll('[data-slot="board-column"]');
		expect(getComputedStyle(todo!.querySelector('[data-slot="board-empty"]')!).display).toBe(
			"none",
		);
		expect(getComputedStyle(started!.querySelector('[data-slot="board-empty"]')!).display).toBe(
			"block",
		);
	});

	test("an empty column's line sits right under its header, however tall the board is", () => {
		let board = mount(900, 600);
		let started = board.querySelectorAll('[data-slot="board-column"]')[1]!;
		let header = started.querySelector("header")!.getBoundingClientRect();
		let empty = started.querySelector('[data-slot="board-empty"]')!.getBoundingClientRect();

		expect(empty.top - header.bottom).toBeLessThanOrEqual(1);
	});

	test("given a height, fills it and scrolls its columns under headers that stay put", () => {
		let board = mount(900, 160);
		let scroller = board.querySelector<HTMLElement>('[data-slot="board-columns"]')!;
		let header = board.querySelector('[data-slot="board-column"] header')!;

		expect(Math.round(board.getBoundingClientRect().height)).toBe(160);
		expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
		scroller.scrollTop = 60;
		expect(header.getBoundingClientRect().top).toBe(scroller.getBoundingClientRect().top);
	});

	test("each movable card owns a move form holding its own fields until a drop", () => {
		let board = mount();
		let form = board.querySelector<HTMLFormElement>(`#${boardMoveFormId("test-board", "A-1")}`)!;
		expect(form.getAttribute("action")).toBe("/move/A-1");
		expect([...new FormData(form).entries()]).toEqual([["next", "board"]]);
	});

	test("dropping a card on another column moves it there and posts the column's value", async () => {
		let board = mount();
		await settle();
		let [todo, started] = board.querySelectorAll<HTMLElement>('[data-slot="board-column"]');
		let card = board.querySelector<HTMLElement>('[data-board-card="A-1"]')!;
		let form = board.querySelector<HTMLFormElement>('form[data-board-move="A-1"]')!;
		let posted: Array<[string, FormDataEntryValue]> = [];
		let moved: string[] = [];
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			posted = [...new FormData(form).entries()];
		});
		board.addEventListener("ui:board-move", (event) => moved.push(`${event.from}>${event.to}`));

		drag(card, started!);

		expect(moved).toEqual(["todo>started"]);
		expect(started!.contains(card)).toBe(true);
		expect(posted).toEqual([
			["next", "board"],
			["status", "started"],
		]);
		expect(todo!.querySelector('[data-slot="board-count"]')!.textContent).toBe("1");
		expect(started!.querySelector('[data-slot="board-count"]')!.textContent).toBe("1");
		expect(document.querySelector("[data-board-ghost]")).toBeNull();
		expect(card.hasAttribute("data-board-dragging")).toBe(false);
	});

	test("a form read after the drop's own task still carries the column's value", async () => {
		let board = mount();
		await settle();
		let started = board.querySelectorAll<HTMLElement>('[data-slot="board-column"]')[1]!;
		let card = board.querySelector<HTMLElement>('[data-board-card="A-2"]')!;
		let form = board.querySelector<HTMLFormElement>('form[data-board-move="A-2"]')!;
		let read = new Promise<Array<[string, FormDataEntryValue]>>((resolve) => {
			form.addEventListener("submit", (event) => {
				event.preventDefault();
				setTimeout(() => resolve([...new FormData(form).entries()]), 0);
			});
		});

		drag(card, started);

		expect(await read).toEqual([["status", "started"]]);
	});

	test("Shift+Arrow moves the focused card one column over, keeps focus and says where", async () => {
		let board = mount();
		await settle();
		let [todo, started] = board.querySelectorAll<HTMLElement>('[data-slot="board-column"]');
		let card = board.querySelector<HTMLElement>('[data-board-card="A-1"]')!;
		let link = card.querySelector("a")!;
		let form = board.querySelector<HTMLFormElement>('form[data-board-move="A-1"]')!;
		let posted: Array<[string, FormDataEntryValue]> = [];
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			posted = [...new FormData(form).entries()];
		});
		let press = (key: string) =>
			link.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey: true, bubbles: true }));

		link.focus();
		press("ArrowLeft");
		expect(todo!.contains(card)).toBe(true);

		press("ArrowRight");
		expect(started!.contains(card)).toBe(true);
		expect(document.activeElement).toBe(link);
		expect(posted).toEqual([
			["next", "board"],
			["status", "started"],
		]);
		expect(board.querySelector('[data-slot="board-status"]')!.textContent).toBe(
			"Moved to In progress",
		);
	});

	test("rings the column under the pointer while dragging, and Escape puts everything back", async () => {
		let board = mount();
		await settle();
		let [todo, , done] = board.querySelectorAll<HTMLElement>('[data-slot="board-column"]');
		let card = board.querySelector<HTMLElement>('[data-board-card="A-2"]')!;
		let submitted = false;
		board.addEventListener("submit", (event) => {
			event.preventDefault();
			submitted = true;
		});

		drag(card, done!, false);
		expect(done!.hasAttribute("data-board-drop-target")).toBe(true);
		expect(document.querySelector("[data-board-ghost]")).not.toBeNull();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		pointer(document, "pointerup", centre(done!));

		expect(todo!.contains(card)).toBe(true);
		expect(done!.hasAttribute("data-board-drop-target")).toBe(false);
		expect(document.querySelector("[data-board-ghost]")).toBeNull();
		expect(submitted).toBe(false);
	});

	test("a press that never travels stays a click, and a touch press starts no drag", async () => {
		let board = mount();
		await settle();
		let card = board.querySelector<HTMLElement>('[data-board-card="A-1"]')!;
		let link = card.querySelector("a")!;
		let clicks = 0;
		link.addEventListener("click", (event) => {
			event.preventDefault();
			clicks++;
		});

		pointer(link, "pointerdown", centre(link));
		pointer(document, "pointerup", centre(link));
		link.click();
		expect(clicks).toBe(1);

		card.dispatchEvent(
			new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", pointerId: 2 }),
		);
		pointer(document, "pointermove", { x: 400, y: 400 });
		expect(document.querySelector("[data-board-ghost]")).toBeNull();
	});
});
