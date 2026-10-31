/**
 * Lays out {@link TypedTerminal} in a real browser: the whole session in the DOM under the
 * figure's name, each input line clipped to its own character count, a narrow column that
 * scrolls inside the panel, the title clear of the pause toggle, and a still finished state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { TypedTerminal } from "./typed-terminal.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	await page.viewport(414, 896);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** A browser flow spec, one line long enough to outgrow a 280px column, then its result. */
const LINES: TypedTerminal.Line[] = [
	{ kind: "input", text: 'visit "/login"' },
	{ kind: "input", text: 'fill "Email" with "ada@example.com" and "Password" with "secret"' },
	{ kind: "input", text: 'click "Sign in"' },
	{ kind: "input", text: 'see "Welcome back"' },
	{ kind: "output", text: "✓ 4 steps · 2.1s", status: "ok" },
];

/** Mounts a terminal of `lines` in a 280px column and returns its host. */
function mount(lines: readonly TypedTerminal.Line[] = LINES): HTMLElement {
	let host = document.createElement("div");
	host.style.cssText = "inline-size: 280px";
	document.body.appendChild(host);
	mounted = render(
		<TypedTerminal aria-label="A sign-in spec and its run" title="sign-in.spec" lines={lines} />,
		{ container: host },
	);
	return host;
}

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The typed text spans of every input line, in order. */
function typedSpans(root: Element): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>('[data-slot="typed-terminal-text"]')];
}

describe("TypedTerminal", () => {
	test("names the figure and holds every line's full text in one pre", () => {
		let host = mount();
		let figure = host.querySelector("figure")!;
		expect(figure.getAttribute("aria-label")).toBe("A sign-in spec and its run");
		let pre = figure.querySelector("pre")!;
		expect(pre.querySelectorAll("[data-line]")).toHaveLength(LINES.length);
		for (let line of LINES) expect(pre.textContent).toContain(line.text);
		expect(host.textContent).toContain("sign-in.spec");
	});

	test("shows the prompt glyph before input lines only", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		mounted = render(
			<TypedTerminal
				aria-label="An install"
				prompt="$"
				lines={[
					{ kind: "input", text: "bun add @acme/cli" },
					{ kind: "output", text: "installed 1 package", status: "muted" },
				]}
			/>,
			{ container: host },
		);
		let [input, output] = [...host.querySelectorAll("[data-line]")];
		expect(input!.textContent).toBe("$ bun add @acme/cli");
		expect(output!.textContent).toBe("installed 1 package");
	});

	test("gives input lines of different lengths their own character count", () => {
		let host = mount();
		let counts = typedSpans(host).map((span) => getComputedStyle(span).getPropertyValue("--chars"));
		expect(counts).toEqual(
			LINES.filter((line) => line.kind === "input").map((l) => String(l.text.length)),
		);
		expect(new Set(counts).size).toBe(counts.length);
	});

	/** Checked at the hold, once every line has typed, where the long line is widest. */
	test("scrolls a long line inside the body while the host keeps its width", () => {
		let host = mount();
		let pre = host.querySelector("pre")!;
		for (let animation of host.getAnimations({ subtree: true })) {
			let duration = Number(animation.effect!.getTiming().duration);
			animation.pause();
			animation.currentTime = duration * 0.9;
		}
		expect(typedSpans(host)[1]!.getBoundingClientRect().width).toBeGreaterThan(280);
		expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
		expect(host.querySelector("figure")!.getBoundingClientRect().width).toBeLessThanOrEqual(280);
		expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth);
		expect(getComputedStyle(pre).overflowX).toBe("auto");
		expect(getComputedStyle(pre).whiteSpace).toBe("pre");
	});

	test("keeps the title clear of the pause toggle at every phone width", async () => {
		let hits: number[] = [];
		for (let width = 260; width <= 420; width += 4) {
			await page.viewport(width, 700);
			mounted = render(
				<div style={{ padding: "0 16px" }}>
					<TypedTerminal
						aria-label="A sign-in spec and its run"
						title="specs/sign-in-with-a-long-name.spec"
						lines={LINES}
					/>
				</div>,
			);
			let toggle = mounted.$('[data-slot="motion-loop"] > :last-child')!.getBoundingClientRect();
			let walker = document.createTreeWalker(mounted.$("figure")!, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				let range = document.createRange();
				range.selectNodeContents(walker.currentNode);
				if ([...range.getClientRects()].some((line) => overlaps(line, toggle))) hits.push(width);
			}
			mounted.cleanup();
			mounted = undefined;
		}

		expect(hits).toEqual([]);
	});

	test("animates sessions of different lengths on separate keyframes", () => {
		let full = mount();
		let short = mount(LINES.slice(0, 2));
		let first = (root: HTMLElement) => getComputedStyle(typedSpans(root)[0]!).animationName;
		expect(first(full)).toMatch(/^ui-typed-terminal-type-5-0-/);
		expect(first(full)).not.toBe(first(short));
	});

	test("types at a steady pace by stepping once per character", () => {
		let host = mount();
		let span = typedSpans(host)[1]!;
		let style = getComputedStyle(span);
		expect(style.animationTimingFunction).toBe(`steps(${LINES[1]!.text.length})`);
		expect(parseFloat(style.animationDuration)).toBeLessThanOrEqual(12);
	});

	test("shows the finished session with no caret and no motion when motion is reduced", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let host = mount();
		for (let span of typedSpans(host)) {
			expect(getComputedStyle(span).animationName).toBe("none");
			expect(span.getBoundingClientRect().width).toBeGreaterThan(0);
			expect(span.scrollWidth).toBeLessThanOrEqual(Math.ceil(span.clientWidth));
		}
		for (let caret of host.querySelectorAll('[data-slot="typed-terminal-caret"]')) {
			expect(getComputedStyle(caret).visibility).toBe("hidden");
			expect(getComputedStyle(caret).animationName).toBe("none");
		}
		let output = host.querySelector('[data-kind="output"]')!;
		expect(getComputedStyle(output).opacity).toBe("1");
		expect(getComputedStyle(output).animationName).toBe("none");
	});
});
