/**
 * Holds the typewriter to its contract in a real browser, where the Custom Highlight API
 * exists: it hides the text on construction, holds at pauses and slows inside speed markup,
 * and finishes early by releasing its range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { afterEach, describe, expect, test } from "vitest";

import { TYPEWRITER_HIGHLIGHT, Typewriter } from "./typewriter.js";

let root: HTMLElement | undefined;

afterEach(() => {
	root?.remove();
	root = undefined;
});

/** Renders `html` into a fresh paragraph in the document. */
function element(html: string): HTMLElement {
	root = document.createElement("p");
	root.innerHTML = html;
	document.body.appendChild(root);
	return root;
}

/** The text the shared highlight still hides. */
function unrevealed(): string {
	let highlight = CSS.highlights.get(TYPEWRITER_HIGHLIGHT);
	return [...(highlight ?? [])].map((range) => (range as Range).toString()).join("");
}

describe(Typewriter, () => {
	test("hides the whole text until it starts, leaving the DOM as it was", () => {
		let paragraph = element("Hello <b>there</b>.");
		let writer = new Typewriter(paragraph);
		expect(unrevealed()).toBe("Hello there.");
		expect(paragraph.innerHTML).toBe("Hello <b>there</b>.");
		writer.dispose();
		expect(unrevealed()).toBe("");
	});

	test("holds at a pause and halves the speed inside speed markup", async () => {
		let paragraph = element(
			'Wait<span data-typewriter-pause="300"></span> for <span data-typewriter-speed="0.5">it</span>',
		);
		let writer = new Typewriter(paragraph);
		let started = performance.now();
		writer.start(100);
		await writer.done;
		let elapsed = performance.now() - started;
		expect(elapsed).toBeGreaterThanOrEqual(4 * 10 + 300 + 4 * 10 + 2 * 20 - 5);
	});

	test("finishes early and releases its highlight range", () => {
		let paragraph = element("Some text");
		let writer = new Typewriter(paragraph);
		writer.start(1);
		expect(unrevealed()).toBe("Some text");
		writer.finish();
		expect(writer.finished).toBe(true);
		expect(writer.shown).toBe(9);
		expect(unrevealed()).toBe("");
	});

	test("shows the text at once at speed 0", async () => {
		let writer = new Typewriter(element("Now"));
		writer.start(0);
		await writer.done;
		expect(unrevealed()).toBe("");
	});
});
