/**
 * Paints the editor's floating chrome against the real theme: the sticky bar and the save
 * bar sit above scrolling content, so each needs an opaque background in light and dark
 * for the writing underneath to stay hidden behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Button } from "../components/button.js";

import { EditorLayout } from "./editor-layout.js";
import { SaveBar } from "./save-bar.js";

import "../reset.css";
import "../theme.css";

/** Mounts a post editor whose form holds a save bar, and returns the two floating bars. */
function mount(): { bar: HTMLElement; saveBar: HTMLElement } {
	let mounted = render(
		<EditorLayout
			title="Designing a calmer editor"
			preview={
				<Button variant="outline" size="sm">
					View
				</Button>
			}
			primary={<Button size="sm">Publish</Button>}
			labels={{ settings: "Settings", closeSettings: "Close settings", sidebar: "Post settings" }}
		>
			<form method="post">
				<p>{"A quiet editor keeps the writing in front. ".repeat(40)}</p>
				<SaveBar
					labels={{ message: "Unsaved changes", discard: "Discard", save: "Save", shortcut: "⌘S" }}
				/>
			</form>
		</EditorLayout>,
	);
	return {
		bar: mounted.container.querySelector<HTMLElement>('[data-slot="editor-bar"]')!,
		saveBar: mounted.container.querySelector<HTMLElement>('[data-slot="save-bar"]')!,
	};
}

/** The alpha channel of a computed color, `0` for `transparent`. */
function alpha(color: string): number {
	if (color === "transparent") return 0;
	let match = /\/\s*([\d.]+)(%?)\s*\)$/.exec(color) ?? /rgba\([^)]*,\s*([\d.]+)\)$/.exec(color);
	if (!match) return 1;
	return match[2] === "%" ? Number(match[1]) / 100 : Number(match[1]);
}

afterEach(() => {
	document.body.replaceChildren();
	document.documentElement.classList.remove("dark");
});

describe("editor surfaces", () => {
	for (let scheme of ["light", "dark"]) {
		test(`the sticky bar and the save bar paint an opaque background in ${scheme} mode`, () => {
			if (scheme === "dark") document.documentElement.classList.add("dark");
			let { bar, saveBar } = mount();

			expect(alpha(getComputedStyle(bar).backgroundColor)).toBe(1);
			expect(alpha(getComputedStyle(saveBar).backgroundColor)).toBe(1);
		});
	}
});
