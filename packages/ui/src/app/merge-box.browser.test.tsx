/**
 * Runs the merge box in a real browser: each precondition is its own toned row, the split button
 * merges with the method picked from its radio menu by keyboard alone, a blocked box keeps the
 * button on screen, disabled and described by its reason, and a settled box offers its follow-up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { CheckRuns } from "./check-runs.js";
import { MergeBox } from "./merge-box.js";

import "../reset.css";
import "../theme.css";

/** Lightness of each palette step, so every tone the theme reads resolves to a real colour. */
const STEPS: Record<number, number> = {
	50: 0.97,
	100: 0.94,
	200: 0.88,
	300: 0.8,
	400: 0.7,
	500: 0.62,
	600: 0.55,
	700: 0.48,
	800: 0.4,
	900: 0.32,
	950: 0.24,
};

/** Hue and chroma per tone, as an app's palette would set them. */
const HUES: Record<string, [hue: number, chroma: number]> = {
	brand: [75, 0.13],
	neutral: [75, 0.008],
	success: [150, 0.15],
	warning: [85, 0.16],
	danger: [25, 0.2],
};

/** English strings for every state. */
const LABELS: MergeBox.Labels = {
	methods: { merge: "Merge pull request", squash: "Squash and merge", rebase: "Rebase and merge" },
	methodDetails: {
		merge: "All commits will be added to the base branch via a merge commit.",
		squash: "The commits will be combined into one commit in the base branch.",
		rebase: "The commits will be rebased and added to the base branch.",
	},
	chooseMethod: "Choose a merge method",
	status: {
		blocked: "Merging is blocked: 1 approving review is required.",
		conflicts: "This branch has conflicts that must be resolved before it can merge.",
		merged: "Pull request merged and closed",
		closed: "Pull request closed without merging",
	},
};

/** Every precondition met. */
const READY_ROWS: MergeBox.Rows = {
	reviews: { tone: "success", title: "Changes approved", detail: "1 approving review" },
	checks: { tone: "success", title: "All checks have passed", detail: "24 successful checks" },
	conflicts: { tone: "success", title: "No conflicts with base branch" },
};

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let element = root.querySelector<T>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

/** Keeps the next submit of `form` in the page and resolves with what it would have posted. */
function nextSubmit(form: HTMLFormElement): Promise<FormData> {
	return new Promise((resolve) => {
		form.addEventListener(
			"submit",
			(event) => {
				event.preventDefault();
				resolve(new FormData(form, event.submitter));
			},
			{ once: true },
		);
	});
}

beforeEach(async () => {
	await page.viewport(1024, 768);
	for (let [tone, [hue, chroma]] of Object.entries(HUES)) {
		for (let [step, lightness] of Object.entries(STEPS)) {
			document.documentElement.style.setProperty(
				`--ui-color-${tone}-${step}`,
				`oklch(${lightness} ${chroma} ${hue})`,
			);
		}
	}
});

afterEach(() => {
	document.documentElement.removeAttribute("style");
	document.body.replaceChildren();
});

describe("MergeBox", () => {
	test("draws one ruled row per precondition with a toned icon, title and detail", () => {
		let host = mount(
			<MergeBox
				state="blocked"
				action="/merge"
				labels={LABELS}
				rows={{
					reviews: { tone: "warning", title: "Review required", detail: "1 approval needed" },
					checks: { tone: "danger", title: "Some checks failed" },
					conflicts: { tone: "success", title: "No conflicts with base branch" },
				}}
			/>,
		);
		let rows = [...host.querySelectorAll<HTMLElement>('[data-slot="merge-box-row"]')];

		expect(rows.map((row) => row.dataset.row)).toEqual(["reviews", "checks", "conflicts"]);
		expect(rows.map((row) => row.dataset.tone)).toEqual(["warning", "danger", "success"]);
		expect(find(rows[0]!, '[data-slot="merge-box-row-detail"]').textContent).toBe(
			"1 approval needed",
		);
		let icons = rows.map((row) => find(row, '[data-slot="merge-box-icon"]'));
		let fills = icons.map((icon) => getComputedStyle(icon).backgroundColor);
		expect(new Set(fills).size).toBe(3);
		let shapes = icons.map((icon) => icon.querySelector("svg")!.innerHTML);
		expect(new Set(shapes).size).toBe(3);
		expect(getComputedStyle(rows[1]!).borderTopWidth).toBe("1px");
	});

	test("holds a CheckRuns list inside the checks row", () => {
		let host = mount(
			<MergeBox
				state="ready"
				action="/merge"
				labels={LABELS}
				rows={{
					checks: {
						tone: "success",
						title: "All checks have passed",
						children: (
							<CheckRuns
								runs={[{ name: "test", state: "success" }]}
								labels={{
									counts: {
										failure: (n) => `${n} failing`,
										pending: (n) => `${n} pending`,
										success: (n) => `${n} successful`,
										skipped: (n) => `${n} skipped`,
										cancelled: (n) => `${n} cancelled`,
									},
									summary: (list, total) => `${list} ${total === 1 ? "check" : "checks"}`,
									states: {
										failure: "Failed",
										pending: "In progress",
										success: "Passed",
										skipped: "Skipped",
										cancelled: "Cancelled",
									},
									details: "Details",
									empty: "No checks",
								}}
							/>
						),
					},
				}}
			/>,
		);

		expect(find(host, '[data-row="checks"] summary').textContent).toContain("1 successful check");
	});

	test("merges with the method picked from the menu, by keyboard alone", async () => {
		let host = mount(<MergeBox state="ready" action="/merge" labels={LABELS} rows={READY_ROWS} />);
		let form = find<HTMLFormElement>(host, "form");
		let submit = find<HTMLButtonElement>(host, '[data-slot="merge-box-submit"]');
		let toggle = find<HTMLButtonElement>(host, '[data-slot="merge-box-toggle"]');
		let menu = find(host, '[data-slot="merge-box-methods"]');

		expect(form.getAttribute("method")).toBe("post");
		expect(submit.formMethod).toBe("post");
		expect(submit.disabled).toBe(false);
		await expect.element(page.getByRole("button", { name: "Merge pull request" })).toBeVisible();

		submit.focus();
		await userEvent.keyboard("{Tab}");
		expect(document.activeElement).toBe(toggle);
		await expect.element(page.getByRole("button", { name: "Choose a merge method" })).toBeVisible();

		await userEvent.keyboard("{Enter}");
		expect(menu.matches(":popover-open")).toBe(true);
		await userEvent.keyboard("{Tab}");
		expect((document.activeElement as HTMLInputElement).value).toBe("merge");
		await userEvent.keyboard("{ArrowDown}");
		expect((document.activeElement as HTMLInputElement).value).toBe("squash");
		expect((document.activeElement as HTMLInputElement).checked).toBe(true);
		await expect.element(page.getByRole("button", { name: "Squash and merge" })).toBeVisible();

		await userEvent.keyboard("{Escape}");
		expect(menu.matches(":popover-open")).toBe(false);
		expect(document.activeElement).toBe(toggle);

		let posted = nextSubmit(form);
		submit.focus();
		await userEvent.keyboard("{Enter}");
		expect((await posted).getAll("method")).toEqual(["squash"]);
	});

	test("starts on the default method and posts any extra fields", async () => {
		let host = mount(
			<MergeBox
				state="ready"
				action="/merge"
				labels={LABELS}
				methods={["squash", "rebase"]}
				defaultMethod="rebase"
				fields={<input type="hidden" name="csrf" value="token" />}
			/>,
		);
		let form = find<HTMLFormElement>(host, "form");

		expect(host.querySelectorAll('input[name="method"]')).toHaveLength(2);
		expect(find(host, '[data-slot="merge-box-submit"]').innerText).toBe("Rebase and merge");
		let posted = nextSubmit(form);
		find<HTMLButtonElement>(host, '[data-slot="merge-box-submit"]').click();
		let data = await posted;
		expect(data.get("method")).toBe("rebase");
		expect(data.get("csrf")).toBe("token");
	});

	for (let state of ["blocked", "conflicts"] as const) {
		test(`keeps the button on screen when ${state}, disabled and described by its reason`, async () => {
			let host = mount(
				<MergeBox state={state} action="/merge" labels={LABELS} rows={READY_ROWS} />,
			);
			let submit = find<HTMLButtonElement>(host, '[data-slot="merge-box-submit"]');
			let toggle = find<HTMLButtonElement>(host, '[data-slot="merge-box-toggle"]');
			let reason = LABELS.status[state]!;

			expect(submit.disabled).toBe(true);
			expect(toggle.disabled).toBe(true);
			expect(submit.checkVisibility()).toBe(true);
			for (let button of [submit, toggle]) {
				let id = button.getAttribute("aria-describedby")!;
				expect(document.getElementById(id)!.textContent).toBe(reason);
			}
			await expect.element(page.getByText(reason)).toBeVisible();
			await expect
				.element(page.getByRole("button", { name: "Merge pull request" }))
				.toHaveAccessibleDescription(reason);
		});
	}

	test("replaces the control with the outcome and its follow-up once merged", () => {
		let host = mount(
			<MergeBox
				state="merged"
				action="/merge"
				labels={LABELS}
				followUp={
					<form method="post" action="/branches/delete">
						<button type="submit">Delete branch</button>
					</form>
				}
			/>,
		);

		expect(host.querySelector('[data-slot="merge-box-form"]')).toBeNull();
		expect(find(host, '[data-slot="merge-box-status"]').textContent).toBe(
			"Pull request merged and closed",
		);
		expect(find(host, '[data-slot="merge-box-follow-up"] button').textContent).toBe(
			"Delete branch",
		);
	});

	test("tints a closed outcome apart from a merged one", () => {
		let merged = mount(<MergeBox state="merged" action="/merge" labels={LABELS} />);
		let closed = mount(<MergeBox state="closed" action="/merge" labels={LABELS} />);
		let fill = (host: HTMLElement) =>
			getComputedStyle(find(host, '[data-slot="merge-box-icon"]')).backgroundColor;

		expect(fill(merged)).not.toBe(fill(closed));
		expect(find(closed, '[data-slot="merge-box-status"]').textContent).toBe(
			"Pull request closed without merging",
		);
	});

	test("fits a 375px phone without scrolling the page sideways", async () => {
		await page.viewport(375, 812);
		let host = mount(
			<MergeBox state="blocked" action="/merge" labels={LABELS} rows={READY_ROWS} />,
			343,
		);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
		let box = find(host, '[data-slot="merge-box"]');
		expect(box.getBoundingClientRect().width).toBeLessThanOrEqual(343);
		let form = find(host, "form");
		expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
	});
});
