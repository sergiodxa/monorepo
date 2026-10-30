/**
 * Covers {@link CodeStage}'s surfaces, unwrapped lines, the slab variant,
 * counter-numbered lines, highlighted tokens and radio-driven file tabs.
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

	test("highlights a string child as tokens the shared stylesheet colors", async () => {
		let html = await renderToString(<CodeStage language="ts">{"let total = 1; // sum"}</CodeStage>);

		expect(html).toContain('<span class="token keyword ');
		expect(html).toContain('<span class="token comment ');
		expect(html).toContain("var(--highlight-keyword, light-dark(#d73a49, #ff7b72))");
	});

	test("numbers highlighted lines and splits a token that spans lines", async () => {
		let html = await renderToString(
			<CodeStage language="ts" lineNumbers>
				{"/* one\ntwo */\nlet a = 1;\n"}
			</CodeStage>,
		);
		let lines = html.match(/<span data-line="">.*?<\/span><\/span>(?=\n|<\/pre>)/gs) ?? [];

		expect(html.match(/<span data-line="">/g)).toHaveLength(3);
		expect(lines[0]).toContain('class="token comment ');
		expect(lines[0]).toContain("/* one");
		expect(lines[1]).toContain('class="token comment ');
		expect(lines[1]).toContain("two */");
		expect(lines[2]).toContain('class="token keyword ');
	});

	test("keeps plain string children unhighlighted without a language", async () => {
		let html = await renderToString(<CodeStage>{"let total = 1;"}</CodeStage>);

		expect(html).not.toContain("token");
		expect(html).toContain("let total = 1;");
	});

	test("renders file tabs as a radio group with the first file selected", async () => {
		let html = await renderToString(
			<CodeStage
				name="files"
				tabs={[
					{ label: "worker.ts", content: "export default {};", language: "ts" },
					{ label: "wrangler.jsonc", content: '{ "name": "app" }', language: "jsonc" },
				]}
			/>,
		);

		expect(html.match(/type="radio"/g)).toHaveLength(2);
		expect(html.match(/name="files"/g)).toHaveLength(2);
		expect(html).toContain('id="files-tab-0"');
		expect(html.match(/<input[^>]*checked/g)).toHaveLength(1);
		expect(html.match(/data-slot="code-stage-panel"/g)).toHaveLength(2);
		expect(html).toContain("visibility: hidden");
	});
});
