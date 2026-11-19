/**
 * An order on its way: the steps from placed to delivered as a timeline whose rows are done,
 * current or still to come, and an island that follows a text stream of progress so the
 * steps, the headline, the arrival estimate and any map marker on the page move live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { clientEntry } from "remix/component";

/** Prop types for {@link OrderSteps} and {@link OrderLive}. */
export namespace OrderSteps {
	/** One step of an order. */
	export interface Step {
		/** The id the stream names the step by. */
		id: string;
		label: string;
	}

	/** Props accepted by {@link OrderSteps}; the host is an `<ol>`. */
	export interface Props extends Omit<TagProps<"ol">, "children"> {
		steps: Step[];
		/** The id of the step reached; every earlier one is done. */
		current: string;
	}

	/** Props {@link OrderLive} serializes for hydration. */
	export type LiveProps = {
		/**
		 * A URL answering the order's progress as `text/plain`, one line per update:
		 * `<step id> <progress 0–1> <minutes left>`, such as `on-the-way 0.420 9`.
		 */
		src: string;
		/** The id of the element holding the steps, the headline, the estimate and the map. */
		root: string;
		/** The step ids in order; the last one means arrived. */
		steps: string[];
		/** The headline for each step, by step id, written into `[data-order-headline]`. */
		headlines: Record<string, string>;
		/** The words around the estimate. */
		labels: {
			/** Over the estimate while on the way, such as "Arriving in". */
			arriving: string;
			/** Over it once arrived, such as "Delivered". */
			arrived: string;
			/** The estimate once arrived, such as "Arrived". */
			done: string;
			/** The estimate on the way, with `{n}` for the minutes, such as "{n} min". */
			minutes: string;
		};
	};
}

/** Where a step stands against the step reached. */
export function orderStepState(index: number, reached: number): "done" | "current" | "todo" {
	if (index < reached) return "done";
	return index === reached ? "current" : "todo";
}

/**
 * Renders the steps as a vertical timeline: a filled dot and rail for each done step, a ring
 * that pulses on the current one, and hollow dots for the rest.
 *
 * @example
 * <OrderSteps current="preparing" steps={[{ id: "placed", label: "Order placed" }, { id: "preparing", label: "Being prepared" }, { id: "delivered", label: "Delivered" }]} />
 */
export function OrderSteps(handle: Handle<OrderSteps.Props>) {
	return () => {
		let { current, mix, steps, ...rest } = handle.props;
		let reached = Math.max(
			steps.findIndex((step) => step.id === current),
			0,
		);
		return (
			<ol
				{...rest}
				data-slot="order-steps"
				mix={mergeMix([raw({ margin: "0", padding: "0", listStyle: "none" })], mix)}
			>
				{steps.map((step, index) => {
					let state = orderStepState(index, reached);
					return (
						<li
							data-order-step={step.id}
							data-state={state}
							aria-current={state === "current" ? "step" : undefined}
							mix={[
								raw({
									position: "relative",
									display: "grid",
									gridTemplateColumns: "1.5rem minmax(0, 1fr)",
									gap: "0.875rem",
									paddingBlockEnd: "1.125rem",
									color: "var(--ui-neutral-fg-muted)",
									"&:last-child": { paddingBlockEnd: "0" },
									"&::before": {
										content: '""',
										position: "absolute",
										insetInlineStart: "calc(0.75rem - 1px)",
										insetBlockStart: "1.5rem",
										insetBlockEnd: "0",
										inlineSize: "2px",
										backgroundColor: "var(--ui-neutral-border)",
									},
									"&:last-child::before": { display: "none" },
									"& [data-dot]": {
										display: "grid",
										placeItems: "center",
										inlineSize: "1.5rem",
										blockSize: "1.5rem",
										borderRadius: "999px",
										boxShadow: "inset 0 0 0 2px var(--ui-neutral-border)",
										backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
										color: "transparent",
										transition: "background-color 300ms ease, box-shadow 300ms ease",
									},
									"&[data-state='done']": { color: "var(--ui-neutral-fg)" },
									"&[data-state='done']::before": { backgroundColor: "var(--ui-color-brand-600)" },
									"&[data-state='done'] [data-dot]": {
										color: "white",
										backgroundColor: "var(--ui-color-brand-600)",
										boxShadow: "none",
									},
									"&[data-state='current']": {
										color: "var(--ui-neutral-fg-emphasis)",
										fontWeight: "700",
									},
									"&[data-state='current'] [data-dot]": {
										boxShadow: "inset 0 0 0 6px var(--ui-color-brand-600)",
										animation: "ui-order-pulse 1.6s ease-out infinite",
									},
									"@keyframes ui-order-pulse": {
										"0%": {
											outline:
												"0 solid color-mix(in oklch, var(--ui-color-brand-500) 50%, transparent)",
										},
										"100%": { outline: "10px solid transparent" },
									},
								}),
								motionReduce(
									raw({ "& [data-dot]": { transition: "none", animation: "none !important" } }),
								),
							]}
						>
							<span data-dot="">
								<CheckIcon aria-hidden="true" size={13} />
							</span>
							<span mix={[raw({ alignSelf: "center" })]}>{step.label}</span>
						</li>
					);
				})}
			</ol>
		);
	};
}

/** One progress line read back. */
interface Reading {
	step: string;
	progress: number;
	minutes: number;
}

/**
 * Reads one stream line, or `undefined` for one it cannot.
 *
 * @example parseOrderLine("on-the-way 0.420 9", ["on-the-way"]) // { step: "on-the-way", progress: 0.42, minutes: 9 }
 */
export function parseOrderLine(line: string, steps: string[]): Reading | undefined {
	let [step = "", progress = "", minutes = ""] = line.trim().split(" ");
	let position = Number(progress);
	let left = Number(minutes);
	if (!steps.includes(step) || !Number.isFinite(position) || !Number.isFinite(left))
		return undefined;
	return { step, progress: Math.min(Math.max(position, 0), 1), minutes: left };
}

/** Draws one reading into the page. */
function apply(root: HTMLElement, reading: Reading, props: OrderSteps.LiveProps) {
	let reached = props.steps.indexOf(reading.step);
	for (let row of root.querySelectorAll<HTMLElement>("[data-order-step]")) {
		let state = orderStepState(props.steps.indexOf(row.dataset.orderStep ?? ""), reached);
		row.dataset.state = state;
		if (state === "current") row.setAttribute("aria-current", "step");
		else row.removeAttribute("aria-current");
	}
	let arrived = reading.step === props.steps.at(-1);
	let headline = props.headlines[reading.step];
	for (let node of root.querySelectorAll<HTMLElement>("[data-order-headline]")) {
		if (headline !== undefined && node.textContent !== headline) node.textContent = headline;
	}
	for (let node of root.querySelectorAll<HTMLElement>("[data-order-eta]")) {
		node.textContent = arrived
			? props.labels.done
			: props.labels.minutes.replace("{n}", String(reading.minutes));
	}
	for (let node of root.querySelectorAll<HTMLElement>("[data-order-eta-label]")) {
		node.textContent = arrived ? props.labels.arrived : props.labels.arriving;
	}
	root.dataset.orderState = reading.step;
	for (let marker of root.querySelectorAll<SVGElement>("[data-map-marker]")) {
		marker.style.setProperty("--ui-map-progress", String(reading.progress));
	}
	for (let done of root.querySelectorAll<SVGElement>('[data-route-part="done"]')) {
		done.setAttribute("stroke-dasharray", `${reading.progress} 2`);
	}
}

/**
 * Follows an order's progress stream and draws each line as it lands. A dropped connection
 * is retried after a pause while the order is still on its way, so a phone waking from sleep
 * picks the order back up; it stops once the last step arrives.
 */
export const OrderLive: EntryComponent<OrderSteps.LiveProps> = clientEntry(
	"@sdxc/ui/commerce/order-tracker#OrderLive",
	function OrderLive(handle: Handle<OrderSteps.LiveProps>) {
		/** Reads the stream to its end; resolves whether the order arrived. */
		async function follow(root: HTMLElement): Promise<boolean> {
			let response = await fetch(handle.props.src, { signal: handle.signal, cache: "no-store" });
			if (!response.ok || response.body === null) return true;
			let reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
			let buffer = "";
			let arrived = false;
			while (true) {
				let { done, value } = await reader.read();
				if (done) break;
				buffer += value;
				let lines = buffer.split("\n");
				buffer = lines.pop() ?? "";
				for (let line of lines) {
					let reading = parseOrderLine(line, handle.props.steps);
					if (reading === undefined) continue;
					apply(root, reading, handle.props);
					arrived = reading.step === handle.props.steps.at(-1);
				}
			}
			return arrived;
		}

		handle.queueTask(async () => {
			let root = document.getElementById(handle.props.root);
			if (root === null) return;
			let target = root;
			for (let attempt = 0; attempt < 5 && !handle.signal.aborted; attempt++) {
				let arrived = await follow(target).catch(() => false);
				if (arrived || handle.signal.aborted) return;
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		});

		return () => <span hidden data-slot="order-live" />;
	},
);
