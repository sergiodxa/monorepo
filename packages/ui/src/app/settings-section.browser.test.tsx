/**
 * Lays settings sections out in a real browser: a split row puts its control beside the
 * label in a wide card and under it in a narrow one, an inline switch stays inline, and
 * only an explicit section ends in a Save footer, a list section saves nothing, and header
 * actions share the title's row until the container is too narrow for both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { Button } from "../components/button.js";
import { Input } from "../components/input.js";
import { LinkButton } from "../components/link-button.js";
import { Switch } from "../components/switch.js";

import { SaveBar } from "./save-bar.js";
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
function monitorDefaults(save: "explicit" | "instant") {
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

	test("centres a split row's label on its control when the row has no description", () => {
		let host = mount(
			<SettingsSection title="General" labels={{ save: "Save" }}>
				<SettingsSection.Row label="Name" htmlFor="name">
					<Input id="name" name="name" />
				</SettingsSection.Row>
			</SettingsSection>,
			720,
		);
		let label = host.querySelector("label")!.getBoundingClientRect();
		let { control } = rowParts(host);

		expect(Math.abs(centre(label) - centre(control))).toBeLessThan(1);
	});

	test("keeps a split row's label at its control's top when the row has a description", () => {
		let host = mount(monitorDefaults("explicit"), 720);
		let label = host.querySelector("label")!.getBoundingClientRect();
		let { control } = rowParts(host);

		expect(Math.abs(label.top - control.top)).toBeLessThan(1);
	});

	test("puts an action row's button at the row's end, centred on the label's first line", () => {
		let host = mount(billingSection(), 1280);
		let row = host.querySelector<HTMLElement>('[data-slot="settings-row"]')!;
		let { text, control } = rowParts(host);
		let button = host.querySelector("a")!.getBoundingClientRect();
		let label = row.querySelector('[data-slot="settings-row-text"] > div')!;
		let firstLine = label.getClientRects()[0]!;
		let rowBox = row.getBoundingClientRect();
		let contentEnd = rowBox.right - parseFloat(getComputedStyle(row).paddingInlineEnd);

		expect(Math.abs(button.right - contentEnd)).toBeLessThan(1);
		expect(Math.abs(control.right - contentEnd)).toBeLessThan(1);
		expect(Math.abs(centre(button) - centre(firstLine))).toBeLessThan(1);
		expect(text.width).toBeGreaterThan(rowBox.width / 2);
	});

	test("puts an action row's button under its text when placed below", () => {
		let host = mount(billingSection("below"), 1280);
		let { text } = rowParts(host);
		let button = host.querySelector("a")!.getBoundingClientRect();

		expect(button.top).toBeGreaterThanOrEqual(text.bottom);
		expect(Math.abs(button.left - text.left)).toBeLessThan(1);
	});

	test("stacks an action row's button under its text, at the start, in a narrow card", () => {
		let host = mount(billingSection(), 375);
		let { text } = rowParts(host);
		let button = host.querySelector("a")!.getBoundingClientRect();

		expect(button.top).toBeGreaterThanOrEqual(text.bottom);
		expect(Math.abs(button.left - text.left)).toBeLessThan(1);
		expect(host.querySelector("section")!.scrollWidth).toBeLessThanOrEqual(375);
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

	test("draws an explicit section's Save as the brand's solid primary button", () => {
		let host = mount(monitorDefaults("explicit"));
		let button = host.querySelector<HTMLElement>('[data-slot="settings-footer"] button')!;

		expect(button.dataset.color).toBe("brand");
		expect(button.dataset.variant).toBe("solid");
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

	test("⌘S submits the explicit section holding focus, and only that one", async () => {
		let host = mount(
			<div>
				<SettingsSection
					title="Workspace"
					form={{ action: "/settings/workspace" }}
					labels={{ save: "Save" }}
				>
					<SettingsSection.Row label="Name" htmlFor="name">
						<Input id="name" name="name" />
					</SettingsSection.Row>
				</SettingsSection>
				<SettingsSection
					title="Escalation"
					form={{ action: "/settings/escalation" }}
					labels={{ save: "Save" }}
				>
					<SettingsSection.Row label="Email" htmlFor="email">
						<Input id="email" name="email" />
					</SettingsSection.Row>
				</SettingsSection>
			</div>,
		);
		let submits = countSubmits(host);
		let saveDialog = watchDefault();
		await frame();

		document.getElementById("email")!.focus();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(submits()).toEqual({ "/settings/workspace": 0, "/settings/escalation": 1 });
		expect(saveDialog()).toBe(false);

		document.getElementById("name")!.focus();
		await userEvent.keyboard("{Control>}s{/Control}");
		expect(submits()).toEqual({ "/settings/workspace": 1, "/settings/escalation": 1 });

		(document.activeElement as HTMLElement).blur();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(submits()).toEqual({ "/settings/workspace": 1, "/settings/escalation": 1 });
		expect(saveDialog()).toBe(false);
	});

	test("⌘S submits the only explicit section on the page without focus in it", async () => {
		let host = mount(monitorDefaults("explicit"));
		let submits = countSubmits(host);
		await frame();

		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(submits()).toEqual({ "/settings/monitors": 1 });
	});

	test("⌘S submits a section with a save bar once", async () => {
		let host = mount(
			<SettingsSection
				title="Monitor defaults"
				form={{ action: "/settings/monitors" }}
				labels={{ save: "Save" }}
			>
				<SettingsSection.Row label="Alert email" htmlFor="alert-email">
					<Input id="alert-email" name="alertEmail" />
				</SettingsSection.Row>
				<SaveBar labels={{ message: "Unsaved changes", discard: "Discard", save: "Save" }} />
			</SettingsSection>,
		);
		let submits = countSubmits(host);
		await frame();

		await userEvent.type(document.getElementById("alert-email")!, "x");
		await userEvent.keyboard("{Meta>}s{/Meta}");
		expect(submits()).toEqual({ "/settings/monitors": 1 });
	});

	test("renders a list section with no form, footer, Save or instant-save island", () => {
		let host = mount(
			<SettingsSection title="Members" save="none">
				<ul>
					<li>Ada</li>
				</ul>
			</SettingsSection>,
		);

		expect(host.querySelector("section")?.dataset.save).toBe("none");
		expect(host.querySelector("form")).toBeNull();
		expect(host.querySelector('[data-slot="settings-footer"]')).toBeNull();
		expect(host.querySelector("noscript")).toBeNull();
		expect(host.querySelector('[data-slot="settings-instant-save"]')).toBeNull();
		expect(host.querySelector('[data-slot="settings-card"] li')?.textContent).toBe("Ada");
	});

	for (let heading of ["above", "beside"] as const) {
		test(`puts actions on the title row at its end in a wide container (heading ${heading})`, () => {
			let host = mount(membersSection(heading), 960);
			let { title, actions, row } = headerParts(host);

			expect(Math.abs(actions.top - title.top)).toBeLessThan(8);
			expect(actions.left).toBeGreaterThanOrEqual(title.right);
			expect(Math.abs(row.right - actions.right)).toBeLessThan(2);
		});

		test(`wraps actions under the title in a narrow container (heading ${heading})`, () => {
			let host = mount(membersSection(heading, "Team members and their roles"), 320);
			let { title, actions } = headerParts(host);

			expect(actions.top).toBeGreaterThanOrEqual(title.bottom);
			expect(host.querySelector("section")!.scrollWidth).toBeLessThanOrEqual(320);
			expect(actions.right).toBeLessThanOrEqual(host.getBoundingClientRect().right);
		});
	}
});

/** A billing section whose one row opens the billing portal, placed as `actionPlacement` says. */
function billingSection(actionPlacement?: SettingsSection.ActionPlacement) {
	return (
		<SettingsSection title="Billing" save="none">
			<SettingsSection.Row
				layout="action"
				actionPlacement={actionPlacement}
				label="Subscription & Payments"
				description="Change your plan, update the card on file, and download invoices. Billing is handled by our payment provider, which opens in a new tab. Changes apply from the next billing cycle."
			>
				<LinkButton href="/billing/portal" size="sm" variant="outline">
					Open Billing Portal
				</LinkButton>
			</SettingsSection.Row>
		</SettingsSection>
	);
}

/** The vertical centre of `box`. */
function centre(box: DOMRect): number {
	return box.top + box.height / 2;
}

/** A list-only members section with an "Invite member" header action. */
function membersSection(heading: "above" | "beside", title = "Members") {
	return (
		<SettingsSection
			title={title}
			description="People with access to this team."
			heading={heading}
			save="none"
			actions={
				<Button type="button" size="sm" variant="outline">
					Invite member
				</Button>
			}
		>
			<ul>
				<li>Ada</li>
			</ul>
		</SettingsSection>
	);
}

/** The title, the actions slot and the title row of the section in `host`. */
function headerParts(host: HTMLElement): { title: DOMRect; actions: DOMRect; row: DOMRect } {
	let actions = host.querySelector('[data-slot="settings-actions"]');
	expect(actions).not.toBeNull();
	return {
		title: host.querySelector("h2")!.getBoundingClientRect(),
		actions: actions!.getBoundingClientRect(),
		row: actions!.parentElement!.getBoundingClientRect(),
	};
}

/** Counts the submissions of every form in `host`, keyed by action, holding each one back. */
function countSubmits(host: HTMLElement): () => Record<string, number> {
	let counts: Record<string, number> = {};
	for (let form of host.querySelectorAll("form")) {
		let action = form.getAttribute("action")!;
		counts[action] = 0;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			counts[action]!++;
		});
	}
	return () => ({ ...counts });
}

/** Reports whether the last keystroke reached the window with its default action still due. */
function watchDefault(): () => boolean {
	let due = false;
	globalThis.addEventListener("keydown", (event) => {
		due = !event.defaultPrevented;
	});
	return () => due;
}

/** Lets the islands mount. */
function frame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
