/**
 * Tests for headline-style capitalization, focused on the Chicago rules that
 * are easy to get wrong: a preposition in the middle of a title, a subtitle
 * after a colon, a hyphenated compound, and a `special` entry that renders
 * lowercase even in the first position.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createTitleizer, titleize } from "./titleize";

describe("titleize", () => {
	test("capitalizes the first and last word even when they are small words", () => {
		expect(titleize("to be continued")).toBe("To Be Continued");
		expect(titleize("what it is all about")).toBe("What It Is All About");
	});

	test("lowercases articles in the middle of a title", () => {
		expect(titleize("the end of an era")).toBe("The End of an Era");
		expect(titleize("one of the best")).toBe("One of the Best");
	});

	test("lowercases coordinating conjunctions in the middle of a title", () => {
		expect(titleize("slow and steady but never boring")).toBe("Slow and Steady but Never Boring");
		expect(titleize("neither here nor there yet")).toBe("Neither Here nor There Yet");
	});

	test("lowercases a preposition in the middle of a title", () => {
		expect(titleize("a history of the world in six glasses")).toBe(
			"A History of the World in Six Glasses",
		);
	});

	test("lowercases long prepositions, which is what makes this Chicago and not AP", () => {
		expect(titleize("a note concerning the report")).toBe("A Note concerning the Report");
		expect(titleize("shipping despite the outage")).toBe("Shipping despite the Outage");
		expect(titleize("a walk throughout the city")).toBe("A Walk throughout the City");
	});

	test("lowercases as, and to in an infinitive", () => {
		expect(titleize("how to write")).toBe("How to Write");
		expect(titleize("the same as before")).toBe("The Same as Before");
	});

	test("capitalizes the first word after a colon", () => {
		expect(titleize("a history: the whole story")).toBe("A History: The Whole Story");
		expect(titleize("remix v3: the router", { special: ["v3"] })).toBe("Remix v3: The Router");
	});

	test("capitalizes both elements of a hyphenated compound", () => {
		expect(titleize("self-hosted analytics")).toBe("Self-Hosted Analytics");
		expect(titleize("going self-hosted")).toBe("Going Self-Hosted");
		expect(titleize("a long-term plan")).toBe("A Long-Term Plan");
	});

	test("keeps small words inside a hyphenated compound lowercase", () => {
		expect(titleize("state-of-the-art design")).toBe("State-of-the-Art Design");
	});

	test("renders a special entry exactly as written, beating every other rule", () => {
		expect(titleize("FaCEbook is great", { special: ["facebook"] })).toBe("facebook Is Great");
		expect(titleize("all about ios", { special: ["iOS"] })).toBe("All about iOS");
		expect(titleize("the of package", { special: ["OF"] })).toBe("The OF Package");
	});

	test("matches a special entry case-insensitively", () => {
		for (let written of ["ios", "IOS", "iOS", "IoS"]) {
			expect(titleize(`shipping ${written} apps`, { special: ["iOS"] })).toBe("Shipping iOS Apps");
		}
	});

	test("uses the built-in special set for names whose casing is not derivable", () => {
		expect(titleize("the state of javascript in 2026")).toBe("The State of JavaScript in 2026");
		expect(titleize("publishing to npm")).toBe("Publishing to npm");
		expect(titleize("what's new in css")).toBe("What's New in CSS");
	});

	test("lets a caller override the built-in special set", () => {
		expect(titleize("shipping with npm", { special: ["NPM"] })).toBe("Shipping with NPM");
	});

	test("keeps punctuation attached to the word it wraps", () => {
		expect(titleize(`the "best" of the web`)).toBe(`The "Best" of the Web`);
		expect(titleize("(and then some)")).toBe("(And Then Some)");
	});

	test("keeps casing an author chose inside a word", () => {
		expect(titleize("the rise of GraphQL")).toBe("The Rise of GraphQL");
	});

	test("preserves the original spacing", () => {
		expect(titleize("  padded   title  ")).toBe("  Padded   Title  ");
	});

	test("handles empty and punctuation-only input", () => {
		expect(titleize("")).toBe("");
		expect(titleize("   ")).toBe("   ");
		expect(titleize("...")).toBe("...");
	});
});

describe("createTitleizer", () => {
	test("binds a vocabulary so call sites do not repeat it", () => {
		let title = createTitleizer({
			special: ["JavaScript", "TypeScript", "GitHub", "iOS", "npm", "Remix"],
		});

		expect(title("getting started with remix and typescript")).toBe(
			"Getting Started with Remix and TypeScript",
		);
		expect(title("deploying from github")).toBe("Deploying from GitHub");
	});

	test("keeps the built-in special set", () => {
		let title = createTitleizer({ special: ["Remix"] });

		expect(title("parsing json in remix")).toBe("Parsing JSON in Remix");
	});

	test("keeps two titleizers independent", () => {
		let first = createTitleizer({ special: ["npm"] });
		let second = createTitleizer({ special: ["NPM"] });

		expect(first("publishing to npm")).toBe("Publishing to npm");
		expect(second("publishing to npm")).toBe("Publishing to NPM");
	});
});
