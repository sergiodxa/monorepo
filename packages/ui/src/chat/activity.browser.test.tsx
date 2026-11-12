/**
 * Holds the activity disclosure to its contract in a real browser: the summary says what was
 * done until the reply around it is busy, a step with output opens onto it, and during a
 * replay the step being worked on shows moving dots and holds for its duration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, onTestFinished, test, vi } from "vitest";

import { Activity } from "./activity.js";
import { STREAM_HIDDEN_ATTRIBUTE, revealStream } from "./mixins/reveal-stream.js";
import { streamTarget } from "./mixins/stream-target.js";

import "../reset.css";
import "../theme.css";

/** Mounts an activity with three steps, the second holding the replay `pause` milliseconds. */
function mount(options: { busy?: boolean; pause?: number } = {}) {
	let mounted = render(
		<div id="reply" aria-busy={options.busy ? "true" : undefined} mix={[streamTarget()]}>
			<Activity open>
				<Activity.Summary busy="Thinking">Thought for 8s</Activity.Summary>
				<Activity.Steps>
					<Activity.Step icon={<svg data-icon />}>Read the draft</Activity.Step>
					<Activity.Step
						icon={<svg data-icon />}
						duration={options.pause}
						detail={<pre>1 failed</pre>}
					>
						Ran the tests
					</Activity.Step>
					<Activity.Step>Wrote the fix</Activity.Step>
				</Activity.Steps>
			</Activity>
			<p>The answer.</p>
		</div>,
	);
	onTestFinished(mounted.cleanup);
	return mounted.container.querySelector<HTMLElement>("#reply")!;
}

/** Whether an element is laid out. */
function shown(element: Element | null): boolean {
	return element !== null && getComputedStyle(element).display !== "none";
}

describe("Activity", () => {
	test("says what was done, or the busy label while the reply is busy", () => {
		let settled = mount();
		expect(shown(settled.querySelector("[data-activity-label=done]"))).toBe(true);
		expect(shown(settled.querySelector("[data-activity-label=busy]"))).toBe(false);

		let busy = mount({ busy: true });
		expect(shown(busy.querySelector("[data-activity-label=done]"))).toBe(false);
		expect(shown(busy.querySelector("[data-activity-label=busy]"))).toBe(true);
	});

	test("a step with output is a disclosure that opens onto it", () => {
		let reply = mount();
		let detail = reply.querySelector<HTMLDetailsElement>("[data-slot=activity-step] details")!;

		expect(detail.open).toBe(false);
		detail.querySelector("summary")!.click();
		expect(detail.open).toBe(true);
		expect(shown(detail.querySelector("pre"))).toBe(true);
	});

	test("a running step shows moving dots in place of its icon", () => {
		let mounted = render(
			<Activity open>
				<Activity.Summary>Working</Activity.Summary>
				<Activity.Steps>
					<Activity.Step running icon={<svg data-icon />}>
						Running a command
					</Activity.Step>
				</Activity.Steps>
			</Activity>,
		);
		onTestFinished(mounted.cleanup);

		expect(shown(mounted.container.querySelector("[data-slot=activity-dots]"))).toBe(true);
		expect(shown(mounted.container.querySelector("[data-slot=activity-icon]"))).toBe(false);
	});

	test("a replay dwells on a step for its duration, with the dots on it", async () => {
		let reply = mount({ pause: 400 });
		let [, second, third] = reply.querySelectorAll<HTMLElement>("[data-slot=activity-step]");
		revealStream(reply, { interval: 5 });

		await vi.waitFor(() => expect(second!.hasAttribute(STREAM_HIDDEN_ATTRIBUTE)).toBe(false));
		await vi.waitFor(() => expect(second!.textContent).toContain("Ran the tests"));
		expect(shown(second!.querySelector("[data-slot=activity-dots]"))).toBe(true);
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(third!.hasAttribute(STREAM_HIDDEN_ATTRIBUTE)).toBe(true);

		await vi.waitFor(() => expect(third!.hasAttribute(STREAM_HIDDEN_ATTRIBUTE)).toBe(false), {
			timeout: 2000,
		});
	});

	test("the summary never types itself out during a replay", () => {
		let reply = mount();
		revealStream(reply, { interval: 1000 });
		expect(reply.querySelector("[data-activity-label=done]")?.textContent).toBe("Thought for 8s");
	});
});
