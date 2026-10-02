/**
 * Exercises the template helpers by rendering them: `mf()` beside `css()` on one host,
 * through a component forwarding `mix`, `MicroTime`'s markup, the class-name unions as
 * type tests, and a rendered entry read back by this package's own parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, Props, RemixNode } from "remix/component";

import { unwrap } from "@sdxc/result";
import { css } from "remix/component";
import { renderToString } from "remix/component/server";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { MF2UI } from "./ui.js";

import { classes, MicroTime, mf } from "./ui.js";

import { findItem, parse } from "./index.js";

/** A component that forwards `mix` to its host, as design-system links do. */
function Link(handle: Handle<Props<"a"> & { children?: RemixNode }>) {
	return () => {
		let { children, ...rest } = handle.props;
		return <a {...rest}>{children}</a>;
	};
}

/** The value of every `class` attribute in rendered markup, in order. */
function classAttributes(html: string): string[] {
	return [...html.matchAll(/class="([^"]*)"/gu)].map((match) => match[1] ?? "");
}

describe(mf, () => {
	test("adds its tokens beside the class a css() mixin generates", async () => {
		let html = await renderToString(
			<article mix={[css({ padding: 16 }), mf("h-entry")]}>Hi</article>,
		);

		let [value = ""] = classAttributes(html);
		expect(value.split(" ")).toContain("h-entry");
		expect(value.split(" ").length).toBe(2);
	});

	test("keeps the class the host already has", async () => {
		let html = await renderToString(
			<div className="card" mix={[mf("p-author", "h-card")]}>
				Ada
			</div>,
		);

		expect(classAttributes(html)).toEqual(["card p-author h-card"]);
	});

	test("keeps a class written with the class prop", async () => {
		let html = await renderToString(
			<div class="card" mix={[mf("h-card")]}>
				Ada
			</div>,
		);

		expect(classAttributes(html)).toEqual(["card h-card"]);
	});

	test("reaches the host through a component forwarding mix", async () => {
		let html = await renderToString(
			<Link href="/" mix={[mf("u-url", "u-uid")]}>
				home
			</Link>,
		);

		expect(classAttributes(html)).toEqual(["u-url u-uid"]);
	});

	test("accepts the vocabularies and the -x- escape, and rejects the rest", () => {
		expectTypeOf<"h-entry">().toExtend<MF2UI.ClassName>();
		expectTypeOf<"u-in-reply-to">().toExtend<MF2UI.ClassName>();
		expectTypeOf<"p-x-mood">().toExtend<MF2UI.ClassName>();
		expectTypeOf<"p-in-reply-to">().not.toExtend<MF2UI.ClassName>();
		expectTypeOf<"hentry">().not.toExtend<MF2UI.ClassName>();

		// @ts-expect-error -- a response property is a URL, so p-in-reply-to is a typo
		mf("p-in-reply-to");
		// @ts-expect-error -- classic roots are read, never written
		classes("hentry");
	});
});

describe(classes, () => {
	test("joins the tokens once each", () => {
		expect(classes("p-author", "h-card", "p-author")).toBe("p-author h-card");
	});
});

describe(MicroTime, () => {
	test("renders a time with the property class and the ISO instant", async () => {
		let value = new Date("2026-09-23T13:15:00Z");

		let html = await renderToString(
			<MicroTime property="dt-published" value={value}>
				yesterday
			</MicroTime>,
		);

		expect(html).toBe(
			'<time class="dt-published" datetime="2026-09-23T13:15:00.000Z">yesterday</time>',
		);
	});

	test("shows the ISO instant when given no children", async () => {
		let html = await renderToString(
			<MicroTime property="dt-updated" value={new Date("2026-09-23T13:15:00Z")} />,
		);

		expect(html).toContain(">2026-09-23T13:15:00.000Z</time>");
	});
});

test("a rendered entry reads back through the parser", async () => {
	let html = await renderToString(
		<article mix={[mf("h-entry"), css({ padding: 16 })]}>
			<h1 mix={[mf("p-name")]}>Some post</h1>
			<Link href="https://sergiodxa.com/articles/some-slug" mix={[mf("u-url", "u-uid")]}>
				<MicroTime property="dt-published" value={new Date("2026-09-23T13:15:00Z")}>
					September 23
				</MicroTime>
			</Link>
			<Link href="https://sergiodxa.com" mix={[mf("p-author", "h-card")]}>
				Sergio Xalambrí
			</Link>
			<div mix={[mf("e-content")]}>
				<p>Hello.</p>
			</div>
		</article>,
	);

	let entry = findItem(unwrap(parse(html, "https://sergiodxa.com/articles/some-slug")), "h-entry");

	expect(entry?.properties).toEqual({
		name: ["Some post"],
		url: ["https://sergiodxa.com/articles/some-slug"],
		uid: ["https://sergiodxa.com/articles/some-slug"],
		published: ["2026-09-23T13:15:00.000Z"],
		author: [
			{
				type: ["h-card"],
				value: "Sergio Xalambrí",
				properties: { name: ["Sergio Xalambrí"], url: ["https://sergiodxa.com"] },
			},
		],
		content: [{ html: "<p>Hello.</p>", value: "Hello." }],
	});
});
