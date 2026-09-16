/**
 * Checks what survives sanitization: the allow-list of elements and attributes, the
 * subtrees that leave with their text, the URLs a browser may resolve, and the two
 * rules that bound what loading a publisher's image tells that publisher.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { sanitize } from "./sanitize.js";

/** Sanitizes a fragment and answers with the markup, failing the test on a refusal. */
function clean(source: string, baseUrl?: string): string {
	let result = sanitize(source, { baseUrl });
	if (isFailure(result)) throw result.error;
	return result.data;
}

describe("sanitize", () => {
	test("keeps the elements an article is written with", () => {
		let markup = clean(`<h1>Title</h1><p>A <strong>word</strong> and a <em>word</em>.</p>`);
		expect(markup).toBe(`<h1>Title</h1><p>A <strong>word</strong> and a <em>word</em>.</p>`);
	});

	test("drops a script with its text", () => {
		let markup = clean(`<p>Before</p><script>alert("x")</script><p>After</p>`);
		expect(markup).toBe(`<p>Before</p><p>After</p>`);
		expect(markup).not.toContain("alert");
	});

	test("drops a style, an iframe and a form with their subtrees", () => {
		let markup = clean(
			`<style>.a{color:red}</style><iframe src="https://ads.example/x">fallback</iframe><form action="/pay"><input name="card"><button>Pay</button></form><p>Body</p>`,
		);
		expect(markup).toBe(`<p>Body</p>`);
		expect(markup).not.toContain("color:red");
		expect(markup).not.toContain("fallback");
		expect(markup).not.toContain("card");
	});

	test("drops every event handler", () => {
		let markup = clean(`<p onclick="steal()" onmouseover="steal()">Body</p>`);
		expect(markup).toBe(`<p>Body</p>`);
	});

	test("drops class, id and style attributes", () => {
		let markup = clean(`<p class="lede" id="first" style="color:red">Body</p>`);
		expect(markup).toBe(`<p>Body</p>`);
	});

	test("drops a javascript: href and keeps the link", () => {
		let markup = clean(`<a href="javascript:alert(1)">Click</a>`);
		expect(markup).toBe(`<a>Click</a>`);
	});

	test("drops a data: src and keeps the image", () => {
		let markup = clean(`<img src="data:image/svg+xml,<svg onload=alert(1)>" alt="x">`);
		expect(markup).toBe(`<img alt="x" referrerpolicy="no-referrer" loading="lazy">`);
	});

	test.each([
		["blob:https://example.com/abcd", "href"],
		["vbscript:msgbox(1)", "href"],
		["javascript:alert(1)", "src"],
	])("refuses %s on %s", (url, attribute) => {
		let markup =
			attribute === "href" ? clean(`<a href="${url}">x</a>`) : clean(`<img src="${url}">`);
		expect(markup).not.toContain(url);
	});

	test("keeps http, https and a mailto link", () => {
		let markup = clean(
			`<a href="http://example.com/a">a</a><a href="https://example.com/b">b</a><a href="mailto:hi@example.com">c</a>`,
		);
		expect(markup).toContain(`href="http://example.com/a"`);
		expect(markup).toContain(`href="https://example.com/b"`);
		expect(markup).toContain(`href="mailto:hi@example.com"`);
	});

	test("resolves a relative URL against the supplied base", () => {
		let markup = clean(
			`<a href="/about">About</a><img src="../img/a.png" alt="a">`,
			"https://publisher.example/posts/one",
		);
		expect(markup).toContain(`href="https://publisher.example/about"`);
		expect(markup).toContain(`src="https://publisher.example/img/a.png"`);
		expect(markup).not.toContain(`href="/about"`);
	});

	test("resolves a relative URL against the base rather than another origin", () => {
		let markup = clean(`<a href="/session">x</a>`, "https://publisher.example/posts/one");
		expect(markup).toContain("https://publisher.example/session");
		expect(markup).not.toContain("reader.example");
	});

	test("drops a relative URL when no base is given", () => {
		expect(clean(`<a href="/about">About</a>`)).toBe(`<a>About</a>`);
	});

	test("gives every surviving image no-referrer and lazy loading", () => {
		let markup = clean(`<img src="https://publisher.example/a.png" alt="a" width="600">`);
		expect(markup).toBe(
			`<img src="https://publisher.example/a.png" alt="a" width="600" referrerpolicy="no-referrer" loading="lazy">`,
		);
	});

	test.each(["width", "height"])("drops an image declaring a %s of 1", (side) => {
		let markup = clean(`<p>Body</p><img src="https://t.example/p.gif" ${side}="1">`);
		expect(markup).toBe(`<p>Body</p>`);
	});

	test("unwraps an unknown element and keeps its text", () => {
		let markup = clean(`<div class="wrap"><section><p>Body</p></section></div><span>Tail</span>`);
		expect(markup).toBe(`<p>Body</p>Tail`);
	});

	test("keeps colspan, rowspan, datetime, lang and dir", () => {
		let markup = clean(
			`<table><tbody><tr><td colspan="2" rowspan="3" class="x">Cell</td></tr></tbody></table><time datetime="2026-09-16">then</time><p lang="es" dir="rtl">Hola</p>`,
		);
		expect(markup).toContain(`<td colspan="2" rowspan="3">Cell</td>`);
		expect(markup).toContain(`<time datetime="2026-09-16">then</time>`);
		expect(markup).toContain(`<p lang="es" dir="rtl">Hola</p>`);
	});

	test("emits void elements without a closing tag", () => {
		expect(clean(`<p>a<br>b</p><hr>`)).toBe(`<p>a<br>b</p><hr>`);
	});

	test("escapes text and attribute values", () => {
		let markup = clean(
			`<p>5 &lt; 6 &amp; 7 &gt; 6</p><img src="https://a.example/a.png" alt='He said "hi" &amp; left'>`,
		);
		expect(markup).toContain(`<p>5 &lt; 6 &amp; 7 &gt; 6</p>`);
		expect(markup).toContain(`alt="He said &quot;hi&quot; &amp; left"`);
	});

	test("refuses a source carrying no markup", () => {
		let result = sanitize("   ");
		expect(isFailure(result)).toBe(true);
	});
});
