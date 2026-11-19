/**
 * A placed order's progress, as a clock reads it: every step from "Order placed" to
 * "Delivered" falls at a fixed time after the order, compressed so a visitor watches the
 * whole delivery in three minutes. The tracking screen and its live stream read the same clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import type { Order } from "./data";

import { readVisitor } from "./state";

/** One step of a delivery. */
export interface Step {
	id: StepId;
	label: string;
	/** What the visitor is told while this is the current step. */
	headline: string;
	/** Seconds after the order is placed at which this step starts. */
	at: number;
}

/** A step's id, which the timeline's rows and the stream's lines name. */
export type StepId = "placed" | "accepted" | "preparing" | "picked-up" | "on-the-way" | "delivered";

/** Every step in order; the courier moves between `on-the-way` and `delivered`. */
export const STEPS: readonly Step[] = [
	{ id: "placed", label: "Order placed", headline: "Sending your order", at: 0 },
	{ id: "accepted", label: "Restaurant accepted", headline: "The kitchen has your order", at: 8 },
	{ id: "preparing", label: "Being prepared", headline: "Your food is being made", at: 22 },
	{ id: "picked-up", label: "Courier picked it up", headline: "Your order is with Lucía", at: 70 },
	{ id: "on-the-way", label: "On the way", headline: "Lucía is on the way", at: 80 },
	{ id: "delivered", label: "Delivered", headline: "Delivered. Enjoy!", at: 180 },
];

/** The courier delivering every order: invented, like everything else in Bocado. */
export const COURIER = { name: "Lucía", vehicle: "E-bike", rating: 4.9 } as const;

/** How long a step takes in the minutes the visitor is told, so a 3-minute demo reads real. */
const REAL_MINUTES_PER_SECOND = 25 / 180;

/** Where an order is at one moment. */
export interface Progress {
	/** The current step, the last one reached. */
	step: Step;
	/** How far the courier is along the route, from 0 at the restaurant to 1 at the door. */
	courier: number;
	/** Minutes until the door, as the visitor is told; `0` once delivered. */
	eta: number;
	/** Whether the order has arrived. */
	done: boolean;
}

/**
 * Where an order is `elapsed` seconds after it was placed.
 *
 * @param elapsed Seconds since the order, clamped to the delivery's span.
 */
export function progressAt(elapsed: number): Progress {
	let seconds = Math.max(0, elapsed);
	let step = [...STEPS].reverse().find((entry) => entry.at <= seconds) ?? STEPS[0]!;
	let start = STEPS[4]!.at;
	let end = STEPS[5]!.at;
	let courier = Math.min(Math.max((seconds - start) / (end - start), 0), 1);
	let remaining = Math.max(end - seconds, 0);
	return {
		step,
		courier,
		eta: Math.ceil(remaining * REAL_MINUTES_PER_SECOND),
		done: step.id === "delivered",
	};
}

/**
 * Where an order is now.
 *
 * @param order The order.
 * @param now The current time, in milliseconds since the epoch.
 */
export function orderProgress(order: Order, now: number): Progress {
	return progressAt((now - order.placedAt) / 1000);
}

/**
 * Where a step stands against the step reached: behind it, at it, or still ahead.
 *
 * @param index The step's place in {@link STEPS}.
 * @param reached The place of the step reached.
 */
export function stepState(index: number, reached: number): "done" | "current" | "todo" {
	if (index < reached) return "done";
	return index === reached ? "current" : "todo";
}

/** How often the stream reports the courier, in milliseconds. */
const TICK_MS = 1000;

/** Resolves after `ms` milliseconds, or at once when the reader went away. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		let timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

/**
 * One line of the tracking stream: `<step> <courier> <eta>`, such as `on-the-way 0.420 9`.
 *
 * @param progress Where the order is.
 */
export function progressLine(progress: Progress): string {
	return `${progress.step.id} ${progress.courier.toFixed(3)} ${progress.eta}\n`;
}

/**
 * Reads one line of the tracking stream back, or `undefined` for one it cannot.
 *
 * @param line A line without its newline.
 */
export function parseProgressLine(
	line: string,
): { step: StepId; courier: number; eta: number } | undefined {
	let [step = "", courier = "", eta = ""] = line.trim().split(" ");
	if (!STEPS.some((entry) => entry.id === step)) return undefined;
	let position = Number(courier);
	let minutes = Number(eta);
	if (!Number.isFinite(position) || !Number.isFinite(minutes)) return undefined;
	return { step: step as StepId, courier: position, eta: minutes };
}

/**
 * Answers an order's live progress, `orders/<id>`, as one line a second until it is
 * delivered: the step, the courier's place on the route and the minutes left. An order the
 * visitor's cookies do not hold answers `null`, and a delivered one a single line.
 *
 * @param part The stream's path.
 * @param request The stream request, whose cookies hold the order.
 */
export function trackingStream(
	part: string,
	request: DemoAppRequest,
): ReadableStream<string> | null {
	let [first, id, extra] = part.split("/");
	if (first !== "orders" || id === undefined || extra !== undefined) return null;
	let order = readVisitor(request.cookie).orders.find((entry) => entry.id === id);
	if (order === undefined) return null;
	let placed = order;
	let controller = new AbortController();
	return new ReadableStream<string>({
		async start(stream) {
			let last = "";
			while (!controller.signal.aborted) {
				let progress = orderProgress(placed, Date.now());
				let line = progressLine(progress);
				if (line !== last) stream.enqueue(line);
				last = line;
				if (progress.done) break;
				await wait(TICK_MS, controller.signal);
			}
			stream.close();
		},
		cancel() {
			controller.abort();
		},
	});
}
