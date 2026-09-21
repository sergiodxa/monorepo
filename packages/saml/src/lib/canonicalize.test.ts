/**
 * Pins the canonical form against the cases exclusive canonicalization exists
 * to decide: which ancestor namespaces come down, which redundant declarations
 * go away, and the orders and escapes a digest depends on byte for byte.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { describe, expect, test } from "vitest";

import type { Element } from "./tree.js";

import { canonicalize } from "./canonicalize.js";
import { locate, walk } from "./tree.js";

/**
 * Parses a source the way verification does and locates its tree, so a test
 * measures the same bytes the verifier would.
 */
function parse(source: string): Element {
	let result = XML.parse(source, { whitespace: "preserve" });
	if (isFailure(result)) throw result.error;
	return locate(result.data.root);
}

/**
 * The first element in a document carrying one local name, which is how these
 * tests name the subtree they canonicalize.
 */
function named(root: Element, local: string): Element {
	for (let element of walk(root)) {
		if (element.local === local) return element;
	}
	throw new Error(`No element named ${local}`);
}

describe("canonicalize", () => {
	test("writes an empty element with both tags", () => {
		expect(canonicalize(parse("<a/>"))).toBe("<a></a>");
	});

	test("drops an ancestor namespace nothing in the subtree uses", () => {
		let root = parse(`<root xmlns:a="urn:a" xmlns:b="urn:b"><a:child/></root>`);
		expect(canonicalize(named(root, "child"))).toBe(`<a:child xmlns:a="urn:a"></a:child>`);
	});

	test("brings a used ancestor namespace down to the apex", () => {
		let root = parse(`<root xmlns:a="urn:a"><a:child><a:grand/></a:child></root>`);
		expect(canonicalize(named(root, "child"))).toBe(
			`<a:child xmlns:a="urn:a"><a:grand></a:grand></a:child>`,
		);
	});

	test("drops a descendant declaration repeating what is already in force", () => {
		let root = parse(`<root xmlns:a="urn:a"><a:child><a:grand xmlns:a="urn:a"/></a:child></root>`);
		expect(canonicalize(named(root, "child"))).toBe(
			`<a:child xmlns:a="urn:a"><a:grand></a:grand></a:child>`,
		);
	});

	test("keeps a descendant declaration that rebinds a prefix", () => {
		let root = parse(`<root xmlns:a="urn:a"><a:child><a:grand xmlns:a="urn:z"/></a:child></root>`);
		expect(canonicalize(named(root, "child"))).toBe(
			`<a:child xmlns:a="urn:a"><a:grand xmlns:a="urn:z"></a:grand></a:child>`,
		);
	});

	test("renders a prefix the inclusive list names even where nothing uses it", () => {
		let root = parse(`<root xmlns:a="urn:a" xmlns:b="urn:b"><a:child/></root>`);
		expect(canonicalize(named(root, "child"), { inclusivePrefixes: new Set(["b"]) })).toBe(
			`<a:child xmlns:a="urn:a" xmlns:b="urn:b"></a:child>`,
		);
	});

	test("reads #default in the inclusive list as the default namespace", () => {
		let root = parse(`<root xmlns="urn:d" xmlns:a="urn:a"><a:child/></root>`);
		expect(canonicalize(named(root, "child"), { inclusivePrefixes: new Set(["#default"]) })).toBe(
			`<a:child xmlns="urn:d" xmlns:a="urn:a"></a:child>`,
		);
	});

	test("undeclares the default namespace where an ancestor rendered one", () => {
		expect(canonicalize(parse(`<a xmlns="urn:x"><b xmlns=""/></a>`))).toBe(
			`<a xmlns="urn:x"><b xmlns=""></b></a>`,
		);
	});

	test("leaves the default namespace alone where no ancestor rendered one", () => {
		expect(canonicalize(parse(`<a><b xmlns=""/></a>`))).toBe(`<a><b></b></a>`);
	});

	test("orders declarations by prefix with the default first", () => {
		expect(
			canonicalize(parse(`<p:e xmlns:z="urn:z" xmlns:p="urn:p" xmlns="urn:d" z:k="1"/>`)),
		).toBe(`<p:e xmlns:p="urn:p" xmlns:z="urn:z" z:k="1"></p:e>`);
	});

	test("orders attributes by namespace, then by local name", () => {
		expect(canonicalize(parse(`<e z="1" a="2" xmlns:p="urn:p" p:b="3" p:a="4"/>`))).toBe(
			`<e xmlns:p="urn:p" a="2" z="1" p:a="4" p:b="3"></e>`,
		);
	});

	test("keeps an xml-prefixed attribute without ever declaring the prefix", () => {
		expect(canonicalize(parse(`<e xmlns:x="urn:x" xml:lang="en" x:k="v"/>`))).toBe(
			`<e xmlns:x="urn:x" xml:lang="en" x:k="v"></e>`,
		);
	});

	test("leaves an ancestor's xml-prefixed attribute behind", () => {
		let root = parse(`<root xml:lang="en"><child/></root>`);
		expect(canonicalize(named(root, "child"))).toBe("<child></child>");
	});

	test("escapes the characters a re-parse would read back differently", () => {
		expect(canonicalize(parse(`<e k="a&amp;b&lt;c&#34;d&#9;e">x&amp;y&lt;z&gt;w</e>`))).toBe(
			`<e k="a&amp;b&lt;c&quot;d&#x9;e">x&amp;y&lt;z&gt;w</e>`,
		);
	});

	test("keeps the whitespace between elements", () => {
		expect(canonicalize(parse("<a>\n\t<b>x</b>\n</a>"))).toBe("<a>\n\t<b>x</b>\n</a>");
	});

	test("writes a CDATA section as the text it stands for", () => {
		expect(canonicalize(parse(`<a><![CDATA[<b>&]]></a>`))).toBe("<a>&lt;b&gt;&amp;</a>");
	});

	test("leaves out the omitted element and everything beneath it", () => {
		let root = parse(`<a><sig><deep/></sig><b>x</b></a>`);
		expect(canonicalize(root, { omit: named(root, "sig") })).toBe("<a><b>x</b></a>");
	});

	test("keeps the text around an omitted element", () => {
		let root = parse("<a>\n\t<sig/>\n\t<b>x</b>\n</a>");
		expect(canonicalize(root, { omit: named(root, "sig") })).toBe("<a>\n\t\n\t<b>x</b>\n</a>");
	});

	test("renders a sibling's declaration even after another branch rendered it", () => {
		let root = parse(`<root xmlns:a="urn:a"><a:one/><a:two/></root>`);
		expect(canonicalize(named(root, "root"))).toBe(
			`<root><a:one xmlns:a="urn:a"></a:one><a:two xmlns:a="urn:a"></a:two></root>`,
		);
	});
});
