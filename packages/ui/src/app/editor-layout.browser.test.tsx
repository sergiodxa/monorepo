/**
 * Lays the editor out in a real browser: the sidebar sits beside a measured writing column
 * when wide, becomes a full-screen sheet behind "Settings" at 375px, and nothing scrolls
 * the page sideways at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Button } from "../components/button.js";

import { EditorLayout } from "./editor-layout.js";

/** Mounts a post editor filling the page and returns its root. */
function mount(): HTMLElement {
	let mounted = render(
		<EditorLayout
			back={{ href: "/posts", label: "Posts" }}
			title="Designing a calmer editor for writers who publish every single day"
			status={<span>Saved</span>}
			preview={
				<Button variant="ghost" size="sm">
					Preview
				</Button>
			}
			primary={<Button size="sm">Publish</Button>}
			sidebar={<p>Status: Draft</p>}
			labels={{ settings: "Settings", closeSettings: "Close settings", sidebar: "Post settings" }}
		>
			<p>{"A quiet editor keeps the writing in front. ".repeat(40)}</p>
		</EditorLayout>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="editor-layout"]')!;
}

/** The sidebar, the settings toggle and the writing column in `root`. */
function parts(root: HTMLElement) {
	return {
		sidebar: root.querySelector<HTMLElement>('[data-slot="editor-sidebar"]')!,
		toggle: root.querySelector<HTMLButtonElement>('[data-slot="editor-settings-toggle"]')!,
		main: root.querySelector<HTMLElement>('[data-slot="editor-main"] > div')!,
	};
}

beforeEach(() => {
	document.body.style.margin = "0";
});

afterEach(async () => {
	document.body.replaceChildren();
	document.body.removeAttribute("style");
	await page.viewport(1024, 768);
});

describe("EditorLayout", () => {
	test("puts a 280–320px sidebar beside a writing column held to its measure", async () => {
		await page.viewport(1280, 800);
		let { sidebar, toggle, main } = parts(mount());
		let side = sidebar.getBoundingClientRect();

		expect(side.width).toBeGreaterThanOrEqual(280);
		expect(side.width).toBeLessThanOrEqual(320);
		expect(side.left).toBeGreaterThanOrEqual(main.getBoundingClientRect().right);
		expect(main.getBoundingClientRect().width).toBeLessThanOrEqual(680 + 1);
		expect(toggle.getBoundingClientRect().width).toBe(0);
	});

	test("keeps the bar stuck to the top while the column scrolls", async () => {
		await page.viewport(1280, 400);
		let root = mount();
		let bar = root.querySelector<HTMLElement>('[data-slot="editor-bar"]')!;

		globalThis.scrollTo(0, 600);
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(Math.round(bar.getBoundingClientRect().top)).toBe(0);
		globalThis.scrollTo(0, 0);
	});

	test("hides the sidebar behind Settings at 375px and opens it as a full-screen sheet", async () => {
		await page.viewport(375, 812);
		let { sidebar, toggle } = parts(mount());

		expect(sidebar.getBoundingClientRect().height).toBe(0);
		expect(toggle.getBoundingClientRect().width).toBeGreaterThan(0);

		await userEvent.click(toggle);

		expect(sidebar.matches(":popover-open")).toBe(true);
		let sheet = sidebar.getBoundingClientRect();
		expect(sheet.left).toBe(0);
		expect(sheet.top).toBe(0);
		expect(sheet.width).toBe(375);
		expect(sheet.height).toBe(812);

		await userEvent.click(
			sidebar.querySelector<HTMLButtonElement>('[aria-label="Close settings"]')!,
		);
		expect(sidebar.matches(":popover-open")).toBe(false);
	});

	test("names the sidebar by its heading", async () => {
		await page.viewport(375, 812);
		let { sidebar } = parts(mount());

		expect(document.getElementById(sidebar.getAttribute("aria-labelledby")!)?.textContent).toBe(
			"Post settings",
		);
	});

	test("never scrolls the page sideways at 320px", async () => {
		await page.viewport(320, 640);
		mount();

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});

	test("⌘S submits the document's form while the body is focused", async () => {
		let mounted = render(
			<EditorLayout
				title="Draft"
				form="post-form"
				primary={
					<Button type="submit" form="post-form" size="sm">
						Publish
					</Button>
				}
				labels={{ settings: "Settings", closeSettings: "Close settings", sidebar: "Post settings" }}
			>
				<form id="post-form" method="post" action="/posts/1">
					<textarea name="body" aria-label="Body" />
				</form>
				<form method="post" action="/posts/1/comments">
					<input name="comment" aria-label="Comment" />
				</form>
			</EditorLayout>,
		);
		let counts = { post: 0, comment: 0 };
		for (let form of mounted.container.querySelectorAll("form")) {
			form.addEventListener("submit", (event) => {
				event.preventDefault();
				counts[form.id === "post-form" ? "post" : "comment"]++;
			});
		}
		await new Promise((resolve) => requestAnimationFrame(resolve));

		mounted.container.querySelector("textarea")!.focus();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(counts).toEqual({ post: 1, comment: 0 });

		mounted.container.querySelector("input")!.focus();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(counts).toEqual({ post: 1, comment: 0 });
		mounted.cleanup();
	});
});
