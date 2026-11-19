/**
 * The tracking screen's live half: it reads the order's progress stream line by line and
 * moves the timeline, the headline, the arrival estimate and the courier on the map as each
 * line lands. Without script the screen shows where the order was when it rendered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

namespace TrackLive {
	export interface Props {
		/** The stream's address. */
		src: string;
		/** The id of the element holding the timeline, map and headline. */
		root: string;
		/** Each step's headline, by step id. */
		headlines: Record<string, string>;
		/** The step ids in order. */
		steps: string[];
	}
}

/** One progress line read back: step, courier position and minutes left. */
interface Reading {
	step: string;
	courier: number;
	eta: number;
}

/** Reads a stream line, or `undefined` for one it cannot. */
function read(line: string, steps: string[]): Reading | undefined {
	let [step = "", courier = "", eta = ""] = line.trim().split(" ");
	let position = Number(courier);
	let minutes = Number(eta);
	if (!steps.includes(step) || !Number.isFinite(position) || !Number.isFinite(minutes))
		return undefined;
	return { step, courier: position, eta: minutes };
}

/** Draws one reading into the screen. */
function apply(root: HTMLElement, reading: Reading, props: TrackLive.Props) {
	let reached = props.steps.indexOf(reading.step);
	for (let row of root.querySelectorAll<HTMLElement>("[data-track-step]")) {
		let index = props.steps.indexOf(row.dataset.trackStep ?? "");
		row.dataset.state = index < reached ? "done" : "todo";
		if (index === reached) row.dataset.state = "current";
		if (index === reached) row.setAttribute("aria-current", "step");
		else row.removeAttribute("aria-current");
	}
	let headline = root.querySelector<HTMLElement>("[data-track-headline]");
	let text = props.headlines[reading.step];
	if (headline !== null && text !== undefined && headline.textContent !== text)
		headline.textContent = text;
	let delivered = reading.step === props.steps.at(-1);
	for (let eta of root.querySelectorAll<HTMLElement>("[data-track-eta]")) {
		eta.textContent = delivered ? "Arrived" : `${reading.eta} min`;
	}
	for (let label of root.querySelectorAll<HTMLElement>("[data-track-eta-label]")) {
		label.textContent = delivered ? "Delivered" : "Arriving in";
	}
	root.dataset.trackState = reading.step;
	let marker = root.querySelector<SVGElement>("[data-map-marker]");
	marker?.style.setProperty("--ui-map-progress", String(reading.courier));
	let done = root.querySelector<SVGElement>('[data-route-part="done"]');
	done?.setAttribute("stroke-dasharray", `${reading.courier} 2`);
}

/**
 * Follows the stream until it ends. A dropped connection is retried after a pause while the
 * order is still on its way, so a phone waking from sleep picks the courier back up.
 */
export const TrackLive = clientEntry(
	import.meta.url,
	function TrackLive(handle: Handle<TrackLive.Props>) {
		/** Reads the stream once, to its end; resolves whether the order arrived. */
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
					let reading = read(line, handle.props.steps);
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

		return () => <span hidden data-track-live="" />;
	},
);
