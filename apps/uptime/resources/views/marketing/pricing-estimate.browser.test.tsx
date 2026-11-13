/**
 * The home page's pricing estimate in a real browser: the server inlines the bill a shared URL
 * describes, the form submits every monitor by GET without script, and with script a changed
 * interval re-prices the bill in place, in one document load, with the address following it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime } from "remix/component";

import { createTranslator } from "@sdxc/i18n";
import { run } from "remix/component";
import { renderToStream } from "remix/component/server";
import { afterEach, describe, expect, test } from "vitest";

import { estimateFromQuery } from "~/app/services/pricing-estimate";
import en from "~/resources/locales/en";
import PricingEstimateView, {
	PRICING_BILL_FRAME,
	PricingBill,
} from "~/resources/views/marketing/pricing-estimate";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** English copy, built here because the app's translator also wires the server logger. */
const translate = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
});

/** The pricing figures the copy quotes, as the home page formats them. */
const VALUES = {
	price: "$5",
	included: "100,000",
	blockPrice: "$1",
	blockSize: "10,000",
	flowRunPrice: "$2.50",
};

let runtime: AppRuntime | undefined;
let requests: string[] = [];
let startPath = "";

afterEach(() => {
	runtime?.dispose();
	runtime = undefined;
	requests = [];
	document.body.replaceChildren();
	history.replaceState(null, "", startPath);
});

/** The bill the home page's route answers the bill frame with, for `address`'s query. */
function bill(address: string) {
	let { t } = translate("en");
	let query = new URL(address, location.origin).searchParams;
	return <PricingBill estimate={estimateFromQuery(query)} t={t} locale="en" />;
}

/** Reads a rendered stream whole. */
async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
	return await new Response(stream).text();
}

/**
 * Server-renders the estimate for `search` with its bill frame inlined, puts it in the document,
 * and, with `script`, hydrates the live island the browser entry maps.
 */
async function serve(search: string, script: boolean) {
	startPath ||= `${location.pathname}${location.search}`;
	history.replaceState(null, "", `/${search}`);
	let { t } = translate("en");
	let html = await text(
		renderToStream(
			<PricingEstimateView
				estimate={estimateFromQuery(new URLSearchParams(search))}
				t={t}
				values={VALUES}
				action="#pricing"
			/>,
			{ frameSrc: location.href, resolveFrame: (src) => renderToStream(bill(src)) },
		),
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
			return Reflect.get(await import("@sdxc/ui/landing/usage-estimate"), exportName);
		},
		resolveFrame: async (src, options) => {
			let url = new URL(src, location.origin);
			requests.push(`${url.pathname}${url.search} ${options?.target ?? "top"}`);
			return new Response(await text(renderToStream(bill(url.href))), {
				headers: { "Content-Type": "text/html" },
			});
		},
	});
	await runtime.ready();
}

/** The printed total. */
function total(): string {
	return document.querySelector("tfoot td:last-child")?.textContent ?? "";
}

/** Waits until `check` holds, polling on timers so a background tab still advances. */
async function until(check: () => boolean): Promise<void> {
	for (let tries = 0; tries < 100 && !check(); tries++) {
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	expect(check()).toBe(true);
}

describe("PricingEstimateView", () => {
	test("prints the bill a shared URL describes, before any script runs", async () => {
		await serve("?m=1&m=1&m=1", false);

		expect(total()).toBe("$8");
		expect(document.body.textContent).toContain("20,960 over → 3 blocks × $1");
	});

	test("submits every monitor's interval by GET to the pricing section without script", async () => {
		await serve("?m=30&m=5", false);
		let form = document.querySelector("form")!;

		expect(form.method).toBe("get");
		expect(form.getAttribute("action")).toBe("#pricing");
		expect(new FormData(form).getAll("m")).toEqual(["30", "5"]);
	});

	test("re-prices the bill as an interval changes, in one document load", async () => {
		await serve("?m=10", true);
		let input = document.querySelector<HTMLInputElement>('input[name="m"]')!;

		input.value = "1";
		input.dispatchEvent(new Event("input", { bubbles: true }));

		await until(() => total() === "$5" && document.body.textContent!.includes("40,320 pings"));
		expect(requests).toEqual([`/?m=1 ${PRICING_BILL_FRAME}`]);
		expect(location.search).toBe("?m=1");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	/**
	 * Add and Remove change which intervals the form holds, so with script they load the page,
	 * which renders the new list of fields; only the plain Update re-prices in place.
	 */
	test("loads the page for Add and Remove, so the new list of monitors is drawn", async () => {
		await serve("?m=30&m=5", true);
		let form = document.querySelector("form")!;
		let passed: string[] = [];
		document.addEventListener("submit", (event) => {
			if (!event.defaultPrevented) passed.push((event.submitter as HTMLButtonElement).name);
			event.preventDefault();
		});

		form.requestSubmit(form.querySelector<HTMLButtonElement>('button[name="add"]'));
		form.requestSubmit(form.querySelector<HTMLButtonElement>('button[name="remove"]'));
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(passed).toEqual(["add", "remove"]);
		expect(requests).toEqual([]);
	});
});
