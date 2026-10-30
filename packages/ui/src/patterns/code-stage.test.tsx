/**
 * Covers {@link CodeStage}'s surfaces, unwrapped lines, the slab variant and
 * counter-numbered lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { CodeStage } from "./code-stage.js";

describe("CodeStage", () => {
	test("draws the raised marketing surface and keeps lines whole", async () => {
		let html = await renderToString(<CodeStage title="install.sh">bun add @sdxc/ui</CodeStage>);

		expect(html).toContain("background-color: var(--ui-surface-raised, Canvas)");
		expect(html).toContain("box-shadow: var(--ui-shadow-surface");
		expect(html).toContain("white-space: pre;");
		expect(html).not.toContain("pre-wrap");
		expect(html).toContain("overflow-x: auto");
	});

	test("sets a slab dark in both schemes around a translucent sheet", async () => {
		let html = await renderToString(<CodeStage variant="slab">bun add @sdxc/ui</CodeStage>);

		expect(html).toContain('data-variant="slab"');
		expect(html).toContain("padding: 4px");
		expect(html).toContain("background-color: rgb(255 255 255 / 0.08)");
		expect(html).toContain("box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1)");
		expect(html).toContain("font-size: 0.8125rem");
		expect(html).toContain("line-height: 1.5rem");
	});

	test("numbers each line of a string child and drops a trailing newline", async () => {
		let html = await renderToString(
			<CodeStage variant="slab" lineNumbers>
				{"import { Button } from '@sdxc/ui';\n\nexport default Button;\n"}
			</CodeStage>,
		);

		expect(html).toContain('data-line-numbers="true"');
		expect(html.match(/<span data-line="">/g)).toHaveLength(3);
		expect(html).toContain("counter-increment: line");
		expect(html).toContain("content: counter(line)");
	});

	test("renders element children unnumbered", async () => {
		let html = await renderToString(
			<CodeStage lineNumbers>
				<span>bun add</span>
			</CodeStage>,
		);

		expect(html).not.toContain("data-line");
		expect(html).toContain("<span>bun add</span>");
	});
});
