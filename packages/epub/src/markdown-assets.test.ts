/**
 * Checks how stylesheet `url()` values are listed and rewritten, including that unfinished
 * `url(` openers still cost linear time so a long adversarial stylesheet cannot stall the build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { cssReferences, rewriteCss } from "./markdown-assets.js";

describe("cssReferences", () => {
	test("lists quoted, bare and spaced file urls in order, skipping fragments and data urls", () => {
		expect(
			cssReferences(
				[
					'a { b: url( "../images/x.png" ) }',
					"a { b: url('../images/y.png') }",
					"a { b: url(../images/z.png) }",
					"a { b: url(#frag) }",
					"a { b: url(data:image/png;base64,abc) }",
					"a { b: url() }",
				].join("\n"),
			),
		).toEqual(["../images/x.png", "../images/y.png", "../images/z.png"]);
	});

	test("reads thousands of unfinished url(! openers in linear time", () => {
		let css = "url(!".repeat(50_000);

		let started = performance.now();
		let references = cssReferences(css);

		expect(performance.now() - started).toBeLessThan(500);
		expect(references).toEqual([]);
	});
});

describe("rewriteCss", () => {
	test("rewrites file urls to double-quoted paths and leaves the rest alone", () => {
		expect(
			rewriteCss(
				"body { background: url(../images/x.png); mask: url(#frag); content: url(data:x); }",
				(reference) => `assets/${reference.replaceAll("../", "")}`,
			),
		).toBe(
			'body { background: url("assets/images/x.png"); mask: url(#frag); content: url(data:x); }',
		);
	});

	test("keeps a url() when rewrite answers undefined", () => {
		expect(rewriteCss('a { b: url("keep.png") }', () => undefined)).toBe(
			'a { b: url("keep.png") }',
		);
	});

	test("rewrites thousands of unfinished url(! openers in linear time", () => {
		let css = "url(!".repeat(50_000);

		let started = performance.now();
		let rewritten = rewriteCss(css, () => "x.png");

		expect(performance.now() - started).toBeLessThan(500);
		expect(rewritten).toBe(css);
	});
});
