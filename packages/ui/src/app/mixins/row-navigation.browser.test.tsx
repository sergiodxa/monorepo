/**
 * Walks a list with the row keys in a real browser: `j`/`k` move a roving focus stop drawn as
 * an inset 2px ring, `x` toggles the row's selection checkbox, Enter and `o` open its link,
 * Space peeks, `/` focuses search, and the keys stand down under a modal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { Announcer } from "../../behaviors/announcer.js";

import { ROW_PEEK_EVENT, rowNavigation } from "./row-navigation.js";

const MONITORS = ["api.pulse.dev", "status.pulse.dev", "cdn.pulse.dev"];

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a monitor list carrying the row keys. */
function mount(announcer?: Announcer): HTMLElement {
	mounted = render(
		<div>
			<input id="monitor-search" type="search" aria-label="Search monitors" />
			<ul
				id="monitors"
				mix={[
					rowNavigation({
						search: "monitor-search",
						peek: true,
						announcer,
						labels: {
							group: "Monitors",
							next: "Next",
							selected: "Selected",
							deselected: "Cleared",
						},
					}),
				]}
			>
				{MONITORS.map((name) => (
					<li key={name}>
						<input type="checkbox" data-selection-item aria-label={`Select ${name}`} />
						<a href={`#${name}`}>{name}</a>
					</li>
				))}
			</ul>
			<dialog id="modal">
				<button type="button">Inside</button>
			</dialog>
		</div>,
	);
	return mounted.$("#monitors") as HTMLElement;
}

/** The list's rows. */
function rows(host: HTMLElement): HTMLElement[] {
	return [...host.querySelectorAll<HTMLElement>("li")];
}

describe("rowNavigation", () => {
	test("leaves one Tab stop on the first row", () => {
		let host = mount();
		expect(rows(host).map((row) => row.tabIndex)).toEqual([0, -1, -1]);
	});

	test("moves focus down and up with j and k, roving the Tab stop", async () => {
		let host = mount();
		let [first, second] = rows(host);

		await userEvent.keyboard("j");
		expect(document.activeElement).toBe(first);
		await userEvent.keyboard("j");
		expect(document.activeElement).toBe(second);
		expect(rows(host).map((row) => row.tabIndex)).toEqual([-1, 0, -1]);
		await userEvent.keyboard("k");
		expect(document.activeElement).toBe(first);
	});

	test("moves with the arrows only once a row holds focus, leaving page scroll alone", async () => {
		let host = mount();
		let [first, second] = rows(host);

		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(document.body);

		first!.focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(second);
	});

	test("draws a 2px focus ring inside the row's edge", async () => {
		let host = mount();
		await userEvent.keyboard("j");
		let style = getComputedStyle(rows(host)[0]!);

		expect(style.outlineStyle).toBe("solid");
		expect(style.outlineWidth).toBe("2px");
		expect(style.outlineOffset).toBe("-2px");
	});

	test("toggles the row's selection checkbox with x, firing change and announcing it", async () => {
		let announcer = new Announcer();
		let host = mount(announcer);
		let changes = 0;
		host.addEventListener("change", () => void changes++);

		await userEvent.keyboard("jx");
		let checkbox = rows(host)[0]!.querySelector("input")!;
		expect(checkbox.checked).toBe(true);
		expect(changes).toBe(1);
		expect(announcer.current?.text).toBe("Selected");

		await userEvent.keyboard("x");
		expect(checkbox.checked).toBe(false);
	});

	test("opens the row's link with Enter and with o", async () => {
		let host = mount();
		let opened: string[] = [];
		for (let link of host.querySelectorAll("a")) {
			link.addEventListener("click", (event) => {
				event.preventDefault();
				opened.push(link.textContent ?? "");
			});
		}

		await userEvent.keyboard("j{Enter}jo");
		expect(opened).toEqual(["api.pulse.dev", "status.pulse.dev"]);
	});

	test("dispatches a peek for the focused row on Space", async () => {
		let host = mount();
		let peeked: HTMLElement[] = [];
		host.addEventListener(ROW_PEEK_EVENT, (event) => {
			peeked.push((event as CustomEvent<{ row: HTMLElement }>).detail.row);
		});

		await userEvent.keyboard("j ");
		expect(peeked).toEqual([rows(host)[0]]);
	});

	test("focuses the search field with /, and stops answering j once typing there", async () => {
		mount();
		await userEvent.keyboard("/j");
		let field = document.getElementById("monitor-search") as HTMLInputElement;

		expect(document.activeElement).toBe(field);
		expect(field.value).toBe("j");
	});

	test("stands down while a modal is open", async () => {
		mount();
		(document.getElementById("modal") as HTMLDialogElement).showModal();
		await userEvent.keyboard("j");
		expect(document.activeElement?.tagName).toBe("BUTTON");
	});
});
