/**
 * Lays a {@link FaqBand} out in a real browser: every closed question of the same length is
 * the same height, the first included, so the rows step evenly down the column whether a
 * neighbour is open or closed, and the list still opens under a top rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Accordion } from "../components/accordion.js";
import { HeadingScope } from "../components/heading-scope.js";

import { FaqBand } from "./faq-band.js";

import "../reset.css";
import "../theme.css";

/** Questions short enough to sit on one line at the test width. */
const QUESTIONS = ["Can I cancel?", "Is there a trial?", "Do you invoice?", "Where is data kept?"];

let cleanups: Array<() => void> = [];

afterEach(() => {
	for (let cleanup of cleanups) cleanup();
	cleanups = [];
	document.body.replaceChildren();
});

/** Mounts a one-column band whose `openIndex` question starts open. */
function mount(openIndex?: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "720px";
	document.body.appendChild(host);
	let { cleanup } = render(
		<HeadingScope level={2}>
			<FaqBand title="Questions">
				<Accordion>
					{QUESTIONS.map((question, index) => (
						<Accordion.Item key={question} name="faq" open={index === openIndex}>
							<Accordion.Trigger>{question}</Accordion.Trigger>
							<Accordion.Content>
								<p>An answer long enough to open the row.</p>
							</Accordion.Content>
						</Accordion.Item>
					))}
				</Accordion>
			</FaqBand>
		</HeadingScope>,
		{ container: host },
	);
	cleanups.push(cleanup);
	return host;
}

/** The rendered height of every closed row, in document order. */
function closedHeights(host: HTMLElement): number[] {
	return [...host.querySelectorAll("details")]
		.filter((item) => !item.open)
		.map((item) => item.getBoundingClientRect().height);
}

describe("FaqBand", () => {
	test("gives every closed row the same height, the first included", () => {
		let heights = closedHeights(mount());

		expect(heights).toHaveLength(QUESTIONS.length);
		expect(new Set(heights).size).toBe(1);
	});

	test("keeps the closed rows level when the first one is open", () => {
		let heights = closedHeights(mount(0));

		expect(heights).toHaveLength(QUESTIONS.length - 1);
		expect(new Set(heights).size).toBe(1);
		expect(heights[0]).toBe(closedHeights(mount())[0]);
	});

	test("rules the top of the list once", () => {
		let host = mount();
		let list = host.querySelector("details")!.parentElement!;
		let first = host.querySelector("details")!;

		expect(getComputedStyle(list).borderBlockStartWidth).toBe("1px");
		expect(getComputedStyle(first).borderBlockStartWidth).toBe("0px");
	});

	test("keeps carded questions evenly spaced where two columns stack", () => {
		let host = mountTwoColumns(400, "12px");
		let [lastOfFirst, firstOfSecond] = seam(host);

		expect(Math.round(firstOfSecond.top - lastOfFirst.bottom)).toBe(12);
	});

	test("leaves hairline columns touching where they stack", () => {
		let host = mountTwoColumns(400);
		let [lastOfFirst, firstOfSecond] = seam(host);

		expect(Math.round(firstOfSecond.top - lastOfFirst.bottom)).toBe(0);
	});

	test("puts the columns side by side when the band is wide", () => {
		let host = mountTwoColumns(1400, "12px");
		let [lastOfFirst, firstOfSecond] = seam(host);

		expect(firstOfSecond.left).toBeGreaterThan(lastOfFirst.right);
	});
});

/** Mounts a two-column band at `width`, with `gap` as its `--ui-landing-faq-gap` when given. */
function mountTwoColumns(width: number, gap?: string): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	if (gap) host.style.setProperty("--ui-landing-faq-gap", gap);
	document.body.appendChild(host);
	let column = (offset: number) => (
		<Accordion>
			{QUESTIONS.slice(offset, offset + 2).map((question) => (
				<Accordion.Item key={question} name={`faq-${offset}`}>
					<Accordion.Trigger>{question}</Accordion.Trigger>
					<Accordion.Content>
						<p>An answer.</p>
					</Accordion.Content>
				</Accordion.Item>
			))}
		</Accordion>
	);
	let { cleanup } = render(
		<HeadingScope level={2}>
			<FaqBand title="Questions" columns={2}>
				{column(0)}
				{column(2)}
			</FaqBand>
		</HeadingScope>,
		{ container: host },
	);
	cleanups.push(cleanup);
	return host;
}

/** The two accordion columns' boxes, first then second, where the two meet. */
function seam(host: HTMLElement): [DOMRect, DOMRect] {
	let items = host.querySelectorAll("details");
	return [
		items[0]!.parentElement!.getBoundingClientRect(),
		items[2]!.parentElement!.getBoundingClientRect(),
	];
}
