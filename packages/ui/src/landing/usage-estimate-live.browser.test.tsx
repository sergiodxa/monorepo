/**
 * Runs a live {@link UsageEstimate} the way a page serves it: rendered on the server with its
 * bill frame inlined, then hydrated. Typing re-prices the bill with one document load and no
 * history entry, the newest request wins over a slow older one, and without script the form
 * still submits natively by GET.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime } from "remix/component";

import { run } from "remix/component";
import { renderToStream } from "remix/component/server";
import { afterEach, describe, expect, test } from "vitest";

import { UsageEstimate } from "./usage-estimate.js";

import "../reset.css";
import "../theme.css";

/** The bill frame's name, which the stand-in server answers. */
const FRAME = "pricing-bill";

/** The page the calculator lives on. */
const PAGE = "/pricing-under-test";

let runtime: AppRuntime | undefined;
let requests: string[] = [];
let startPath = "";
/** Milliseconds the stand-in server holds its answer for a given `hours`, to make it slow. */
let slow: Record<string, number> = {};

afterEach(() => {
	runtime?.dispose();
	runtime = undefined;
	requests = [];
	slow = {};
	document.body.replaceChildren();
	history.replaceState(null, "", startPath);
});

/** The bill for `hours` at $0.36 an hour, as the server prints it. */
function bill(address: string) {
	let hours = Number(new URL(address, location.origin).searchParams.get("hours") ?? "0");
	let amount = `$${(hours * 0.36).toFixed(2)}`;
	return (
		<UsageEstimate.Bill
			label="Estimated monthly bill"
			rows={[{ label: "Recorded hours", detail: `${hours} h × $0.36`, amount }]}
			total={{ label: "Per month", amount }}
		/>
	);
}

/** The calculator for `hours`, its bill a live frame. */
function page(hours: number) {
	return (
		<UsageEstimate
			action={`${PAGE}#pricing`}
			fields={
				<label>
					Hours <input type="number" name="hours" min="0" defaultValue={String(hours)} />
				</label>
			}
			submitLabel="Estimate"
			live={{ frame: FRAME, src: `${PAGE}?hours=${hours}`, delay: 20 }}
		/>
	);
}

/** Reads a rendered stream whole. */
async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
	return await new Response(stream).text();
}

/** Server-renders the page with its frame inlined and puts it in the document. */
async function serve(hours: number, script: boolean) {
	startPath ||= `${location.pathname}${location.search}`;
	history.replaceState(null, "", `${PAGE}?hours=${hours}`);
	let html = await text(
		renderToStream(page(hours), {
			frameSrc: location.href,
			resolveFrame: (src) => renderToStream(bill(src)),
		}),
	);
	document.body.innerHTML = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
	if (!script) return;
	for (let node of document.body.querySelectorAll("script")) {
		if (node.type === "application/json" || node.src !== "") continue;
		let live = document.createElement("script");
		for (let attribute of node.attributes) live.setAttribute(attribute.name, attribute.value);
		live.textContent = node.textContent;
		node.replaceWith(live);
	}
	runtime = run({
		loadModule: async (moduleUrl, exportName) => {
			if (moduleUrl !== "@sdxc/ui/landing/usage-estimate") throw new Error(moduleUrl);
			return (await import("./usage-estimate.js"))[exportName as "UsageEstimateLive"] as never;
		},
		resolveFrame: async (src, options) => {
			let url = new URL(src, location.origin);
			requests.push(`${url.pathname}${url.search} ${options?.target ?? "top"}`);
			let wait = slow[url.searchParams.get("hours") ?? ""] ?? 0;
			if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
			let body = await text(renderToStream(bill(url.href)));
			return new Response(body, { headers: { "Content-Type": "text/html" } });
		},
	});
	await runtime.ready();
}

/** The printed total. */
function total(): string {
	return document.querySelector("tfoot td")?.textContent ?? "";
}

/** Waits until `check` holds, polling on timers so a background tab still advances. */
async function until(check: () => boolean): Promise<void> {
	for (let tries = 0; tries < 100 && !check(); tries++) {
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	expect(check()).toBe(true);
}

/** Types `value` into the hours field the way a reader's keystrokes change it. */
function type(value: string) {
	let input = document.querySelector<HTMLInputElement>('input[name="hours"]')!;
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("UsageEstimate live", () => {
	test("inlines the bill on the server", async () => {
		await serve(40, false);
		expect(total()).toBe("$14.40");
	});

	test("re-prices the bill as the reader types, with one document load", async () => {
		await serve(40, true);
		let marker = document.querySelector<HTMLElement>("form")!;
		marker.dataset.kept = "yes";
		type("1");
		type("10");
		type("100");
		await until(() => total() === "$36.00");
		expect(requests).toEqual([`${PAGE}?hours=100 ${FRAME}`]);
		expect(document.querySelector<HTMLElement>("form")?.dataset.kept).toBe("yes");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("keeps focus in the field while the bill reloads", async () => {
		await serve(40, true);
		let input = document.querySelector<HTMLInputElement>('input[name="hours"]')!;
		input.focus();
		type("50");
		await until(() => total() === "$18.00");
		expect(document.activeElement).toBe(input);
	});

	test("moves the address to the query without adding a history entry", async () => {
		await serve(40, true);
		let entries = history.length;
		type("25");
		await until(() => location.search === "?hours=25");
		expect(history.length).toBe(entries);
		expect(total()).toBe("$9.00");
	});

	test("re-prices on submit in place of a page load", async () => {
		await serve(40, true);
		let input = document.querySelector<HTMLInputElement>('input[name="hours"]')!;
		input.value = "5";
		document.querySelector("form")!.requestSubmit();
		await until(() => total() === "$1.80");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("keeps the newest bill and address when an older answer arrives late", async () => {
		await serve(40, true);
		slow = { "10": 300 };
		type("10");
		await until(() => requests.length === 1);
		type("20");
		await until(() => total() === "$7.20");
		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(requests.map((request) => request.split(" ")[0])).toEqual([
			`${PAGE}?hours=10`,
			`${PAGE}?hours=20`,
		]);
		expect(total()).toBe("$7.20");
		expect(location.search).toBe("?hours=20");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("never falls back to a page load for a submit a newer one overtook", async () => {
		await serve(40, true);
		slow = { "10": 300 };
		let input = document.querySelector<HTMLInputElement>('input[name="hours"]')!;
		let form = document.querySelector("form")!;
		input.value = "10";
		form.requestSubmit();
		await until(() => requests.length === 1);
		input.value = "20";
		form.requestSubmit();
		await until(() => total() === "$7.20");
		await new Promise((resolve) => setTimeout(resolve, 400));
		expect(total()).toBe("$7.20");
		expect(location.search).toBe("?hours=20");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("leaves a field the reader is still fixing unpriced", async () => {
		await serve(40, true);
		type("-3");
		await new Promise((resolve) => setTimeout(resolve, 120));
		expect(requests).toEqual([]);
		expect(total()).toBe("$14.40");
	});

	test("submits natively by GET without script", async () => {
		await serve(40, false);
		let form = document.querySelector("form")!;
		let native: boolean | undefined;
		document.addEventListener(
			"submit",
			(event) => {
				native = !event.defaultPrevented;
				event.preventDefault();
			},
			{ once: true },
		);
		form.requestSubmit();
		expect(form.method).toBe("get");
		expect(native).toBe(true);
	});
});
