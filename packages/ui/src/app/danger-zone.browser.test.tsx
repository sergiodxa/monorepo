/**
 * Opens a danger zone in a real browser: each action lists its consequences, its button
 * opens the named confirm, and the button moves under the text in a narrow card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { DangerZone } from "./danger-zone.js";

/** Mounts a danger zone with one delete action in a host `width` pixels wide. */
function mount(width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<DangerZone title="Danger zone">
			<DangerZone.Action
				id="delete-team"
				title="Delete team"
				description="Permanently delete Acme Ops and everything in it."
				consequences={["14 monitors stop checking", "3 status pages go offline"]}
				buttonLabel="Delete team"
				confirm={{
					title: "Delete team?",
					description: "Acme Ops and its history are deleted for everyone.",
					confirmLabel: "Delete team",
					cancelLabel: "Cancel",
					typeToConfirm: { value: "acme-ops", label: 'Type "acme-ops" to confirm' },
					form: { action: "/teams/acme-ops/delete" },
				}}
			/>
		</DangerZone>,
		{ container: host },
	);
	return host;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("DangerZone", () => {
	test("lists the consequences and names the section", () => {
		let host = mount();
		let items = [...host.querySelectorAll('[data-slot="danger-zone-consequences"] li')];

		expect(items.map((item) => item.textContent)).toEqual([
			"14 monitors stop checking",
			"3 status pages go offline",
		]);
		let section = host.querySelector("section")!;
		expect(document.getElementById(section.getAttribute("aria-labelledby")!)?.textContent).toBe(
			"Danger zone",
		);
	});

	test("opens the confirm, locked until the team's name is typed", async () => {
		let host = mount();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		await userEvent.click(host.querySelector<HTMLButtonElement>('[commandfor="delete-team"]')!);
		let dialog = host.querySelector<HTMLDialogElement>("dialog#delete-team")!;

		expect(dialog.open).toBe(true);
		let action = dialog.querySelector<HTMLButtonElement>("[data-confirm-action]")!;
		expect(action.disabled).toBe(true);
		await userEvent.type(dialog.querySelector("input")!, "acme-ops");
		expect(action.disabled).toBe(false);
	});

	test("puts the button beside the text when wide and under it when narrow", () => {
		let wide = mount(720);
		let wideButton = wide.querySelector("[commandfor]")!.getBoundingClientRect();
		let wideTitle = wide
			.querySelector('[data-slot="danger-zone-action"] p')!
			.getBoundingClientRect();
		expect(wideButton.left).toBeGreaterThan(wideTitle.right);

		let narrow = mount(320);
		let narrowButton = narrow.querySelector("[commandfor]")!.getBoundingClientRect();
		let list = narrow.querySelector("ul")!.getBoundingClientRect();
		expect(narrowButton.top).toBeGreaterThanOrEqual(list.bottom);
	});
});
