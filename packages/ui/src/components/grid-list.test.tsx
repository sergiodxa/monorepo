/**
 * Tests for the `type` {@link GridList.DragHandle} writes: an explicit
 * `type="button"`, positioned before the consumer's own attributes, without
 * which the platform refuses to run an Invoker Command the handle carries
 * inside a `<form>` — it decides whether the pairing is ambiguous while it
 * parses `command`/`commandfor` and never sees a `type` serialized after them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { renderToString } from "remix/ui/server";

import { GridList } from "./grid-list";

describe("GridList.DragHandle", () => {
	test('types itself "button", so its command survives inside a form', async () => {
		let html = await renderToString(<GridList.DragHandle aria-label="Reorder" />);

		expect(html).toContain('type="button"');
	});

	test("writes type before the command attributes, which is where the platform reads it", async () => {
		let html = await renderToString(
			<GridList.DragHandle aria-label="Reorder" commandfor="playlist" command="reorder" />,
		);

		// Presence is not enough: the ambiguity check runs while `command`/`commandfor`
		// are parsed, so a `type` serialized after them is not seen and the command is
		// refused. Both attributes have to come after it.
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("commandfor="));
		expect(html.indexOf('type="button"')).toBeLessThan(html.indexOf("command="));
	});
});
