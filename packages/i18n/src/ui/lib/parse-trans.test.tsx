/**
 * Tests `parseTrans`'s tag-splicing and unmatched-tag fallback behavior.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/ui";

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { parseTrans } from "./parse-trans";

namespace Wrap {
	export interface Props {
		translation: string;
		components?: Record<string, RemixElement>;
	}
}

function Wrap(handle: Handle<Wrap.Props>) {
	return () => <div>{parseTrans(handle.props.translation, handle.props.components ?? {})}</div>;
}

describe(parseTrans, () => {
	test("renders plain text with no tags unchanged", async () => {
		let html = await renderToString(<Wrap translation="Hello there" />);
		expect(html).toBe("<div>Hello there</div>");
	});

	test("splices a components entry in for a matching tag, keeping the tag's text as its children", async () => {
		let html = await renderToString(
			<Wrap translation="Hello <0>Bob</0>" components={{ "0": <b /> }} />,
		);
		expect(html).toBe("<div>Hello <b>Bob</b></div>");
	});

	test("supports named tags nested inside one another", async () => {
		let html = await renderToString(
			<Wrap
				translation="Click <articleLink>here <b>now</b></articleLink>"
				components={{ articleLink: <a href="/">placeholder</a>, b: <strong /> }}
			/>,
		);
		expect(html).toBe('<div>Click <a href="/">here <strong>now</strong></a></div>');
	});

	test("renders an unmatched tag's children unwrapped instead of dropping them", async () => {
		let html = await renderToString(<Wrap translation="Look <foo>here</foo>" components={{}} />);
		expect(html).toBe("<div>Look here</div>");
	});

	test("supports a void element with no closing tag", async () => {
		let html = await renderToString(
			<Wrap translation="Before<br/>After" components={{ br: <br /> }} />,
		);
		expect(html).toBe("<div>Before<br />After</div>");
	});
});
