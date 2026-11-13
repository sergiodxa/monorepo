/**
 * Drives the job log in a real browser: a 20,000-line log under a node-per-line ceiling with
 * only the failed step open, numbers painted so copying skips them, toned ANSI spans, folds,
 * timestamps, search with Enter and ⇧Enter, and a live step that streams and follows its tail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { render } from "remix/component/test";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	onTestFinished,
	test,
} from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import type { LogLine } from "./utils/log-lines.js";

import { LogViewer } from "./log-viewer.js";

import "../theme.css";

const WORKER = setupWorker();

const ESC = "\u001b";

const LABELS: LogViewer.Labels = {
	log: "Job log",
	states: {
		success: "Succeeded",
		failure: "Failed",
		running: "In progress",
		queued: "Queued",
		skipped: "Skipped",
		cancelled: "Cancelled",
	},
	search: "Search logs",
	matches: "{index} of {count}",
	noMatches: "No results",
	previousMatch: "Previous match",
	nextMatch: "Next match",
	showTimestamps: "Show timestamps",
	hideTimestamps: "Hide timestamps",
	jumpToLatest: "Jump to latest",
	refresh: "Refresh",
};

/** Links a line the way a code host cites it. */
function lineHref(step: number, n: number): string {
	return `#step:${step}:${n}`;
}

/** `count` numbered lines of plain output, starting at `from`. */
function lines(count: number, from = 1, text = (n: number) => `output line ${n}`): LogLine[] {
	return Array.from({ length: count }, (_, index) => ({
		n: from + index,
		text: text(from + index),
	}));
}

/** A job of four steps and 20,000 lines; the third step fails at its end. */
function bigJob(): LogViewer.Step[] {
	let install = [
		{ n: 1, text: "##[group]Run bun install" },
		...lines(1_998, 2, (n) => `resolved package-${n}@1.0.${n}`),
		{ n: 2_000, text: "##[endgroup]" },
	];
	let test = [
		...lines(17_967, 1, (n) => `${ESC}[32m✓${ESC}[39m test ${n} passed`),
		{ n: 17_968, text: `${ESC}[31m✗ parses ANSI colours${ESC}[0m` },
		{ n: 17_969, text: "##[error]Process completed with exit code 1." },
	];
	return [
		{ name: "Set up job", state: "success", duration: "2s", lines: lines(30) },
		{ name: "Install", state: "success", duration: "41s", lines: install },
		{ name: "Test", state: "failure", duration: "3m 2s", lines: test },
		{ name: "Post checkout", state: "skipped", lines: lines(2) },
	];
}

/** A small job whose steps exercise every kind of line. */
function smallJob(): LogViewer.Step[] {
	return [
		{
			name: "Build",
			state: "success",
			duration: "12s",
			lines: [
				{ n: 1, text: "##[command]bun run build", ts: "2026-11-13T09:00:01.120Z" },
				{ n: 2, text: "##[group]Compile", ts: "2026-11-13T09:00:02.000Z" },
				{ n: 3, text: "compiled 12 modules", ts: "2026-11-13T09:00:03.000Z" },
				{ n: 4, text: "##[endgroup]", ts: "2026-11-13T09:00:03.500Z" },
				{
					n: 5,
					text: `${ESC}[1;33mwarning${ESC}[0m: large bundle`,
					ts: "2026-11-13T09:00:04.000Z",
				},
			],
		},
		{
			name: "Test",
			state: "failure",
			duration: "30s",
			lines: [
				{ n: 1, text: "##[group]Run tests" },
				{ n: 2, text: "error: expected 2 to be 3" },
				{ n: 3, text: "##[error]1 test failed" },
				{ n: 4, text: "##[endgroup]" },
				{ n: 5, text: "Error: Process exited" },
			],
		},
		{
			name: "Lint",
			state: "success",
			duration: "4s",
			lines: [{ n: 1, text: "no lint errors found" }],
		},
	];
}

let mounted: RenderResult | undefined;

beforeAll(async () => {
	await WORKER.start({ quiet: true, onUnhandledRequest: "bypass" });
});

beforeEach(async () => {
	await page.viewport(1280, 900);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	WORKER.resetHandlers();
	document.body.replaceChildren();
	history.replaceState(null, "", location.pathname);
});

afterAll(() => {
	WORKER.stop();
});

/** Mounts a viewer and lets its island wire up. */
async function mount(props: Partial<LogViewer.Props> & { steps: LogViewer.Step[] }) {
	mounted = render(<LogViewer lineHref={lineHref} labels={LABELS} {...props} />);
	await new Promise((resolve) => setTimeout(resolve, 0));
	return document.querySelector<HTMLElement>('[data-slot="log-viewer"]')!;
}

/** The step `<details>` at position `index` (from 1). */
function step(root: HTMLElement, index: number): HTMLDetailsElement {
	return root.querySelector<HTMLDetailsElement>(`[data-log-step="${index}"]`)!;
}

/** Waits until `check` passes, polling every frame for up to two seconds. */
async function until(check: () => boolean) {
	let started = performance.now();
	while (!check()) {
		if (performance.now() - started > 2_000) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 16));
	}
}

/**
 * Element and text nodes under `scope` per log line. A plain line is its row, its number link
 * and its text; each coloured run adds a span and the span's text.
 */
function nodesPerLine(scope: Element): number {
	let lineCount = scope.querySelectorAll("[data-log-line]").length;
	let body = scope.querySelector('[data-slot="log-step-body"]') ?? scope;
	let nodes = 0;
	let walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
	while (walker.nextNode()) {
		if (
			!(walker.currentNode instanceof Element) ||
			!walker.currentNode.matches(
				"[data-log-chunk], [data-log-group], [data-log-group-body], [data-log-live]",
			)
		)
			nodes++;
	}
	return nodes / lineCount;
}

describe("LogViewer", () => {
	test("turns a step's chevron without motion under reduced motion", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		onTestFinished(async () => {
			await cdp().send("Emulation.setEmulatedMedia", { features: [] });
		});
		let root = await mount({ steps: bigJob() });
		let chevron = root.querySelector<SVGElement>('[data-slot="log-step-chevron"]')!;
		expect(getComputedStyle(chevron).transitionDuration).toBe("0s");
	});

	test("draws every character as typed, with no ligatures", async () => {
		let root = await mount({ steps: bigJob() });
		let body = root.querySelector<HTMLElement>('[data-slot="log-viewer-body"]')!;
		expect(getComputedStyle(body).fontVariantLigatures).toBe("none");
	});

	test("draws a 20,000-line log in three nodes per plain line, with only the failed step open", async () => {
		let root = await mount({ steps: bigJob() });
		let rows = root.querySelectorAll("[data-log-line]");

		expect(rows.length).toBe(30 + 1_999 + 17_969 + 2);
		expect(nodesPerLine(step(root, 2))).toBeLessThan(3.01);
		expect(nodesPerLine(root.querySelector('[data-slot="log-viewer-body"]')!)).toBeLessThan(5);
		expect([1, 2, 3, 4].map((index) => step(root, index).open)).toEqual([
			false,
			false,
			true,
			false,
		]);
		let chunks = step(root, 3).querySelectorAll<HTMLElement>(":scope [data-log-chunk]");
		expect(chunks.length).toBe(Math.ceil(17_969 / 200));
		expect(getComputedStyle(chunks[0]!).contentVisibility).toBe("auto");
		expect(root.querySelectorAll("[data-log-group]")).toHaveLength(1);
	});

	test("opens a failed job on its first error line, centred in the log", async () => {
		let root = await mount({ steps: bigJob() });
		let body = root.querySelector<HTMLElement>('[data-slot="log-viewer-body"]')!;
		let error = step(root, 3).querySelector<HTMLElement>('[data-log-line][data-tone="danger"]')!;
		let line = error.getBoundingClientRect();
		let box = body.getBoundingClientRect();

		expect(body.scrollTop).toBeGreaterThan(0);
		expect(line.top).toBeGreaterThanOrEqual(box.top);
		expect(line.bottom).toBeLessThanOrEqual(box.bottom);
		expect(line.top).toBeGreaterThanOrEqual(0);
		expect(line.bottom).toBeLessThanOrEqual(window.innerHeight);
	});

	test("keeps the line an address names instead of the first error", async () => {
		history.replaceState(null, "", "#step:1:1");
		let root = await mount({ steps: bigJob() });

		expect(root.querySelector<HTMLElement>('[data-slot="log-viewer-body"]')!.scrollTop).toBe(0);
	});

	test("paints line numbers from attributes, so copying a line copies only its text", async () => {
		let root = await mount({ steps: smallJob() });
		let row = root.querySelector<HTMLElement>('[id="step:3:1"]')!;
		let link = row.querySelector("a")!;

		expect(link.getAttribute("href")).toBe("#step:3:1");
		expect(link.textContent).toBe("");
		expect(getComputedStyle(link, "::before").content).toBe('"1"');
		step(root, 3).open = true;
		let selection = getSelection()!;
		selection.selectAllChildren(row);
		expect(selection.toString()).toBe("no lint errors found");
	});

	test("tones ANSI runs and workflow annotations", async () => {
		document.documentElement.style.setProperty("--ui-warning-fg", "rgb(161, 98, 7)");
		document.documentElement.style.setProperty("--ui-danger-fg", "rgb(220, 38, 38)");
		let root = await mount({ steps: smallJob() });
		let warning = root.querySelector<HTMLElement>('[id="step:1:5"] [data-fg="yellow"]')!;
		let error = root.querySelector<HTMLElement>('[id="step:2:3"]')!;

		expect(warning.textContent).toBe("warning");
		expect(getComputedStyle(warning).color).toBe("rgb(161, 98, 7)");
		expect(Number(getComputedStyle(warning).fontWeight)).toBe(600);
		expect(error.getAttribute("data-tone")).toBe("danger");
		expect(error.textContent).toBe("1 test failed");
		expect(getComputedStyle(error).color).toBe("rgb(220, 38, 38)");
		expect(root.textContent).not.toContain("##[");
	});

	test("folds groups, opening the one that holds an error", async () => {
		let root = await mount({ steps: smallJob() });
		let [compile, tests] = root.querySelectorAll<HTMLDetailsElement>("[data-log-group]");

		expect(compile!.open).toBe(false);
		expect(compile!.querySelector("summary")!.textContent).toBe("Compile");
		expect(tests!.open).toBe(true);
		expect(root.querySelector('[id="step:1:4"]')).toBeNull();
		await userEvent.click(step(root, 1).querySelector("summary")!);
		await userEvent.click(compile!.querySelector("summary")!);
		expect(compile!.open).toBe(true);
		expect(root.querySelector<HTMLElement>('[id="step:1:3"]')!.checkVisibility()).toBe(true);
	});

	test("draws each line's time beside its number when timestamps are on", async () => {
		let root = await mount({ steps: smallJob(), timestamps: true, timestampsHref: "?" });
		let link = root.querySelector<HTMLElement>('[id="step:1:1"] > a')!;
		let toggle = root.querySelector<HTMLAnchorElement>('[data-slot="log-viewer-timestamps"]')!;

		expect(getComputedStyle(link, "::after").content).toBe('"09:00:01"');
		expect(toggle.textContent).toBe("Hide timestamps");
		expect(toggle.getAttribute("href")).toBe("?");
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
	});

	test("searches every line, stepping with Enter and ⇧Enter and opening closed steps", async () => {
		let root = await mount({ steps: smallJob() });
		let input = page.getByRole("searchbox", { name: "Search logs" });
		let count = root.querySelector<HTMLElement>("[data-log-search-count]")!;

		await expect.element(input).toBeVisible();
		await input.fill("error");
		await until(() => count.textContent === "1 of 3");
		expect(CSS.highlights.get("ui-log-match")?.size).toBe(3);
		expect(root.querySelector("[data-log-current]")!.id).toBe("step:2:2");

		await userEvent.keyboard("{Enter}");
		expect(count.textContent).toBe("2 of 3");
		await userEvent.keyboard("{Enter}");
		expect(count.textContent).toBe("3 of 3");
		await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
		expect(count.textContent).toBe("2 of 3");

		await input.fill("no lint");
		await until(() => count.textContent === "1 of 1");
		expect(step(root, 3).open).toBe(true);
		expect(root.querySelector("[data-log-current]")!.id).toBe("step:3:1");

		await input.fill("zzz");
		await until(() => count.textContent === "No results");
	});

	test("searches a 20,000-line log within a keystroke", async () => {
		let root = await mount({ steps: bigJob() });
		let input = root.querySelector<HTMLInputElement>("[data-log-search-input]")!;
		let count = root.querySelector<HTMLElement>("[data-log-search-count]")!;
		input.focus();
		input.value = "exit code";
		let started = performance.now();
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await until(() => count.textContent === "1 of 1");

		expect(performance.now() - started).toBeLessThan(1_000);
		expect(root.querySelector("[data-log-current]")!.id).toBe("step:3:17969");
	});

	test("streams a running step's lines into place and follows the tail until scrolled up", async () => {
		let send: (text: string) => void = () => {};
		let finish: () => void = () => {};
		WORKER.use(
			http.get("/runs/7/steps/2/log", () => {
				let body = new ReadableStream<Uint8Array>({
					start(controller) {
						let encoder = new TextEncoder();
						send = (text) => controller.enqueue(encoder.encode(text));
						finish = () => controller.close();
					},
				});
				return new HttpResponse(body, { headers: { "content-type": "text/plain" } });
			}),
		);
		let root = await mount({
			steps: [
				{ name: "Install", state: "success", duration: "4s", lines: lines(3) },
				{
					name: "Test",
					state: "running",
					lines: lines(60),
					stream: { src: "/runs/7/steps/2/log", refresh: "/runs/7" },
				},
			],
			style: "--ui-log-viewer-height: 300px",
		});
		let body = root.querySelector<HTMLElement>('[data-slot="log-viewer-body"]')!;
		let live = step(root, 2);
		let refresh = live.querySelector<HTMLElement>("[data-log-refresh]")!;
		let pill = root.querySelector<HTMLButtonElement>("[data-log-jump]")!;
		let atBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight <= 1;

		expect(live.open).toBe(true);
		await until(() => refresh.hidden === true);
		send(`2026-11-13T09:01:00.000Z ${ESC}[32mok${ESC}[0m test 61\n##[group]Retry\nretrying`);
		await until(() => root.querySelector('[id="step:2:61"]') !== null);
		let first = root.querySelector<HTMLElement>('[id="step:2:61"]')!;
		expect(first.textContent).toBe("ok test 61");
		expect(first.querySelector("a")!.dataset["ts"]).toBe("09:01:00");
		expect(first.querySelector('[data-fg="green"]')).not.toBeNull();
		expect(root.querySelector('[id="step:2:62"]')!.closest("[data-log-group]")).not.toBeNull();
		expect(root.querySelector('[id="step:2:63"]')).toBeNull();
		await until(atBottom);

		send(" once\n##[endgroup]\nafter group\n");
		await until(() => root.querySelector('[id="step:2:64"]') !== null);
		expect(root.querySelector('[id="step:2:63"]')!.textContent).toBe("retrying once");
		expect(root.querySelector('[id="step:2:64"]')!.closest("[data-log-group]")).toBeNull();
		await until(atBottom);
		expect(pill.hidden).toBe(true);

		body.scrollTop = 0;
		await new Promise((resolve) => setTimeout(resolve, 50));
		send(
			lines(20, 65)
				.map((line) => line.text)
				.join("\n") + "\n",
		);
		await until(() => root.querySelector('[id="step:2:84"]') !== null);
		expect(body.scrollTop).toBe(0);
		await expect.element(page.getByRole("button", { name: "Jump to latest" })).toBeVisible();

		await userEvent.click(pill);
		await until(atBottom);
		expect(pill.hidden).toBe(true);

		finish();
		await until(() => live.getAttribute("data-stream-end") === "done");
		expect(live.hasAttribute("data-stream-pending")).toBe(false);
		expect(refresh.hidden).toBe(false);
		expect(live.getAttribute("data-log-next")).toBe("85");
	});

	test("keeps the Refresh link when the stream fails", async () => {
		WORKER.use(http.get("/runs/8/log", () => new HttpResponse(null, { status: 503 })));
		let root = await mount({
			steps: [
				{
					name: "Deploy",
					state: "running",
					lines: lines(2),
					stream: { src: "/runs/8/log", refresh: "/runs/8" },
				},
			],
		});
		let live = step(root, 1);
		await until(() => live.getAttribute("data-stream-end") === "failed");
		let refresh = page.getByRole("link", { name: "Refresh" });
		await expect.element(refresh).toBeVisible();
		expect(refresh.element().getAttribute("href")).toBe("/runs/8");
	});
});
