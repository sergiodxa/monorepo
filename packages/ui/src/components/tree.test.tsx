/**
 * Tests for the `type` {@link Tree.ExpandButton} writes: an explicit
 * `type="button"`, positioned before the consumer's own attributes, without
 * which the platform refuses to run an Invoker Command the chevron carries
 * inside a `<form>` — it decides whether the pairing is ambiguous while it
 * parses `command`/`commandfor` and never sees a `type` serialized after them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { Tree } from "./tree";

describe("Tree.ExpandButton", () => {
	test('types itself "button", so its command survives inside a form', async () => {
		let html = await renderToString(<Tree.ExpandButton aria-label="Expand" />);

		expect(html).toContain('type="button"');
	});

	test("writes type before the command attributes, which is where the platform reads it", async () => {
		let html = await renderToString(
			<Tree.ExpandButton aria-label="Expand" commandfor="src-folder" command="toggle" />,
		);

		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});
});
