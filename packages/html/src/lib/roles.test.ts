/**
 * Checks the element-to-role mapping a query addresses the document through,
 * including the contextual cases that read an element's surroundings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";

import { roleOf } from "./roles.js";

/** Parses a fragment and returns the element the `#subject` id marks. */
function subject(markup: string): Element {
	let { document } = parseHTML(`<!doctype html><html><body>${markup}</body></html>`);
	return document.querySelector("#subject") as unknown as Element;
}

describe("roleOf", () => {
	test.each([
		[`<button id="subject">Go</button>`, "button"],
		[`<a id="subject" href="/x">x</a>`, "link"],
		[`<a id="subject">x</a>`, "generic"],
		[`<h2 id="subject">x</h2>`, "heading"],
		[`<p id="subject">x</p>`, "paragraph"],
		[`<input id="subject">`, "textbox"],
		[`<input id="subject" type="checkbox">`, "checkbox"],
		[`<input id="subject" type="radio">`, "radio"],
		[`<input id="subject" type="submit" value="Save">`, "button"],
		[`<input id="subject" type="search">`, "searchbox"],
		[`<input id="subject" type="range">`, "slider"],
		[`<textarea id="subject"></textarea>`, "textbox"],
		[`<select id="subject"><option>a</option></select>`, "combobox"],
		[`<select id="subject" multiple><option>a</option></select>`, "listbox"],
		[`<img id="subject" src="x" alt="A cat">`, "image"],
		[`<img id="subject" src="x" alt="">`, "presentation"],
		[`<ul><li id="subject">x</li></ul>`, "listitem"],
		[`<div><li id="subject">x</li></div>`, "generic"],
		[`<dl><dt id="subject">x</dt><dd>y</dd></dl>`, "term"],
		[`<dl><dt>x</dt><dd id="subject">y</dd></dl>`, "definition"],
		[`<table><tr><td id="subject">x</td></tr></table>`, "cell"],
		[`<table><tr><th id="subject">x</th></tr></table>`, "columnheader"],
		[`<table><tr><th id="subject">x</th><td>y</td></tr></table>`, "rowheader"],
		[`<table><tr><th id="subject" scope="col">x</th><td>y</td></tr></table>`, "columnheader"],
		[`<header id="subject">x</header>`, "banner"],
		[`<main><header id="subject">x</header></main>`, "generic"],
		[`<footer id="subject">x</footer>`, "contentinfo"],
		[`<section id="subject" aria-label="Fees">x</section>`, "region"],
		[`<section id="subject">x</section>`, "generic"],
		[`<div id="subject" role="switch">x</div>`, "switch"],
		[`<div id="subject" role="menuitem link">x</div>`, "menuitem"],
	])("exposes %s as %s", (markup, role) => {
		expect(roleOf(subject(markup))).toBe(role);
	});

	test.each([[`<input id="subject" type="hidden">`], [`<input id="subject" type="password">`]])(
		"leaves %s without a role",
		(markup) => {
			expect(roleOf(subject(markup))).toBeUndefined();
		},
	);
});
