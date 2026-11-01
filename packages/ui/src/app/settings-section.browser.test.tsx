/**
 * Lays settings sections out in a real browser: a split row puts its control beside the
 * label in a wide card and under it in a narrow one, an inline switch stays inline, and
 * only an explicit section ends in a Save footer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Input } from "../components/input.js";
import { Switch } from "../components/switch.js";

import { SettingsSection } from "./settings-section.js";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The label block and the control block of the first row in `host`. */
function rowParts(host: HTMLElement): { text: DOMRect; control: DOMRect } {
	let row = host.querySelector('[data-slot="settings-row"]')!;
	return {
		text: row.querySelector('[data-slot="settings-row-text"]')!.getBoundingClientRect(),
		control: row.querySelector('[data-slot="settings-row-control"]')!.getBoundingClientRect(),
	};
}

/** A monitor-defaults section with one split row. */
function monitorDefaults(save: SettingsSection.Save) {
	return (
		<SettingsSection
			title="Monitor defaults"
			description="Applied to every new monitor."
			save={save}
			form={{ action: "/settings/monitors" }}
			labels={{ save: "Save" }}
		>
			<SettingsSection.Row
				label="Alert email"
				description="Where down alerts go."
				htmlFor="alert-email"
			>
				<Input id="alert-email" name="alertEmail" type="email" />
			</SettingsSection.Row>
		</SettingsSection>
	);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("SettingsSection", () => {
	test("puts a split row's control beside its label in a wide card", () => {
		let { text, control } = rowParts(mount(monitorDefaults("explicit"), 720));

		expect(control.left).toBeGreaterThanOrEqual(text.right);
		expect(Math.abs(control.top - text.top)).toBeLessThan(2);
	});

	test("stacks a split row's control under its label in a narrow card", () => {
		let { text, control } = rowParts(mount(monitorDefaults("explicit"), 320));

		expect(control.top).toBeGreaterThanOrEqual(text.bottom);
		expect(Math.abs(control.left - text.left)).toBeLessThan(2);
	});

	test("keeps an inline switch at the end of its row in a narrow card", () => {
		let host = mount(
			<SettingsSection title="Notifications" save="instant" labels={{ save: "Save" }}>
				<SettingsSection.Row
					layout="inline-switch"
					label="Email me when a monitor goes down"
					labelId="down"
				>
					<Switch name="emailOnDown" aria-labelledby="down" />
				</SettingsSection.Row>
			</SettingsSection>,
			320,
		);
		let { text, control } = rowParts(host);

		expect(control.left).toBeGreaterThanOrEqual(text.right);
		expect(host.querySelector("input")?.getAttribute("aria-labelledby")).toBe("down");
		expect(document.getElementById("down")?.textContent).toBe("Email me when a monitor goes down");
	});

	test("ends an explicit section in a footer whose Save sits at the start", () => {
		let host = mount(monitorDefaults("explicit"));
		let footer = host.querySelector('[data-slot="settings-footer"]')!;
		let button = footer.querySelector('button[type="submit"]')!;

		expect(button.textContent).toBe("Save");
		expect(button.getBoundingClientRect().left - footer.getBoundingClientRect().left).toBeLessThan(
			24,
		);
		expect(button.closest("form")?.getAttribute("method")).toBe("post");
	});

	test("renders no footer for an instant section, keeping Save for a browser without script", () => {
		let host = mount(monitorDefaults("instant"));

		expect(host.querySelector('[data-slot="settings-footer"]')).toBeNull();
		expect(host.querySelector("noscript")).not.toBeNull();
		let visibleButtons = [...host.querySelectorAll("button")].filter(
			(button) => button.getBoundingClientRect().height > 0,
		);
		expect(visibleButtons).toHaveLength(0);
	});

	test("submits an instant section's form whenever a switch flips", async () => {
		let host = mount(
			<SettingsSection
				title="Notifications"
				save="instant"
				form={{ action: "/settings/notifications" }}
				labels={{ save: "Save" }}
			>
				<SettingsSection.Row layout="inline-switch" label="Weekly report" labelId="weekly">
					<Switch name="weekly" aria-labelledby="weekly" />
				</SettingsSection.Row>
			</SettingsSection>,
		);
		let form = host.querySelector("form")!;
		let submitted = 0;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			submitted++;
		});
		await new Promise((resolve) => requestAnimationFrame(resolve));

		host.querySelector<HTMLInputElement>('input[name="weekly"]')!.click();

		expect(submitted).toBe(1);
	});

	test("names the section by its title", () => {
		let host = mount(monitorDefaults("explicit"));
		let section = host.querySelector("section")!;

		expect(document.getElementById(section.getAttribute("aria-labelledby")!)?.textContent).toBe(
			"Monitor defaults",
		);
	});
});
