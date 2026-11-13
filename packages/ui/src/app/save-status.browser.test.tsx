/**
 * Drives the save status in a real browser with short durations: "Saving…" holds for its
 * minimum however fast the save, "Saved" decays to the edit time, failures offer Retry,
 * and each outcome lands in a polite live region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import type { SaveStatusProps } from "./save-status.js";

import { setSaveStatus } from "./mixins/save-status-sync.js";
import { SaveStatus } from "./save-status.js";
import { formatEditedTime } from "./utils/edited-time.js";

const LABELS: SaveStatusProps["labels"] = {
	saving: "Saving…",
	saved: "Saved",
	failed: "Failed",
	retry: "Retry",
	edited: "Edited {time}",
};

/** Disposes every island the test mounted, clearing its timers. */
let cleanups: Array<() => void> = [];

/** Mounts a status with short durations and returns its element. */
async function mount(props: Partial<SaveStatusProps> = {}): Promise<HTMLElement> {
	let mounted = render(
		<SaveStatus id="post-status" labels={LABELS} holdMs={200} savedMs={200} {...props} />,
	);
	cleanups.push(mounted.cleanup);
	await wait(0);
	return document.getElementById("post-status")!;
}

/** Resolves after `ms` milliseconds. */
function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The text the live region holds. */
function announced(element: HTMLElement): string {
	return element.querySelector('[role="status"]')!.textContent ?? "";
}

afterEach(() => {
	for (let cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
	document.body.removeAttribute("style");
});

describe("SaveStatus", () => {
	test("announces through a polite live region", async () => {
		let element = await mount();
		let region = element.querySelector('[role="status"]')!;

		expect(region.getAttribute("aria-live")).toBe("polite");
		setSaveStatus("post-status", "saving");
		await wait(20);
		expect(announced(element)).toBe("Saving…");
	});

	test("holds Saving… for its minimum even when the save answers at once", async () => {
		let element = await mount();

		setSaveStatus(element, "saving");
		setSaveStatus(element, "saved");
		await wait(100);
		expect(announced(element)).toBe("Saving…");

		await wait(150);
		expect(announced(element)).toBe("Saved");
		expect(element.dataset.state).toBe("saved");
	});

	test("decays Saved to the edit time, outside the live region", async () => {
		let element = await mount({ holdMs: 0 });

		setSaveStatus(element, "saved");
		await wait(20);
		expect(announced(element)).toBe("Saved");

		await wait(250);
		expect(announced(element)).toBe("");
		let edited = element.querySelector("time")!;
		expect(edited.hidden).toBe(false);
		expect(edited.textContent).toMatch(/^Edited /);
		expect(edited.closest('[role="status"]')).toBeNull();
		expect(Date.parse(edited.dateTime)).not.toBeNaN();
	});

	test("decays a server-rendered Saved too", async () => {
		let element = await mount({ state: "saved", editedAt: new Date().toISOString() });

		expect(announced(element)).toBe("Saved");
		await wait(250);
		expect(element.querySelector("time")!.hidden).toBe(false);
	});

	test("shows Saved when the page redraws it in place after a save, then decays", async () => {
		let mounted = render(
			<SaveStatus id="post-status" labels={LABELS} holdMs={200} savedMs={200} />,
		);
		cleanups.push(mounted.cleanup);
		await wait(0);
		let element = document.getElementById("post-status")!;
		expect(announced(element)).toBe("");

		mounted.root.render(
			<SaveStatus
				id="post-status"
				labels={LABELS}
				holdMs={200}
				savedMs={200}
				state="saved"
				editedAt={new Date().toISOString()}
			/>,
		);
		mounted.root.flush();
		await wait(0);

		expect(element.isConnected).toBe(true);
		expect(announced(element)).toBe("Saved");
		await wait(250);
		expect(element.dataset.state).toBe("idle");
		expect(element.querySelector("time")!.hidden).toBe(false);
	});

	test("shows a failure in the danger tone with a Retry that reports itself", async () => {
		document.body.style.setProperty("--ui-danger-fg", "rgb(200, 30, 30)");
		let element = await mount({ holdMs: 0 });
		let retried = 0;
		document.addEventListener("ui:save-status-retry", () => retried++);

		setSaveStatus(element, "failed");
		await wait(20);

		expect(announced(element)).toBe("Failed");
		expect(getComputedStyle(element).color).toBe("rgb(200, 30, 30)");
		expect(element.dataset.state).toBe("failed");
		let retry = element.querySelector("button")!;
		expect(retry.textContent).toBe("Retry");
		retry.click();
		expect(retried).toBe(1);
	});

	test("renders Retry as a submit for the form it names, so it works without script", async () => {
		let element = await mount({ state: "failed", form: "post-form" });
		let retry = element.querySelector("button")!;

		expect(retry.type).toBe("submit");
		expect(retry.getAttribute("form")).toBe("post-form");
	});
});

describe("formatEditedTime", () => {
	let now = new Date("2026-11-01T12:00:00Z");

	test("reads relative within the decay and as a timestamp after it", () => {
		let day = 24 * 60 * 60 * 1000;

		expect(formatEditedTime(new Date("2026-11-01T11:58:00Z"), now, day, "en")).toMatch(/2/);
		expect(formatEditedTime(new Date("2026-11-01T11:58:00Z"), now, day, "en")).toMatch(/ago/);
		expect(formatEditedTime(new Date("2026-10-29T09:30:00Z"), now, day, "en")).toMatch(/Oct/);
	});
});
