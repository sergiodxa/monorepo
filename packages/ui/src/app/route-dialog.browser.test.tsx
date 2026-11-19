/**
 * Holds the route dialog to its contract in a real browser: it renders open and fixed over a
 * backdrop link, becomes a modal once hydrated, follows its close link when closed by command,
 * and stays put when its own form submits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { RouteDialog } from "./route-dialog.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;
let followed: string[] = [];

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	followed = [];
});

/** Mounts a dialog holding a form, recording the close link's clicks instead of following them. */
function mount(): HTMLDialogElement {
	mounted = render(
		<RouteDialog id="edit" closeHref="#closed" closeLabel="Close" aria-label="Edit event">
			<form method="post" action="#saved">
				<input name="title" aria-label="Title" />
				<button type="button" commandfor="edit" command="close">
					Cancel
				</button>
				<button type="submit">Save</button>
			</form>
		</RouteDialog>,
	);
	let link = mounted.container.querySelector<HTMLAnchorElement>("[data-route-dialog-close]")!;
	link.addEventListener("click", (event) => {
		event.preventDefault();
		followed.push(link.getAttribute("href") ?? "");
	});
	mounted.container
		.querySelector("form")!
		.addEventListener("submit", (event) => event.preventDefault());
	return mounted.container.querySelector("dialog")!;
}

describe("RouteDialog", () => {
	test("opens as a modal once hydrated, hiding its backdrop link", async () => {
		let dialog = mount();
		await expect.poll(() => dialog.matches(":modal")).toBe(true);
		expect(mounted!.container.querySelector<HTMLElement>("[data-route-dialog-close]")!.hidden).toBe(
			true,
		);
	});

	test("follows its close link when a close command shuts it", async () => {
		let dialog = mount();
		await expect.poll(() => dialog.matches(":modal")).toBe(true);
		dialog.querySelector<HTMLButtonElement>('[command="close"]')!.click();
		await expect.poll(() => followed).toEqual(["#closed"]);
	});

	test("leaves the address to the form when it submits", async () => {
		let dialog = mount();
		await expect.poll(() => dialog.matches(":modal")).toBe(true);
		dialog.querySelector<HTMLButtonElement>('[type="submit"]')!.click();
		dialog.close();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(followed).toEqual([]);
	});
});
