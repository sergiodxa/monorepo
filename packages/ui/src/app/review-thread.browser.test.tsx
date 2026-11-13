/**
 * Reads a review thread in a real browser: open with its reply and resolve forms aimed at
 * the thread's frame, resolved and outdated folded to one line, a suggestion drawn as a small
 * diff with its apply form, pending comments badged, an excerpt above, and dark as light.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { diffLines } from "@sdxc/diff";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ReviewThread } from "./review-thread.js";

import "../reset.css";
import "../theme.css";

const LABELS: ReviewThread.Labels = {
	reply: "Reply",
	replyPlaceholder: "Reply…",
	resolve: "Resolve conversation",
	unresolve: "Unresolve conversation",
	outdated: "Outdated",
	pending: "Pending",
	suggestion: "Suggested change",
	applySuggestion: "Apply suggestion",
	columns: {
		oldNumber: "Original file line number",
		newNumber: "Diff line number",
		oldText: "Original file line",
		change: "Diff line change",
	},
};

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
	brand: [250, 0.15],
	neutral: [250, 0.01],
	success: [150, 0.15],
	warning: [85, 0.16],
	danger: [25, 0.2],
};

/** Two comments, the second one unsent. */
const COMMENTS: ReviewThread.Comment[] = [
	{
		id: "discussion_r1",
		avatar: <span>A</span>,
		author: "ana",
		action: "commented",
		time: "2d ago",
		body: <p>Should this be 50?</p>,
	},
	{
		id: "discussion_r2",
		avatar: <span>B</span>,
		author: "ben",
		action: "commented",
		time: "now",
		pending: true,
		body: <p>Yes, see the spec.</p>,
	},
];

/** A one-line suggestion, as `@sdxc/diff` computes it. */
const SUGGESTION = diffLines("let value5 = 5;\n", "let value5 = 50;\n").hunks;

let mounted: RenderResult | undefined;

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
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	document.documentElement.removeAttribute("style");
	document.documentElement.classList.remove("dark");
});

/** Mounts a thread and returns its root. */
function mount(props: Partial<ReviewThread.Props> = {}): HTMLElement {
	mounted = render(
		<ReviewThread
			id="thread-1"
			frame="thread-1"
			comments={COMMENTS}
			replyAction="/threads/1/replies"
			resolveAction="/threads/1/resolve"
			fields={<input type="hidden" name="csrf" value="token" />}
			labels={LABELS}
			{...props}
		/>,
	);
	return document.querySelector<HTMLElement>('[data-slot="review-thread"]')!;
}

describe("ReviewThread open", () => {
	test("shows its comments, a reply box and Resolve, every form reloading the thread's frame", () => {
		let root = mount();
		let reply = root.querySelector<HTMLFormElement>('[data-slot="review-thread-reply"]')!;
		let resolve = root.querySelector<HTMLFormElement>('[data-slot="review-thread-resolve"]')!;

		expect(root.getAttribute("data-state")).toBe("open");
		expect(root.querySelector("details")).toBeNull();
		expect(root.querySelectorAll('[data-slot="timeline-comment"]')).toHaveLength(2);
		expect(reply.method).toBe("post");
		expect(reply.getAttribute("action")).toBe("/threads/1/replies");
		expect(reply.getAttribute("data-rmx-target")).toBe("thread-1");
		expect(reply.querySelector("textarea")!.name).toBe("body");
		expect(reply.querySelector<HTMLInputElement>('input[name="csrf"]')!.value).toBe("token");
		expect(resolve.getAttribute("data-rmx-target")).toBe("thread-1");
		expect(resolve.querySelector<HTMLInputElement>('input[name="resolved"]')!.value).toBe("true");
		expect(resolve.textContent).toBe("Resolve conversation");
	});

	test("badges an unsent comment as pending, and only that one", () => {
		let root = mount();
		let pending = root.querySelectorAll('[data-slot="review-thread-pending"]');

		expect(pending).toHaveLength(1);
		expect(pending[0]!.closest('[data-slot="timeline-comment"]')!.id).toBe("discussion_r2");
		expect(pending[0]!.textContent).toBe("Pending");
	});

	test("draws the code it is about above the comments on the timeline", () => {
		let root = mount({ excerpt: { path: "app/routes.ts", hunks: SUGGESTION, language: "ts" } });
		let excerpt = root.querySelector<HTMLElement>('[data-slot="review-thread-excerpt"]')!;
		let comments = root.querySelector('[data-slot="timeline"]')!;

		expect(excerpt.querySelector("figcaption")!.textContent).toBe("app/routes.ts");
		expect(excerpt.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			comments.getBoundingClientRect().top,
		);
		expect(excerpt.querySelector("[id]")).toBeNull();
	});
});

describe("ReviewThread folded", () => {
	test("folds a resolved thread to one line that opens on a click, offering Unresolve", async () => {
		let root = mount({
			resolved: true,
			resolvedSummary: "ana marked this conversation as resolved",
		});
		let details = root.querySelector("details")!;
		let summary = root.querySelector("summary")!;

		expect(root.getAttribute("data-state")).toBe("resolved");
		expect(details.open).toBe(false);
		expect(summary.textContent).toBe("ana marked this conversation as resolved");
		expect(summary.getBoundingClientRect().height).toBeLessThan(48);

		await userEvent.click(summary);
		expect(details.open).toBe(true);
		expect(root.querySelector('[data-slot="review-thread-resolve"]')!.textContent).toBe(
			"Unresolve conversation",
		);
		expect(root.querySelector<HTMLInputElement>('input[name="resolved"]')!.value).toBe("false");
	});

	test("folds an outdated thread behind its label and path, keeping the original excerpt", () => {
		let root = mount({ outdated: true, excerpt: { path: "app/routes.ts", hunks: SUGGESTION } });
		let summary = root.querySelector("summary")!;

		expect(root.getAttribute("data-state")).toBe("outdated");
		expect(root.querySelector("details")!.open).toBe(false);
		expect(summary.querySelector('[data-slot="review-thread-outdated"]')!.textContent).toBe(
			"Outdated",
		);
		expect(summary.textContent).toContain("app/routes.ts");
		expect(root.querySelector('[data-slot="review-thread-excerpt"]')).not.toBeNull();
	});
});

describe("ReviewThread suggestion", () => {
	test("draws the change as a small diff with its marks and an apply form for the frame", () => {
		let root = mount({
			suggestion: {
				path: "app/routes.ts",
				hunks: SUGGESTION,
				language: "ts",
				applyAction: "/threads/1/apply",
			},
		});
		let block = root.querySelector<HTMLElement>('[data-slot="review-thread-suggestion"]')!;
		let apply = block.querySelector<HTMLFormElement>('[data-slot="review-thread-apply"]')!;
		let rows = [...block.querySelectorAll("tbody tr:not([data-hunk])")];

		expect(block.textContent).toContain("Suggested change");
		expect(rows.map((row) => row.getAttribute("data-kind"))).toEqual(["del", "add"]);
		expect(rows[1]!.querySelector("mark")!.textContent).toBe("50");
		expect(apply.getAttribute("action")).toBe("/threads/1/apply");
		expect(apply.getAttribute("data-rmx-target")).toBe("thread-1");
		expect(apply.textContent).toBe("Apply suggestion");
	});
});

describe("ReviewThread themes", () => {
	test("is designed in dark as in light, and fits a phone without sideways scroll", async () => {
		let root = mount({ suggestion: { path: "app/routes.ts", hunks: SUGGESTION } });
		let added = root.querySelector<HTMLElement>('tr[data-kind="add"] > td:last-child')!;
		let lightRoot = getComputedStyle(root).backgroundColor;
		let lightAdded = getComputedStyle(added).backgroundColor;

		document.documentElement.classList.add("dark");
		expect(getComputedStyle(root).backgroundColor).not.toBe(lightRoot);
		expect(getComputedStyle(added).backgroundColor).not.toBe(lightAdded);

		await page.viewport(375, 812);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});
});
