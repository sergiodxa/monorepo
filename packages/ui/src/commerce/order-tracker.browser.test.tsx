/**
 * Holds the order tracker to its contract in a real browser: steps before the current one
 * are done and later ones to come, a cart line lays out its parts, and the live island moves
 * the steps, headline, estimate and map marker as each streamed line lands.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { CartLine } from "./cart-line.js";
import { OrderLive, OrderSteps, parseOrderLine } from "./order-tracker.js";

import "../theme.css";

/** Answers the order's stream in each test. */
const WORKER = setupWorker();

let mounted: RenderResult | undefined;

beforeAll(async () => {
	await WORKER.start({ quiet: true, onUnhandledRequest: "bypass" });
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	WORKER.resetHandlers();
});

afterAll(() => {
	WORKER.stop();
});

/** A delivery's steps. */
const STEPS: OrderSteps.Step[] = [
	{ id: "placed", label: "Order placed" },
	{ id: "preparing", label: "Being prepared" },
	{ id: "on-the-way", label: "On the way" },
	{ id: "delivered", label: "Delivered" },
];

/** Waits until a check passes, for an island reading a stream. */
async function until(check: () => boolean, timeout = 3000): Promise<void> {
	let start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

/** Each step row's state, in order. */
function states(root: HTMLElement): string[] {
	return [...root.querySelectorAll<HTMLElement>("[data-order-step]")].map(
		(row) => row.dataset.state ?? "",
	);
}

describe("OrderSteps", () => {
	test("marks earlier steps done, the reached one current and later ones to come", () => {
		mounted = render(<OrderSteps steps={STEPS} current="preparing" />);
		expect(states(mounted.container)).toEqual(["done", "current", "todo", "todo"]);
		expect(mounted.container.querySelector('[aria-current="step"]')?.textContent).toBe(
			"Being prepared",
		);
	});

	test("sets a step's detail under its label, and keeps a step without one to its label", () => {
		mounted = render(
			<OrderSteps
				current="on-the-way"
				steps={[
					{ id: "placed", label: "Order placed", detail: "Mon 16 Nov" },
					{ id: "on-the-way", label: "On the way", detail: "Scanned in Leeds" },
					{ id: "delivered", label: "Delivered" },
				]}
			/>,
		);
		let rows = [...mounted.container.querySelectorAll<HTMLElement>("[data-order-step]")];
		expect(rows.map((row) => row.textContent)).toEqual([
			"Order placedMon 16 Nov",
			"On the wayScanned in Leeds",
			"Delivered",
		]);
		let detail = rows[1]!.querySelector<HTMLElement>('[data-slot="order-step-detail"]')!;
		let label = detail.previousElementSibling!;
		expect(detail.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			label.getBoundingClientRect().bottom,
		);
		expect(getComputedStyle(detail).fontWeight).toBe("400");
		expect(rows[2]!.querySelector('[data-slot="order-step-detail"]')).toBeNull();
	});

	test("reads a stream line, and refuses one for a step it lacks", () => {
		let ids = STEPS.map((step) => step.id);
		expect(parseOrderLine("on-the-way 0.420 9", ids)).toEqual({
			step: "on-the-way",
			progress: 0.42,
			minutes: 9,
		});
		expect(parseOrderLine("lost 1 2", ids)).toBeUndefined();
	});
});

describe("OrderLive", () => {
	test("moves the steps, headline, estimate and marker as lines land", async () => {
		let send: (text: string) => void = () => {};
		let finish: () => void = () => {};
		let opened = false;
		WORKER.use(
			http.get("/orders/7/progress", () => {
				let body = new ReadableStream<Uint8Array>({
					start(controller) {
						let encoder = new TextEncoder();
						opened = true;
						send = (text) => controller.enqueue(encoder.encode(text));
						finish = () => controller.close();
					},
				});
				return new HttpResponse(body, { headers: { "content-type": "text/plain" } });
			}),
		);
		mounted = render(
			<div id="order-7">
				<h1 data-order-headline="">Sending your order</h1>
				<span data-order-eta-label="">Arriving in</span>
				<span data-order-eta="">25 min</span>
				<svg>
					<g data-map-marker="" />
				</svg>
				<OrderSteps steps={STEPS} current="placed" />
				<OrderLive
					src="/orders/7/progress"
					root="order-7"
					steps={STEPS.map((step) => step.id)}
					headlines={{
						placed: "Sending",
						preparing: "Cooking",
						"on-the-way": "On its way",
						delivered: "Enjoy!",
					}}
					labels={{
						arriving: "Arriving in",
						arrived: "Delivered",
						done: "Arrived",
						minutes: "{n} min",
					}}
				/>
			</div>,
		);
		let root = mounted.container;
		await until(() => opened);
		send("on-the-way 0.500 7\n");
		await until(() => root.querySelector("[data-order-eta]")!.textContent === "7 min");
		expect(states(root)).toEqual(["done", "done", "current", "todo"]);
		expect(root.querySelector("[data-order-headline]")!.textContent).toBe("On its way");
		let marker = root.querySelector<SVGElement>("[data-map-marker]")!;
		expect(marker.style.getPropertyValue("--ui-map-progress")).toBe("0.5");
		send("delivered 1.000 0\n");
		finish();
		await until(() => root.querySelector("[data-order-eta]")!.textContent === "Arrived");
		expect(root.querySelector("[data-order-eta-label]")!.textContent).toBe("Delivered");
		expect(states(root)).toEqual(["done", "done", "done", "current"]);
	});
});

describe("CartLine", () => {
	test("lays out its picture, name, picks, price and action in one row", () => {
		mounted = render(
			<ul>
				<CartLine
					name="Al pastor trio"
					details="Blue corn · Verde"
					price="$11.50"
					media={<svg />}
					action={<button type="button">Remove</button>}
				/>
			</ul>,
		);
		let line = mounted.container.querySelector<HTMLElement>('[data-slot="cart-line"]')!;
		expect(line.textContent).toBe("Al pastor trioBlue corn · Verde$11.50Remove");
		expect(getComputedStyle(line).display).toBe("grid");
		expect(getComputedStyle(line).gridTemplateColumns.split(" ")).toHaveLength(3);
	});
});
