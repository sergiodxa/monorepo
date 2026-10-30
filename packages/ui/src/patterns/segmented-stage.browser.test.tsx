/**
 * Runs {@link SegmentedStage} in a real browser: the control centres over the stage, a
 * click or an arrow key swaps the visible panel through the radio group alone, the stage
 * keeps one height across panels, and a phone scrolls the control inside itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { SegmentedStage } from "./segmented-stage.js";

import "../reset.css";

/**
 * Mounts a three-tab stage with panels of different heights in a `width`-pixel column,
 * named after the stages already on the page so each mount gets its own radio group.
 */
function mountStage(
	width: number,
	labels = ["Board", "Inbox", "API"],
	align?: SegmentedStage.Align,
): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	let [board, inbox, api] = labels;
	let mounted = document.querySelectorAll('[data-slot="segmented-stage"]').length;
	return render(
		<SegmentedStage name={`hero-${mounted}`} aria-label="Product views" align={align}>
			<SegmentedStage.Item value="board" label={board} defaultChecked>
				<div style={{ height: "120px" }}>Board panel</div>
			</SegmentedStage.Item>
			<SegmentedStage.Item value="inbox" label={inbox}>
				<div style={{ height: "320px" }}>Inbox panel</div>
			</SegmentedStage.Item>
			<SegmentedStage.Item value="api" label={api}>
				<div style={{ height: "200px" }}>
					<a href="/docs">Read the docs</a>
				</div>
			</SegmentedStage.Item>
		</SegmentedStage>,
		{ container: host },
	).container;
}

/** The panel for `value`. */
function panel(root: HTMLElement, value: string): HTMLElement {
	return root.querySelector<HTMLElement>(
		`[data-slot="segmented-stage-panel"][data-value="${value}"]`,
	)!;
}

/** Waits for the next frame so style changes from a radio switch apply. */
function frame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe("SegmentedStage", () => {
	test("centres a 44px control with 36px tabs over the stage", () => {
		let root = mountStage(1280);
		let control = root.querySelector<HTMLElement>('[data-slot="segmented-stage-control"]')!;
		let stage = root.querySelector<HTMLElement>('[data-slot="segmented-stage-panels"]')!;
		let tab = root.querySelector<HTMLElement>('[data-slot="segmented-stage-tab"]')!;
		let box = control.getBoundingClientRect();
		let stageBox = stage.getBoundingClientRect();

		expect(tab.getBoundingClientRect().height).toBe(36);
		expect(box.height).toBe(44);
		expect(Math.abs(box.left - stageBox.left - (stageBox.right - box.right))).toBeLessThanOrEqual(
			1,
		);
		expect(getComputedStyle(tab).fontSize).toBe("14px");
		expect(getComputedStyle(tab).fontWeight).toBe("500");
	});

	test("puts the control on the stage's start edge when aligned to the start", () => {
		let root = mountStage(1280, undefined, "start");
		let control = root.querySelector<HTMLElement>('[data-slot="segmented-stage-control"]')!;
		let stage = root.querySelector<HTMLElement>('[data-slot="segmented-stage-panels"]')!;

		expect(control.getBoundingClientRect().left).toBe(stage.getBoundingClientRect().left);
	});

	test("swaps panels on a tab click without changing the stage height", async () => {
		let root = mountStage(1280);
		let stage = root.querySelector<HTMLElement>('[data-slot="segmented-stage-panels"]')!;
		let height = stage.getBoundingClientRect().height;

		expect(height).toBe(320);
		expect(getComputedStyle(panel(root, "board")).visibility).toBe("visible");
		expect(getComputedStyle(panel(root, "inbox")).visibility).toBe("hidden");

		root.querySelectorAll<HTMLElement>('[data-slot="segmented-stage-tab"]')[1]!.click();
		await frame();

		expect(getComputedStyle(panel(root, "board")).visibility).toBe("hidden");
		expect(getComputedStyle(panel(root, "inbox")).visibility).toBe("visible");
		expect(stage.getBoundingClientRect().height).toBe(height);
	});

	test("moves the selection with arrow keys and rings the focused tab", async () => {
		let root = mountStage(1280);
		let first = root.querySelector<HTMLInputElement>('input[value="board"]')!;
		first.focus();
		await userEvent.keyboard("{ArrowRight}");
		await frame();

		let second = root.querySelector<HTMLInputElement>('input[value="inbox"]')!;
		expect(second.checked).toBe(true);
		expect(document.activeElement).toBe(second);
		expect(getComputedStyle(panel(root, "inbox")).visibility).toBe("visible");
		let tab = second.closest("label")!;
		expect(getComputedStyle(tab).outlineStyle).toBe("solid");
	});

	test("keeps a hidden panel's links out of reach", () => {
		let root = mountStage(1280);
		let link = panel(root, "api").querySelector("a")!;
		link.focus();

		expect(document.activeElement).not.toBe(link);
	});

	test("scrolls the control inside itself on a phone when the labels do not fit", () => {
		let root = mountStage(375, ["Kanban board", "Shared inbox", "REST and webhooks"]);
		let scroller = root.querySelector<HTMLElement>('[data-slot="segmented-stage-scroller"]')!;
		let stage = root.querySelector<HTMLElement>('[data-slot="segmented-stage"]')!;

		expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
		expect(scroller.getBoundingClientRect().width).toBeLessThanOrEqual(375);
		expect(stage.scrollWidth).toBeLessThanOrEqual(375);
		expect(
			root
				.querySelector<HTMLElement>('[data-slot="segmented-stage-control"]')!
				.getBoundingClientRect().left,
		).toBe(scroller.getBoundingClientRect().left);
	});
});
