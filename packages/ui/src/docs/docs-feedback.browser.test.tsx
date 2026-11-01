/**
 * Runs the docs feedback form in a real browser with no hydration: the note stays hidden
 * until a vote is picked, the native submit carries the vote, the page and the note, and
 * the `sent` state swaps the form for a live thank-you. Nothing overflows at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DocsFeedback } from "./docs-feedback.js";

const LABELS: DocsFeedback.Labels = {
	question: "Was this page helpful?",
	yes: "Yes",
	no: "No",
	note: "Anything we could add? (optional)",
	send: "Send feedback",
	thanks: "Thanks for the feedback",
};

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The visible question the votes answer. */
function question(host: HTMLElement): HTMLElement {
	return host.querySelector<HTMLElement>('[data-slot="docs-feedback-question"]')!;
}

/** The note panel the vote reveals. */
function note(host: HTMLElement): HTMLElement {
	return host.querySelector<HTMLElement>('[data-slot="docs-feedback-note"]')!;
}

/** The pill wrapping the vote with `value`. */
function choice(host: HTMLElement, value: "yes" | "no"): HTMLLabelElement {
	return host.querySelector(`input[value="${value}"]`)!.closest("label")!;
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("DocsFeedback", () => {
	test("posts to the action as a plain form", () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);
		let form = host.querySelector("form")!;

		expect(form.method).toBe("post");
		expect(form.getAttribute("action")).toBe("/docs/feedback");
	});

	test("hides the note until a vote is picked, then reveals it", async () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);

		expect(getComputedStyle(note(host)).display).toBe("none");
		await userEvent.click(choice(host, "no"));
		expect(getComputedStyle(note(host)).display).toBe("grid");
		expect(host.querySelector("textarea")!.getBoundingClientRect().height).toBeGreaterThan(0);
	});

	test("submits the vote, the page and the note through the native form", async () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);
		let form = host.querySelector("form")!;
		let submitted: FormData | undefined;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			submitted = new FormData(form, event.submitter);
		});

		await userEvent.click(choice(host, "no"));
		await userEvent.fill(host.querySelector("textarea")!, "Add a webhook example");
		await userEvent.click(host.querySelector('button[type="submit"]')!);

		expect(submitted?.get("helpful")).toBe("no");
		expect(submitted?.get("page")).toBe("/docs/alerts");
		expect(submitted?.get("note")).toBe("Add a webhook example");
	});

	test("lets the vote be picked from the keyboard and rings the focused pill", async () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);

		await userEvent.tab();
		expect(document.activeElement).toBe(host.querySelector('input[value="yes"]'));
		expect(getComputedStyle(choice(host, "yes")).outlineStyle).not.toBe("none");
		await userEvent.keyboard(" ");
		expect(host.querySelector<HTMLInputElement>('input[value="yes"]')!.checked).toBe(true);
	});

	test("thanks the reader through a live status in the sent state", () => {
		let host = mount(
			<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} state="sent" />,
		);
		let status = host.querySelector('[role="status"]')!;

		expect(host.querySelector("form")).toBeNull();
		expect(status.textContent).toBe("Thanks for the feedback");
	});

	test("keeps the question at body size", () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);

		expect(Number.parseFloat(getComputedStyle(question(host)).fontSize)).toBeLessThanOrEqual(16);
	});

	test("names the vote group with the question", () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);
		let group = host.querySelector('[role="radiogroup"]')!;
		let label = document.getElementById(group.getAttribute("aria-labelledby")!);

		expect(label?.textContent).toBe("Was this page helpful?");
	});

	test("centres the question on the votes' line as an item of the same flex row", () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);
		let row = question(host).parentElement!;
		let text = question(host).getBoundingClientRect();
		let vote = choice(host, "yes").getBoundingClientRect();

		/**
		 * A floated `legend` in a flex `fieldset` lays out as a flex item in Chromium only;
		 * WebKit draws it above the row, so the row must be an ordinary element.
		 */
		expect(row.tagName).not.toBe("FIELDSET");
		expect(getComputedStyle(row).display).toBe("flex");
		expect(Math.abs(text.top + text.height / 2 - (vote.top + vote.height / 2))).toBeLessThanOrEqual(
			1,
		);
	});

	test("leaves room between the question and the votes once they wrap", () => {
		let host = mount(
			<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />,
			200,
		);
		let asked = question(host).getBoundingClientRect();
		let vote = choice(host, "yes").getBoundingClientRect();

		expect(vote.top).toBeGreaterThan(asked.bottom);
		expect(vote.top - asked.bottom).toBeGreaterThanOrEqual(16);
	});

	test("fits a 320px viewport with the note open", async () => {
		await page.viewport(320, 640);
		let host = mount(
			<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />,
			288,
		);

		await userEvent.click(choice(host, "yes"));
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	test("aims the vote at a named frame and keeps the scroll when asked", () => {
		let host = mount(
			<DocsFeedback
				action="/docs/feedback"
				page="/docs/alerts"
				labels={LABELS}
				frame="feedback"
				resetScroll="manual"
			/>,
		);
		let form = host.querySelector("form")!;
		expect(form.getAttribute("data-rmx-target")).toBe("feedback");
		expect(form.getAttribute("data-rmx-reset-scroll")).toBe("manual");
	});

	test("leaves the form a plain navigation without them", () => {
		let host = mount(<DocsFeedback action="/docs/feedback" page="/docs/alerts" labels={LABELS} />);
		let form = host.querySelector("form")!;
		expect(form.hasAttribute("data-rmx-target")).toBe(false);
		expect(form.hasAttribute("data-rmx-reset-scroll")).toBe(false);
	});
});
