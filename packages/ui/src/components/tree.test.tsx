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

import { Tree } from "./tree.js";

describe("Tree.ExpandButton", () => {
	test("renders as decoration, so the summary it sits in keeps the activation", async () => {
		let html = await renderToString(<Tree.ExpandButton />);

		/* A button here would take the click for itself and leave the branch closed. */
		expect(html).not.toContain("<button");
		expect(html).toContain("<span");
	});

	test("is hidden from the accessibility tree, which the row already speaks for", async () => {
		let html = await renderToString(<Tree.ExpandButton />);

		expect(html).toContain('aria-hidden="true"');
	});
});
