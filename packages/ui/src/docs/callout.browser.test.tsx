/**
 * Mounts callouts in a real browser and checks they stay static named asides, draw a
 * light tint with a stronger border in the kind's colour, and wrap long content inside
 * a phone-width column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Callout } from "./callout.js";

import "../reset.css";
import "../theme.css";

/**
 * Opaque text colours for each tone, set on the host because an app's palette, not the
 * package, defines the tone tokens.
 */
const TONE_INKS: Record<string, string> = {
	"--ui-brand-fg": "rgb(37, 99, 235)",
	"--ui-success-fg": "rgb(22, 163, 74)",
	"--ui-warning-fg": "rgb(202, 138, 4)",
	"--ui-danger-fg": "rgb(220, 38, 38)",
};

/** Mounts a node in a column of the given width and returns its first child. */
function mount(node: RemixNode, width = 640): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	for (let [name, value] of Object.entries(TONE_INKS)) host.style.setProperty(name, value);
	document.body.appendChild(host);
	return render(node, { container: host }).container.firstElementChild as HTMLElement;
}

/** Reads a colour's alpha channel from any computed `rgb()`, `rgba()` or `color()` value. */
function alpha(value: string): number {
	let probe = document.createElement("canvas").getContext("2d")!;
	probe.fillStyle = value;
	probe.clearRect(0, 0, 1, 1);
	probe.fillRect(0, 0, 1, 1);
	return probe.getImageData(0, 0, 1, 1).data[3]! / 255;
}

describe("Callout", () => {
	test("is a named aside and never an alert or live region", () => {
		let aside = mount(
			<Callout kind="warning" label="Warning">
				<p>Rotate the key first.</p>
			</Callout>,
		);

		expect(aside.tagName).toBe("ASIDE");
		expect(aside.getAttribute("role")).toBeNull();
		expect(aside.getAttribute("aria-live")).toBeNull();
		expect(aside.getAttribute("aria-label")).toBe("Warning");
		expect(aside.querySelector('[data-slot="callout-title"]')!.textContent).toBe("Warning");
	});

	test("shows the title on screen and names the aside with the kind and the title", () => {
		let aside = mount(
			<Callout kind="tip" label="Tip" title="Faster local runs">
				<p>Pass the watch flag.</p>
			</Callout>,
		);

		expect(aside.getAttribute("aria-label")).toBe("Tip: Faster local runs");
		expect(aside.querySelector('[data-slot="callout-title"]')!.textContent).toBe(
			"Faster local runs",
		);
	});

	test("tints lightly and borders more strongly in the kind's colour", () => {
		for (let kind of ["note", "tip", "warning", "danger"] as const) {
			let style = getComputedStyle(
				mount(
					<Callout kind={kind} label={kind}>
						Body
					</Callout>,
				),
			);
			let fill = alpha(style.backgroundColor);
			let edge = alpha(style.borderTopColor);

			expect(fill, kind).toBeGreaterThan(0.03);
			expect(fill, kind).toBeLessThan(0.1);
			expect(edge, kind).toBeGreaterThan(0.2);
			expect(edge, kind).toBeLessThan(0.4);
			expect(style.borderTopWidth).toBe("1px");
		}
	});

	test("draws each kind's icon in a different colour", () => {
		let colors = new Set(
			(["note", "tip", "warning", "danger"] as const).map((kind) => {
				let aside = mount(
					<Callout kind={kind} label={kind}>
						Body
					</Callout>,
				);
				return getComputedStyle(aside.querySelector('[data-slot="callout-icon"]')!).color;
			}),
		);

		expect(colors.size).toBe(4);
	});

	test("wraps an unbroken string inside a 320px column", () => {
		let aside = mount(
			<Callout kind="note" label="Note">
				<p>Set SDXC_SUPER_LONG_ENVIRONMENT_VARIABLE_NAME_THAT_NEVER_BREAKS before you run it.</p>
			</Callout>,
			320,
		);

		expect(aside.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(aside.scrollWidth).toBeLessThanOrEqual(aside.clientWidth);
	});
});
