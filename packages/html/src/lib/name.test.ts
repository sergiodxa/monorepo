/**
 * Checks the accessible-name computation against the AccName and HTML-AAM rules a
 * query relies on: the order the sources are consulted in, what hiding removes, and
 * how a name assembled from content and references reads once normalized.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";

import type { DOMElement } from "./dom.js";

import { accessibleName } from "./name.js";

/** Parses a fragment and returns the element the `#subject` id marks. */
function subject(markup: string): DOMElement {
	let { document } = parseHTML(`<!doctype html><html><body>${markup}</body></html>`);
	return document.querySelector("#subject") as unknown as DOMElement;
}

describe("accessibleName", () => {
	test.each([
		["content of a button", `<button id="subject">Sign in</button>`, "Sign in"],
		["content of a link", `<a id="subject" href="/x">Profile</a>`, "Profile"],
		["content of a heading", `<h2 id="subject">Funds</h2>`, "Funds"],
		["content of a table cell", `<table><tr><td id="subject">42</td></tr></table>`, "42"],
		[
			"nested content",
			`<a id="subject" href="/x"><span>Your</span> <b>profile</b></a>`,
			"Your profile",
		],
		[
			"inline content without added spacing",
			`<a id="subject" href="/x">Pro<b>file</b></a>`,
			"Profile",
		],
		[
			"block content as separate words",
			`<button id="subject"><div>Sign</div><div>in</div></button>`,
			"Sign in",
		],
		["whitespace collapsed", `<button id="subject">\n  Sign \t in  </button>`, "Sign in"],
	])("reads the %s", (_, markup, name) => {
		expect(accessibleName(subject(markup))).toBe(name);
	});

	test.each([
		[
			"aria-label over content",
			`<button id="subject" aria-label="Close dialog">×</button>`,
			"Close dialog",
		],
		[
			"content when aria-label is blank",
			`<button id="subject" aria-label="  ">Close</button>`,
			"Close",
		],
		[
			"aria-labelledby over aria-label",
			`<span id="a">Billing</span><button id="subject" aria-labelledby="a" aria-label="Other">x</button>`,
			"Billing",
		],
		[
			"every aria-labelledby reference, in order",
			`<span id="a">Billing</span><span id="b">address</span><input id="subject" aria-labelledby="b a">`,
			"address Billing",
		],
		[
			"aria-label when every aria-labelledby reference is missing",
			`<button id="subject" aria-labelledby="missing" aria-label="Fallback">x</button>`,
			"Fallback",
		],
		[
			"a self-reference through its own aria-label",
			`<button id="subject" aria-labelledby="subject other" aria-label="Delete"></button><span id="other">file</span>`,
			"Delete file",
		],
		[
			"a referenced element's aria-label",
			`<span id="a" aria-label="Shipping">ignored</span><input id="subject" aria-labelledby="a">`,
			"Shipping",
		],
		[
			"a referenced element without following its own aria-labelledby",
			`<span id="b">deep</span><span id="a" aria-labelledby="b">shallow</span><input id="subject" aria-labelledby="a">`,
			"shallow",
		],
		[
			"a hidden referenced element, hidden descendants included",
			`<div id="a" hidden>Secret <span hidden>name</span></div><input id="subject" aria-labelledby="a">`,
			"Secret name",
		],
	])("prefers %s", (_, markup, name) => {
		expect(accessibleName(subject(markup))).toBe(name);
	});

	test.each([
		[
			"a label pointing at it",
			`<label for="subject">Tip amount</label><input id="subject">`,
			"Tip amount",
		],
		["a label wrapping it", `<label>Tip amount <input id="subject"></label>`, "Tip amount"],
		[
			"every label, in document order",
			`<label for="subject">Tip</label><input id="subject"><label for="subject">amount</label>`,
			"Tip amount",
		],
		[
			"a label for a textarea",
			`<label for="subject">Note</label><textarea id="subject"></textarea>`,
			"Note",
		],
		[
			"a label for a select, leaving its options out",
			`<label for="subject">Fund</label><select id="subject"><option>General</option></select>`,
			"Fund",
		],
		[
			"a label over a button's content",
			`<label for="subject">Give</label><button id="subject">Go</button>`,
			"Give",
		],
		[
			"an embedded text field's value inside another control's label",
			`<input id="subject" type="checkbox" aria-labelledby="l"><span id="l">Tip <input value="10"> percent</span>`,
			"Tip 10 percent",
		],
		[
			"an embedded select's chosen option inside another control's label",
			`<input id="subject" type="checkbox" aria-labelledby="l"><span id="l">Every <select><option>day</option><option selected>week</option></select></span>`,
			"Every week",
		],
		[
			"a title when nothing else names a field",
			`<input id="subject" title="Search the site">`,
			"Search the site",
		],
		[
			"a placeholder when nothing else names a field",
			`<input id="subject" placeholder="Email">`,
			"Email",
		],
		["the value of a submit input", `<input id="subject" type="submit" value="Save">`, "Save"],
		["the default name of a submit input", `<input id="subject" type="submit">`, "Submit"],
		["the default name of a reset input", `<input id="subject" type="reset">`, "Reset"],
		["the value of a button input", `<input id="subject" type="button" value="Open">`, "Open"],
		[
			"the alt of an image input",
			`<input id="subject" type="image" alt="Search" src="s.png">`,
			"Search",
		],
		["the alt of an image", `<img id="subject" src="x" alt="A cat">`, "A cat"],
		[
			"the alt of an image inside a link",
			`<a id="subject" href="/"><img src="x" alt="Home"></a>`,
			"Home",
		],
		["the title of an image without alt", `<img id="subject" src="x" title="A dog">`, "A dog"],
		[
			"the legend of a fieldset",
			`<fieldset id="subject"><legend>Shipping</legend><input></fieldset>`,
			"Shipping",
		],
		[
			"the caption of a table",
			`<table id="subject"><caption>Fees</caption><tr><td>1</td></tr></table>`,
			"Fees",
		],
		[
			"the figcaption of a figure",
			`<figure id="subject"><img src="x" alt="Chart"><figcaption>Growth</figcaption></figure>`,
			"Growth",
		],
		["the title of an svg", `<svg id="subject"><title>Logo</title></svg>`, "Logo"],
		[
			"the title attribute as a last resort",
			`<div id="subject" role="region" title="Notes"></div>`,
			"Notes",
		],
	])("names a control by %s", (_, markup, name) => {
		expect(accessibleName(subject(markup))).toBe(name);
	});

	test.each([
		["hidden content", `<button id="subject">Save <span hidden>draft</span></button>`, "Save"],
		[
			"aria-hidden content",
			`<button id="subject">Save <span aria-hidden="true">✓</span></button>`,
			"Save",
		],
		[
			"display none",
			`<button id="subject">Save <span style="display: none">draft</span></button>`,
			"Save",
		],
		[
			"visibility hidden",
			`<button id="subject">Save <span style="visibility:hidden">draft</span></button>`,
			"Save",
		],
		[
			"scripts and styles",
			`<button id="subject">Save<script>x()</script><style>b{}</style></button>`,
			"Save",
		],
	])("leaves out %s", (_, markup, name) => {
		expect(accessibleName(subject(markup))).toBe(name);
	});

	test.each([
		["a generic wrapper", `<div id="subject">Some text</div>`],
		["a paragraph", `<p id="subject">Some text</p>`],
		["a list", `<ul id="subject"><li>One</li></ul>`],
		["an unlabelled field", `<input id="subject">`],
		["an image with empty alt", `<img id="subject" src="x" alt="">`],
		["a form without a name", `<form id="subject"><button>Go</button></form>`],
	])("gives %s no name", (_, markup) => {
		expect(accessibleName(subject(markup))).toBe("");
	});

	test("ends when a label wraps another control it also names", () => {
		let markup = `<label>Agree <input type="checkbox"> to <input id="subject" type="checkbox"> terms</label>`;
		expect(accessibleName(subject(markup))).toBe("Agree to terms");
	});
});
