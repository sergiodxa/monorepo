/**
 * Drives {@link CodeTabs} and {@link InstallCommand} in a real browser: a set switches
 * panels on its radios alone, sets sharing a sync key switch together and come back on
 * the remembered choice, the stack keeps one height, and nothing overflows at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { CodeBlock } from "./code-block.js";
import { CodeTabs } from "./code-tabs.js";
import { InstallCommand, installLine } from "./install-command.js";
import { codeTabsStorageKey, readCodeTabsCookie } from "./mixins/code-tabs-sync.js";

import "../theme.css";

/** The copy strings every block in these tests carries. */
const LABELS = { copy: "Copy code", copied: "Copied" };

/** The sync key the synced cases share; unique so no other test's storage leaks in. */
const SYNC_KEY = "test-package-manager";

/** Mounted trees and their hosts, removed after each case. */
let mounted: Array<{ result: RenderResult; host: HTMLElement }> = [];

beforeEach(() => {
	localStorage.removeItem(codeTabsStorageKey(SYNC_KEY));
	document.cookie = `${codeTabsStorageKey(SYNC_KEY)}=; path=/; max-age=0`;
});

afterEach(() => {
	for (let { host, result } of mounted) {
		result.cleanup();
		host.remove();
	}
	mounted = [];
});

/** Mounts `node` in a column `width` pixels wide and returns its host. */
function mount(node: RemixNode, width = 640): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted.push({ result: render(node, { container: host }), host });
	return host;
}

/** Unmounts everything mounted so far, the way leaving the page would. */
function leave() {
	for (let { host, result } of mounted) {
		result.cleanup();
		host.remove();
	}
	mounted = [];
}

/** Two install lines for the same packages, as a set of code tabs with `syncKey`. */
function installSet(persist: CodeTabs.Props["persist"] = "local") {
	return (
		<InstallCommand
			packages={["@sdxc/ui"]}
			syncKey={SYNC_KEY}
			persist={persist}
			title="Terminal"
			aria-label="Package manager"
			labels={LABELS}
		/>
	);
}

/** The radios of the `index`th set of tabs on the page. */
function radios(index: number): HTMLInputElement[] {
	let set = document.querySelectorAll('[data-slot="code-tabs"]')[index]!;
	return [...set.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
}

/** The text of the visible panel in the `index`th set. */
function visiblePanel(index: number): string {
	let set = document.querySelectorAll('[data-slot="code-tabs"]')[index]!;
	let panels = [...set.querySelectorAll<HTMLElement>('[data-slot="code-tabs-panel"]')];
	let shown = panels.filter((panel) => getComputedStyle(panel).visibility === "visible");
	expect(shown).toHaveLength(1);
	return shown[0]!.querySelector("code")!.textContent!;
}

/** Checks a radio the way a click on its label does. */
function choose(radio: HTMLInputElement) {
	radio.click();
}

describe("CodeTabs", () => {
	test("switches the visible panel with its radios alone, keeping one height", () => {
		mount(
			<CodeTabs
				aria-label="Language"
				tabs={[
					{
						label: "TypeScript",
						value: "ts",
						children: <CodeBlock language="ts" code="let a: number = 1;" labels={LABELS} />,
					},
					{
						label: "JavaScript",
						value: "js",
						children: (
							<CodeBlock
								language="js"
								code={"let a = 1;\nlet b = 2;\nlet c = 3;"}
								labels={LABELS}
							/>
						),
					},
				]}
			/>,
		);
		let set = document.querySelector<HTMLElement>('[data-slot="code-tabs"]')!;
		let before = set.getBoundingClientRect().height;
		expect(visiblePanel(0)).toBe("let a: number = 1;");

		choose(radios(0)[1]!);
		expect(visiblePanel(0)).toContain("let c = 3;");
		expect(set.getBoundingClientRect().height).toBe(before);
		expect(document.querySelector('[role="radiogroup"]')!.getAttribute("aria-label")).toBe(
			"Language",
		);
	});

	test("renders the selected tab the server passes", () => {
		mount(
			<InstallCommand
				packages={["@sdxc/ui"]}
				selected="pnpm"
				aria-label="Package manager"
				labels={LABELS}
			/>,
		);
		expect(visiblePanel(0)).toBe("pnpm add @sdxc/ui");
	});

	test("switches every set sharing a sync key and restores the choice after a reload", async () => {
		mount(
			<div>
				{installSet()}
				{installSet()}
			</div>,
		);
		choose(radios(0)[3]!);
		expect(visiblePanel(0)).toBe("bun add @sdxc/ui");
		expect(visiblePanel(1)).toBe("bun add @sdxc/ui");
		expect(localStorage.getItem(codeTabsStorageKey(SYNC_KEY))).toBe("bun");

		leave();
		mount(
			<div>
				{installSet()}
				{installSet()}
			</div>,
		);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(visiblePanel(0)).toBe("bun add @sdxc/ui");
		expect(visiblePanel(1)).toBe("bun add @sdxc/ui");
	});

	test("remembers a cookie choice the server can read", () => {
		mount(installSet("cookie"));
		choose(radios(0)[2]!);
		expect(readCodeTabsCookie(document.cookie, SYNC_KEY)).toBe("yarn");
	});

	test("leaves sets with another or no sync key alone", () => {
		mount(
			<div>
				{installSet()}
				<InstallCommand
					packages={["@sdxc/ui"]}
					syncKey="other"
					aria-label="Package manager"
					labels={LABELS}
				/>
				<InstallCommand packages={["@sdxc/ui"]} aria-label="Package manager" labels={LABELS} />
			</div>,
		);
		choose(radios(0)[1]!);
		expect(visiblePanel(1)).toBe("npm install @sdxc/ui");
		expect(visiblePanel(0)).toBe("pnpm add @sdxc/ui");
	});

	test("marks the selected tab with an underline that grows in within 200ms", () => {
		mount(installSet());
		let [selected, other] = document.querySelectorAll('[role="radiogroup"] > label');
		let underline = getComputedStyle(selected!, "::after");
		expect(parseFloat(underline.transitionDuration) * 1000).toBeLessThanOrEqual(200);
		expect(underline.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
		expect(getComputedStyle(other!, "::after").transform).toBe("matrix(0, 0, 0, 1, 0, 0)");
	});

	test("fits a 320px column without widening the page", () => {
		mount(
			<InstallCommand
				packages={["@sdxc/ui", "@sdxc/u", "@sdxc/icons", "@sdxc/highlight"]}
				dev
				aria-label="Package manager"
				labels={LABELS}
			/>,
			320,
		);
		let set = document.querySelector<HTMLElement>('[data-slot="code-tabs"]')!;
		expect(set.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
		let pre = set.querySelector("pre")!;
		expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth);
	});
});

describe("installLine", () => {
	test("spells each manager's verb and dev flag", () => {
		expect(installLine("npm", ["a", "b"], false)).toBe("npm install a b");
		expect(installLine("yarn", ["a"], true)).toBe("yarn add -D a");
		expect(installLine("bun", ["a"], true)).toBe("bun add -D a");
	});
});
