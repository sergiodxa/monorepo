/**
 * Lays the banner out in a real browser: a named region in the flow that pushes the
 * app frame down instead of covering it, no close control unless dismissible, a
 * dismissal that is a real form, and a 320px phone that wraps instead of overflowing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Banner } from "./banner.js";

import "../reset.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	await page.viewport(1280, 800);
});

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 1024): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host;
}

/** The fixing action a billing banner offers. */
function UpdateLink() {
	return () => <a href="/billing">Update Payment Method</a>;
}

describe("Banner", () => {
	test("is a named region in the flow that pushes the app frame down", () => {
		let host = mount(
			<>
				<Banner color="warning" label="Billing" action={<UpdateLink />}>
					Your card was declined. Update it to keep monitors running.
				</Banner>
				<main data-testid="frame">Dashboard</main>
			</>,
		);
		let banner = host.querySelector<HTMLElement>('[data-slot="banner"]')!;
		let frame = host.querySelector<HTMLElement>('[data-testid="frame"]')!;

		expect(banner.tagName).toBe("SECTION");
		expect(banner.getAttribute("aria-label")).toBe("Billing");
		expect(getComputedStyle(banner).position).toBe("static");
		expect(frame.getBoundingClientRect().top).toBeCloseTo(banner.getBoundingClientRect().bottom, 1);
		expect(banner.getBoundingClientRect().width).toBe(1024);
	});

	test("draws the tone's icon, hidden from assistive technology, unless told otherwise", () => {
		let host = mount(
			<>
				<Banner color="danger" label="Integrations" data-testid="toned">
					Slack stopped accepting alerts.
				</Banner>
				<Banner color="danger" label="Integrations" icon={null} data-testid="bare">
					Slack stopped accepting alerts.
				</Banner>
			</>,
		);

		let icon = host.querySelector('[data-testid="toned"] [data-slot="banner-icon"]')!;
		expect(icon.getAttribute("aria-hidden")).toBe("true");
		expect(icon.querySelector("svg")).not.toBeNull();
		expect(host.querySelector('[data-testid="bare"] [data-slot="banner-icon"]')).toBeNull();
	});

	test("offers no close control while the state needs resolving", () => {
		let host = mount(
			<Banner color="warning" label="Billing" action={<UpdateLink />}>
				Your card was declined.
			</Banner>,
		);

		expect(host.querySelector("button")).toBeNull();
		expect(host.querySelector("form")).toBeNull();
		expect(host.querySelectorAll('[data-slot="banner-action"] a')).toHaveLength(1);
	});

	test("dismisses through a real form when dismissible", () => {
		let host = mount(
			<Banner
				label="Maintenance"
				dismiss={{
					label: "Dismiss",
					action: "/banners/dismiss",
					fields: { id: "maintenance-nov" },
				}}
			>
				Checks pause for 10 minutes on Sunday at 02:00 UTC.
			</Banner>,
		);
		let form = host.querySelector("form")!;
		let button = form.querySelector("button")!;

		expect(form.getAttribute("method")).toBe("post");
		expect(form.getAttribute("action")).toBe("/banners/dismiss");
		expect(new FormData(form).get("id")).toBe("maintenance-nov");
		expect(button.type).toBe("submit");
		expect(button.getAttribute("aria-label")).toBe("Dismiss");
	});

	test("wraps on a 320px phone without scrolling sideways", async () => {
		await page.viewport(320, 640);
		let host = mount(
			<Banner
				color="warning"
				label="Billing"
				action={<UpdateLink />}
				dismiss={{ label: "Dismiss", action: "/banners/dismiss" }}
			>
				Your card ending 4242 was declined three times. Update it to keep 48 monitors running.
			</Banner>,
			320,
		);
		let banner = host.querySelector<HTMLElement>('[data-slot="banner"]')!;

		expect(banner.scrollWidth).toBeLessThanOrEqual(banner.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
		let action = host.querySelector('[data-slot="banner-action"]')!.getBoundingClientRect();
		let message = host.querySelector('[data-slot="banner-message"]')!.getBoundingClientRect();
		expect(action.top).toBeGreaterThanOrEqual(message.bottom);
	});
});
