/**
 * Renders Strata Two's landing in a real browser: the finish picker recolouring every board
 * and the preorder summary through CSS alone, the scroll scenes falling back to static
 * frames under reduced motion, the preorder answered from the URL, and the playable board.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { FINISHES, finishInputId } from "~/resources/views/demos/hardware/finish";
import strata from "~/resources/views/demos/hardware/index";
import { PREORDER_FORM } from "~/resources/views/demos/hardware/preorder-data";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
	scrollTo(0, 0);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	await page.viewport(414, 896);
});

/** Renders the page as a request for `query` would. */
function renderPage(query = "") {
	mounted = render(strata.render(new URL(`https://sdxc.dev/demo/hardware${query}`)));
	return mounted;
}

/** The page root, where the finish's custom properties are set. */
function pageRoot(): HTMLElement {
	return document.querySelector<HTMLElement>('[data-slot="strata-page"]')!;
}

/** The finish names the preorder summary shows. */
function shownFinishNames(): string[] {
	return [...document.querySelectorAll<HTMLElement>("#preorder [data-finish-name]")]
		.filter((element) => getComputedStyle(element).display !== "none")
		.map((element) => element.textContent ?? "");
}

describe("Strata Two finish picker", () => {
	test("recolours the board and names the finish in the preorder when a swatch is chosen", () => {
		renderPage();
		let [raw, graphite] = FINISHES;
		expect(getComputedStyle(pageRoot()).getPropertyValue("--strata-case-hi")).toBe(
			raw!.colours["--strata-case-hi"],
		);
		expect(shownFinishNames()).toEqual(["Raw"]);

		document.querySelector<HTMLLabelElement>(`label:has(#${finishInputId("graphite")})`)!.click();

		expect(getComputedStyle(pageRoot()).getPropertyValue("--strata-case-hi")).toBe(
			graphite!.colours["--strata-case-hi"],
		);
		expect(shownFinishNames()).toEqual(["Graphite"]);
	});

	test("submits the chosen finish with the preorder form it belongs to", () => {
		renderPage("?finish=bronze");
		let form = document.getElementById(PREORDER_FORM) as HTMLFormElement;
		expect(new FormData(form).get("finish")).toBe("bronze");
		expect(new FormData(form).get("reserve")).toBe("1");
	});
});

describe("Strata Two scroll scenes", () => {
	test("hold their stage on a tall runway and run each layer along the scene", async () => {
		await page.viewport(1440, 900);
		renderPage();
		let scene = document.querySelector<HTMLElement>("#design [data-slot=scroll-scene]")!;
		let stage = scene.querySelector<HTMLElement>("[data-slot=scroll-scene-stage]")!;
		expect(scene.offsetHeight).toBeGreaterThan(innerHeight * 1.5);
		expect(getComputedStyle(stage).position).toBe("sticky");
		let layer = scene.querySelector<HTMLElement>("[role=img] > div > div:last-child")!;
		expect(getComputedStyle(layer).animationName).not.toBe("none");
	});

	test("show the finished frame in normal flow when motion is reduced", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		await page.viewport(1440, 900);
		renderPage();
		for (let id of ["design", "materials", "in-use"]) {
			let scene = document.querySelector<HTMLElement>(`#${id} [data-slot=scroll-scene]`)!;
			let stage = scene.querySelector<HTMLElement>("[data-slot=scroll-scene-stage]")!;
			expect(getComputedStyle(stage).position, id).toBe("static");
			expect(scene.offsetHeight, id).toBe(stage.offsetHeight);
			for (let element of scene.querySelectorAll<HTMLElement>("*")) {
				expect(getComputedStyle(element).animationName, id).toBe("none");
			}
		}
		let layers = document.querySelectorAll<HTMLElement>("#design [role=img] > div > div");
		expect(getComputedStyle(layers[layers.length - 1]!).translate).not.toBe("none");
		let typed = document.querySelector<HTMLElement>("#in-use [role=img] span:nth-child(2)")!;
		expect(typed.textContent).toBe("ship it");
		expect(typed.scrollWidth).toBeLessThanOrEqual(typed.clientWidth);
	});
});

describe("Strata Two preorder", () => {
	test("confirms the reservation the URL carries", () => {
		renderPage("?finish=bronze&layout=iso&switch=notch&reserve=1");
		let status = document.querySelector('[data-slot="strata-reservation"]')!;
		expect(status.textContent).toContain("Strata Two in Bronze, ISO, Notch switches");
		expect(document.getElementById(PREORDER_FORM)).toBeNull();
	});

	test("shows the form with defaults when the URL holds values the form never sends", () => {
		renderPage("?finish=gold&layout=iso&reserve=1");
		expect(document.querySelector('[data-slot="strata-reservation"]')).toBeNull();
		let form = document.getElementById(PREORDER_FORM) as HTMLFormElement;
		expect(new FormData(form).get("layout")).toBe("ansi");
		expect(new FormData(form).get("finish")).toBe("raw");
	});
});

describe("Strata Two sound board", () => {
	test("presses a key under the pointer and lets it up on release", () => {
		renderPage();
		let board = document.querySelector<HTMLButtonElement>("#play button")!;
		let key = board.querySelector('[data-key="s"]')!;
		key
			.querySelector("[data-p=dish]")!
			.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		expect(key.hasAttribute("data-down")).toBe(true);
		expect(getComputedStyle(key.querySelector("[data-p=cap-top]")!).translate).toBe("0px 1.1px");
		board.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
		expect(key.hasAttribute("data-down")).toBe(false);
	});

	test("presses the board key matching a physical key while it has focus", () => {
		renderPage();
		let board = document.querySelector<HTMLButtonElement>("#play button")!;
		board.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftRight", bubbles: true }));
		let shifts = board.querySelectorAll('[data-key="shift"]');
		expect(shifts[0]!.hasAttribute("data-down")).toBe(false);
		expect(shifts[1]!.hasAttribute("data-down")).toBe(true);
		board.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftRight", bubbles: true }));
		expect(shifts[1]!.hasAttribute("data-down")).toBe(false);
	});
});

describe("Strata Two on a phone", () => {
	test("never scrolls the page sideways at 375px", async () => {
		await page.viewport(375, 812);
		renderPage();
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});
});
