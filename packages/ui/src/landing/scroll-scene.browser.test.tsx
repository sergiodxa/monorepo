/**
 * Lays out {@link ScrollScene} in a real browser: a tall runway with a sticky stage that a
 * part animates along, the static frame in normal flow under reduced motion, and every
 * scroll-linked rule behind the view-timeline support query, so older engines get the frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { ScrollScene, sceneMotion } from "./scroll-scene.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	await page.viewport(414, 896);
});

/** Renders a scene of `length` viewports holding one part that fades in along it. */
function renderScene(length?: number) {
	mounted = render(
		<ScrollScene timeline="test-scene" length={length}>
			<div
				data-testid="part"
				mix={[
					sceneMotion(
						"test-scene",
						{ from: { opacity: "0.2" }, to: { opacity: "1" } },
						"contain 10% contain 40%",
					),
				]}
			>
				Stage
			</div>
		</ScrollScene>,
	);
	let scene = document.querySelector<HTMLElement>("[data-slot=scroll-scene]")!;
	let stage = scene.querySelector<HTMLElement>("[data-slot=scroll-scene-stage]")!;
	let part = document.querySelector<HTMLElement>("[data-testid=part]")!;
	return { scene, stage, part };
}

/** Every style rule on the page whose declarations name `property`, with its at-rule ancestors. */
function rulesSetting(property: string): Array<{ rule: CSSStyleRule; ancestors: string[] }> {
	let found: Array<{ rule: CSSStyleRule; ancestors: string[] }> = [];
	let visit = (rules: CSSRuleList, ancestors: string[]) => {
		for (let rule of rules) {
			if (rule instanceof CSSSupportsRule)
				visit(rule.cssRules, [...ancestors, `@supports ${rule.conditionText}`]);
			else if (rule instanceof CSSMediaRule)
				visit(rule.cssRules, [...ancestors, `@media ${rule.conditionText}`]);
			else if (rule instanceof CSSLayerBlockRule) visit(rule.cssRules, ancestors);
			else if (rule instanceof CSSStyleRule) {
				if (rule.style.getPropertyValue(property) !== "") found.push({ rule, ancestors });
				if (rule.cssRules.length > 0) visit(rule.cssRules, ancestors);
			}
		}
	};
	for (let sheet of document.styleSheets) visit(sheet.cssRules, []);
	for (let sheet of document.adoptedStyleSheets) visit(sheet.cssRules, []);
	return found;
}

describe("ScrollScene", () => {
	test("pins its stage under the header for the scene's length and runs the part along it", async () => {
		await page.viewport(1280, 800);
		let { scene, stage, part } = renderScene(3);
		let header = 64;
		expect(scene.offsetHeight).toBeCloseTo(3 * (innerHeight - header), -1);
		expect(getComputedStyle(stage).position).toBe("sticky");
		expect(getComputedStyle(stage).top).toBe(`${header}px`);
		expect(getComputedStyle(scene).viewTimelineName).toBe("--test-scene");
		expect(getComputedStyle(part).animationTimeline).toBe("--test-scene");
		expect(getComputedStyle(part).animationRangeStart).toBe("contain 10%");
	});

	test("plays inside a scroll panel that names its own height", async () => {
		await page.viewport(1280, 800);
		let panel = document.createElement("div");
		panel.style.cssText =
			"block-size: 300px; overflow-y: auto; --ui-scroll-scene-viewport: 300px; --ui-landing-header-height: 0px";
		document.body.appendChild(panel);
		mounted = render(
			<ScrollScene timeline="panel-scene" length={2}>
				<div>Stage</div>
			</ScrollScene>,
			{ container: panel },
		);
		let scene = panel.querySelector<HTMLElement>("[data-slot=scroll-scene]")!;
		let stage = scene.querySelector<HTMLElement>("[data-slot=scroll-scene-stage]")!;
		expect(scene.offsetHeight).toBe(600);
		panel.scrollTop = 200;
		expect(stage.getBoundingClientRect().top).toBeCloseTo(panel.getBoundingClientRect().top, 0);
	});

	test("shows the static frame in normal flow when motion is reduced", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		await page.viewport(1280, 800);
		let { scene, stage, part } = renderScene(3);
		expect(getComputedStyle(stage).position).toBe("static");
		expect(scene.offsetHeight).toBe(stage.offsetHeight);
		expect(getComputedStyle(part).animationName).toBe("none");
		expect(getComputedStyle(part).opacity).toBe("1");
	});

	test("keeps every scroll-linked rule behind the view-timeline support query", () => {
		renderScene();
		let gated = [
			...rulesSetting("position").filter(({ rule }) => rule.style.position === "sticky"),
			...rulesSetting("animation-timeline"),
			...rulesSetting("block-size").filter(({ rule }) =>
				rule.style.blockSize.includes("--ui-scroll-scene-viewport"),
			),
		];
		expect(gated.length).toBeGreaterThanOrEqual(3);
		for (let { rule, ancestors } of gated) {
			expect(ancestors, rule.cssText).toContain("@supports (animation-timeline: view())");
			expect(ancestors, rule.cssText).toContain("@media (prefers-reduced-motion: no-preference)");
		}
	});
});
