/**
 * Sets UI chips inside a narrow paragraph in a real browser and checks that a chip never
 * breaks across lines, a click path wraps only between its steps, and the chips read as
 * sans text sized to the sentence around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { UiLabel, UiPath } from "./ui-label.js";

import "../reset.css";
import "../theme.css";

/** Mounts a node inside a 16px paragraph of the given width. */
function mountInProse(node: RemixNode, width: number): HTMLElement {
	let host = document.createElement("p");
	host.style.width = `${width}px`;
	host.style.fontSize = "16px";
	host.style.fontFamily = "monospace";
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** The step chips of a mounted path, in order. */
function chips(root: HTMLElement): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>('[data-slot="ui-label"]')];
}

describe("UiLabel", () => {
	test("keeps a multi-word label whole on one line in a narrow column", () => {
		let root = mountInProse(
			<>
				Click <UiLabel>Add notification channel</UiLabel> to continue.
			</>,
			120,
		);
		let chip = chips(root)[0]!;

		expect(chip.getClientRects()).toHaveLength(1);
		expect(getComputedStyle(chip).whiteSpace).toBe("nowrap");
	});

	test("draws a bordered sans chip at 14px inside 16px prose", () => {
		let chip = chips(mountInProse(<UiLabel>Settings</UiLabel>, 400))[0]!;
		let style = getComputedStyle(chip);

		expect(style.fontSize).toBe("14px");
		expect(style.fontFamily).not.toContain("monospace");
		expect(style.borderTopWidth).toBe("1px");
		expect(parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(3);
		expect(parseFloat(style.borderTopLeftRadius)).toBeLessThan(7);
	});
});

describe("UiPath", () => {
	test("joins the steps with the separator, in order", () => {
		let root = mountInProse(<UiPath items={["Settings", "Notifications", "Add channel"]} />, 600);

		expect(chips(root).map((chip) => chip.textContent)).toEqual([
			"Settings",
			"Notifications",
			"Add channel",
		]);
		expect(root.querySelectorAll('[data-slot="ui-path-separator"]')).toHaveLength(2);
		expect(root.textContent).toBe("Settings → Notifications → Add channel");
	});

	test("uses a custom separator", () => {
		let root = mountInProse(<UiPath items={["Ajustes", "Alertas"]} separator="›" />, 600);

		expect(root.textContent).toBe("Ajustes › Alertas");
	});

	test("wraps between steps at 320px and never inside one", () => {
		let root = mountInProse(
			<UiPath
				items={["Workspace settings", "Notification channels", "Add a new channel", "Slack"]}
			/>,
			320,
		);
		let steps = chips(root);
		let tops = new Set(steps.map((chip) => Math.round(chip.getBoundingClientRect().top)));

		expect(tops.size).toBeGreaterThan(1);
		for (let chip of steps) {
			expect(chip.getClientRects()).toHaveLength(1);
			expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
				root.getBoundingClientRect().right + 0.5,
			);
		}
		expect(root.scrollWidth).toBeLessThanOrEqual(320);
	});
});
