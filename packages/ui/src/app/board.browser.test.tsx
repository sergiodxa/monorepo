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

/** Mounts a board whose cards' forms take a position: three cards in Todo, one in progress. */
function mountPositioned(): HTMLElement {
	let move = (id: string) => ({ action: `/move/${id}`, name: "status", position: "before" });
	mounted = render(
		<div style="inline-size:900px">
			<Board id="test-board" label="Issues by status" labels={{ moved: "Moved to {column}" }}>
				<Board.Column value="todo" title="Todo" count={3} empty="No issues">
					{["A-1", "A-2", "A-3"].map((id) => (
						<Board.Card value={id} move={move(id)}>
							<a href={`#${id}`}>{id}</a>
						</Board.Card>
					))}
				</Board.Column>
				<Board.Column value="started" title="In progress" count={1} empty="No issues">
					<Board.Card value="B-1" move={move("B-1")}>
						<a href="#b-1">B-1</a>
					</Board.Card>
				</Board.Column>
			</Board>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="board"]')!;
}

/** The card values of a column, in order. */
function order(column: Element): string[] {
	return [...column.querySelectorAll("[data-sortable-item]")].map((card) =>
		card.getAttribute("data-sortable-item")!,
	);
}

/** Collects what each card's move form posts, keeping the page where it is. */
function capturePosts(board: HTMLElement): Map<string, Array<[string, FormDataEntryValue]>> {
	let posts = new Map<string, Array<[string, FormDataEntryValue]>>();
	for (let form of board.querySelectorAll<HTMLFormElement>("form[data-sortable-form]")) {
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			posts.set(form.getAttribute("data-sortable-form")!, [...new FormData(form).entries()]);
		});
	}
	return posts;
}

/** Drags a card to a point, stepping the pointer so the drag passes its threshold. */
function dragTo(card: Element, to: { x: number; y: number }, release = true) {
	let from = centre(card);
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

	test("a sideways scroll settles on a column's start, and a drag lifts the snap", async () => {
		let board = mount(800);
		board.style.setProperty("--ui-board-column-width", "30rem");
		let scroller = board.querySelector<HTMLElement>('[data-slot="board-columns"]')!;
		let second = board.querySelectorAll<HTMLElement>('[data-slot="board-column"]')[1]!;
		let padding = parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart);

		scroller.scrollTo({ left: second.offsetLeft - 120, behavior: "instant" });
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(scroller.scrollLeft).toBe(second.offsetLeft - padding);
		board.setAttribute("data-sortable-active", "");
		expect(getComputedStyle(scroller).scrollSnapType).toBe("none");
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

	test("a card's move form posts into the frame its move names", () => {
		mounted = render(
			<Board id="framed-board" label="Framed">
				<Board.Column value="todo" title="Todo">
					<Board.Card value="F-1" move={{ action: "/move", name: "status", target: "board" }}>
						<a href="#f-1">F-1</a>
					</Board.Card>
				</Board.Column>
			</Board>,
		);

		expect(
			mounted.container.querySelector("form[data-sortable-form]")!.getAttribute("data-rmx-target"),
		).toBe("board");
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
		let card = board.querySelector<HTMLElement>('[data-sortable-item="A-1"]')!;
		let form = board.querySelector<HTMLFormElement>('form[data-sortable-form="A-1"]')!;
		let posted: Array<[string, FormDataEntryValue]> = [];
		let moved: string[] = [];
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			posted = [...new FormData(form).entries()];
		});
		board.addEventListener("ui:sortable-move", (event) => moved.push(`${event.from}>${event.to}`));

		drag(card, started!);

		expect(moved).toEqual(["todo>started"]);
		expect(started!.contains(card)).toBe(true);
		expect(posted).toEqual([
			["next", "board"],
			["status", "started"],
		]);
		expect(todo!.querySelector('[data-slot="board-count"]')!.textContent).toBe("1");
		expect(started!.querySelector('[data-slot="board-count"]')!.textContent).toBe("1");
		expect(document.querySelector("[data-sortable-ghost]")).toBeNull();
		expect(card.hasAttribute("data-sortable-dragging")).toBe(false);
	});

	test("a form read after the drop's own task still carries the column's value", async () => {
		let board = mount();
		await settle();
		let started = board.querySelectorAll<HTMLElement>('[data-slot="board-column"]')[1]!;
		let card = board.querySelector<HTMLElement>('[data-sortable-item="A-2"]')!;
		let form = board.querySelector<HTMLFormElement>('form[data-sortable-form="A-2"]')!;
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
		let card = board.querySelector<HTMLElement>('[data-sortable-item="A-1"]')!;
		let link = card.querySelector("a")!;
		let form = board.querySelector<HTMLFormElement>('form[data-sortable-form="A-1"]')!;
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
		let card = board.querySelector<HTMLElement>('[data-sortable-item="A-2"]')!;
		let submitted = false;
		board.addEventListener("submit", (event) => {
			event.preventDefault();
			submitted = true;
		});

		drag(card, done!, false);
		expect(done!.hasAttribute("data-sortable-target")).toBe(true);
		expect(document.querySelector("[data-sortable-ghost]")).not.toBeNull();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		pointer(document, "pointerup", centre(done!));

		expect(todo!.contains(card)).toBe(true);
		expect(done!.hasAttribute("data-sortable-target")).toBe(false);
		expect(document.querySelector("[data-sortable-ghost]")).toBeNull();
		expect(submitted).toBe(false);
	});

	test("a press that never travels stays a click, and a touch press starts no drag", async () => {
		let board = mount();
		await settle();
		let card = board.querySelector<HTMLElement>('[data-sortable-item="A-1"]')!;
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
		expect(document.querySelector("[data-sortable-ghost]")).toBeNull();
	});
});

describe("Board with positions", () => {
	test("a drag places the card between the cards under the pointer, and the drop sends its neighbour", async () => {
		let board = mountPositioned();
		await settle();
		let todo = board.querySelector('[data-sortable-list="todo"]')!;
		let posts = capturePosts(board);
		let first = board.querySelector('[data-sortable-item="A-1"]')!.getBoundingClientRect();

		dragTo(board.querySelector('[data-sortable-item="A-3"]')!, {
			x: first.left + 20,
			y: first.top + 4,
		});

		expect(order(todo)).toEqual(["A-3", "A-1", "A-2"]);
		expect(posts.get("A-3")).toEqual([
			["status", "todo"],
			["before", "A-1"],
		]);
		expect(todo.querySelector('[data-slot="board-count"]')!.textContent).toBe("3");
	});

	test("a card dropped under a column's last card lands last and sends no neighbour", async () => {
		let board = mountPositioned();
		await settle();
		let started = board.querySelector('[data-sortable-list="started"]')!;
		let posts = capturePosts(board);
		let last = board.querySelector('[data-sortable-item="B-1"]')!.getBoundingClientRect();

		dragTo(board.querySelector('[data-sortable-item="A-1"]')!, {
			x: last.left + 20,
			y: last.bottom + 20,
		});

		expect(order(started)).toEqual(["B-1", "A-1"]);
		expect(posts.get("A-1")).toEqual([
			["status", "started"],
			["before", ""],
		]);
		expect(started.querySelector('[data-slot="board-count"]')!.textContent).toBe("2");
	});

	test("Escape puts a placed card back where it started, posting nothing", async () => {
		let board = mountPositioned();
		await settle();
		let todo = board.querySelector('[data-sortable-list="todo"]')!;
		let posts = capturePosts(board);
		let first = board.querySelector('[data-sortable-item="A-1"]')!.getBoundingClientRect();

		dragTo(
			board.querySelector('[data-sortable-item="A-3"]')!,
			{ x: first.left + 20, y: first.top + 4 },
			false,
		);
		expect(order(todo)).toEqual(["A-3", "A-1", "A-2"]);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

		expect(order(todo)).toEqual(["A-1", "A-2", "A-3"]);
		expect(posts.size).toBe(0);
	});

	test("Shift+ArrowUp and Down reorder a card, and Shift+ArrowRight lands it on top", async () => {
		let board = mountPositioned();
		await settle();
		let todo = board.querySelector('[data-sortable-list="todo"]')!;
		let started = board.querySelector('[data-sortable-list="started"]')!;
		let posts = capturePosts(board);
		let link = board.querySelector<HTMLElement>('[data-sortable-item="A-2"] a')!;
		let press = (key: string) =>
			link.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey: true, bubbles: true }));
		link.focus();

		press("ArrowUp");
		expect(order(todo)).toEqual(["A-2", "A-1", "A-3"]);
		expect(posts.get("A-2")?.at(-1)).toEqual(["before", "A-1"]);

		press("ArrowDown");
		expect(order(todo)).toEqual(["A-1", "A-2", "A-3"]);
		expect(posts.get("A-2")?.at(-1)).toEqual(["before", "A-3"]);

		press("ArrowRight");
		expect(order(started)).toEqual(["A-2", "B-1"]);
		expect(posts.get("A-2")?.at(-1)).toEqual(["before", "B-1"]);
		expect(document.activeElement).toBe(link);
	});
});
