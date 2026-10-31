/**
 * Lays {@link CodeBlock} out in a real browser: marked lines tint the full scroll width
 * without moving their text, the copy button writes what a reader should paste and
 * announces it, the header names the file, and a long line scrolls inside the card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CodeBlock } from "./code-block.js";

import "../theme.css";

/** The copy strings every block in these tests carries. */
const LABELS = { copy: "Copy code", copied: "Copied" };

/** Hosts mounted by a test, removed after it so layout never leaks between cases. */
let hosts: HTMLElement[] = [];

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
	vi.restoreAllMocks();
});

/** Mounts `node` in a column `width` pixels wide and returns the block. */
function mount(node: RemixNode, width = 640): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.setProperty("--ui-brand-fg", "rgb(37 99 235)");
	document.body.appendChild(host);
	hosts.push(host);
	render(node, { container: host });
	return host.querySelector<HTMLElement>('[data-slot="code-block"]')!;
}

/** Left edge of the first non-whitespace glyph under `element`. */
function inkLeft(element: Element): number {
	let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		let offset = node.textContent!.search(/\S/);
		if (offset < 0) continue;
		let range = document.createRange();
		range.setStart(node, offset);
		range.setEnd(node, offset + 1);
		return range.getBoundingClientRect().left;
	}
	return Number.NaN;
}

/** Clicks the block's copy button and resolves with the text it wrote. */
async function copy(block: HTMLElement): Promise<string> {
	let write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
	let button = block.querySelector<HTMLButtonElement>('[data-slot="copy-button"]')!;
	let copied = new Promise<void>((resolve) => {
		button.addEventListener("ui:copy", () => resolve(), { once: true });
	});
	button.click();
	await copied;
	return String(write.mock.calls[0]?.[0]);
}

describe("CodeBlock", () => {
	test("tints a marked line across the full scroll width without moving its text", () => {
		let code = `import { defineConfig } from "vite";\nexport default defineConfig({ plugins: [remix(), anotherPluginWithAVeryLongNameThatOverflows()] });\nconsole.log("done");`;
		let block = mount(
			<CodeBlock
				title="vite.config.ts"
				language="ts"
				code={code}
				highlight={[3]}
				add={[1]}
				labels={LABELS}
			/>,
			360,
		);
		let pre = block.querySelector("pre")!;
		let lines = [...block.querySelectorAll<HTMLElement>("[data-line]")];

		expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth);
		expect(lines[2]!.getBoundingClientRect().width).toBeCloseTo(pre.scrollWidth, 0);
		expect(lines[0]!.getBoundingClientRect().width).toBeCloseTo(pre.scrollWidth, 0);

		let marked = getComputedStyle(lines[2]!);
		expect(marked.borderInlineStartWidth).toBe("2px");
		expect(marked.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(inkLeft(lines[2]!)).toBeCloseTo(inkLeft(lines[1]!), 1);
		expect(inkLeft(lines[0]!)).toBeCloseTo(inkLeft(lines[1]!), 1);
	});

	test("draws no empty last line when painted tokens end in a newline", () => {
		let block = mount(
			<CodeBlock
				language="sh"
				code={"npm add remix\n"}
				tokens={[
					{ type: "function", value: "npm" },
					{ type: "plain", value: " add remix\n" },
				]}
				labels={LABELS}
			/>,
		);

		expect(block.querySelectorAll("[data-line]")).toHaveLength(1);
	});

	test("keeps an empty line one line tall", () => {
		let block = mount(
			<CodeBlock language="ts" code={"let a = 1;\n\nlet b = 2;"} labels={LABELS} />,
		);
		let lines = block.querySelectorAll<HTMLElement>("[data-line]");
		expect(lines[1]!.getBoundingClientRect().height).toBeCloseTo(
			lines[0]!.getBoundingClientRect().height,
			0,
		);
		expect(block.querySelector("pre")!.getBoundingClientRect().height).toBeGreaterThan(3 * 20);
	});

	test("copies a shell session without prompts or output and announces it", async () => {
		let code = "$ npm add @sdxc/ui \\\n  @sdxc/u\nadded 2 packages\n$ npm run dev";
		let block = mount(<CodeBlock title="Terminal" language="sh" code={code} labels={LABELS} />);

		expect(block.querySelector("code")!.textContent).not.toContain("$");
		expect(await copy(block)).toBe("npm add @sdxc/ui \\\n  @sdxc/u\nnpm run dev");

		let button = block.querySelector<HTMLButtonElement>('[data-slot="copy-button"]')!;
		expect(button.hasAttribute("data-copied")).toBe(true);
		expect(button.querySelector('[role="status"]')!.textContent).toBe("Copied");
		expect(getComputedStyle(button.querySelector('[data-icon="check"]')!).display).not.toBe("none");
		expect(getComputedStyle(button.querySelector('[data-icon="copy"]')!).display).toBe("none");
	});

	test("draws the prompt before each command, outside the selectable text", () => {
		let block = mount(<CodeBlock language="sh" code="$ bun install" labels={LABELS} />);
		let prompt = block.querySelector("[data-prompt]")!;
		expect(getComputedStyle(prompt, "::before").content).toBe('"$ "');
		expect(getComputedStyle(prompt, "::before").userSelect).toBe("none");
	});

	test("copies the file a diff produces, without its removed lines", async () => {
		let code = "let a = 1;\nlet b = 2;\nlet c = 3;";
		let block = mount(
			<CodeBlock language="ts" code={code} remove={[2]} add={[3]} lineNumbers labels={LABELS} />,
		);
		expect(await copy(block)).toBe("let a = 1;\nlet c = 3;");
	});

	test("names the file in the header and the language when untitled", () => {
		let titled = mount(
			<CodeBlock title="app/routes.ts" language="ts" code="export {};" labels={LABELS} />,
		);
		expect(titled.querySelector("figcaption")!.textContent).toBe("app/routes.ts");
		expect(titled.querySelector('[data-slot="code-block-icon"] svg')).not.toBeNull();

		let untitled = mount(<CodeBlock language="json" code="{}" labels={LABELS} />);
		expect(untitled.querySelector("figcaption")!.textContent).toBe("json");

		let bare = mount(<CodeBlock code="plain text" labels={LABELS} />);
		expect(bare.querySelector("figcaption")).toBeNull();
		expect(bare.querySelector('[data-slot="copy-button"]')).not.toBeNull();
	});

	test("numbers lines in a gutter the copy leaves out", async () => {
		let block = mount(<CodeBlock language="ts" code={"a();\nb();"} lineNumbers labels={LABELS} />);
		let line = block.querySelector("[data-line]")!;
		expect(getComputedStyle(line, "::before").content).toBe("counter(line)");
		expect(await copy(block)).toBe("a();\nb();");
	});

	test("scrolls a long line inside the card at 320px instead of widening the page", () => {
		let code = `$ npx some-very-long-command --with-a-flag --and-another-flag --and-one-more-for-good-measure`;
		let block = mount(
			<CodeBlock title="Terminal" language="sh" code={code} labels={LABELS} />,
			320,
		);
		let pre = block.querySelector("pre")!;
		expect(block.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
