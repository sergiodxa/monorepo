/**
 * Client island: an on/off control (read, saved, starred) that is a real POST form. With
 * script it flips the moment it is pressed and posts in the background; a refused post
 * puts it back and says "Failed" in place. Without script it is a plain form submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { gap, inlineFlex, items } from "@sdxc/u/layout";
import { text } from "@sdxc/u/typography";
import { clientEntry, on } from "remix/component";

import { Button } from "../components/button.js";

/** Event the form dispatches, bubbling, whenever the toggle's state changes. */
export const OPTIMISTIC_TOGGLE_EVENT = "ui-optimistic-toggle";

/** Header a background post carries, so the server can answer without a redirect. */
export const OPTIMISTIC_TOGGLE_HEADER = "x-optimistic-toggle";

/** What {@link OPTIMISTIC_TOGGLE_EVENT} carries. */
export interface OptimisticToggleDetail {
	pressed: boolean;
	/** Whether the server refused the last change, which put the toggle back. */
	failed: boolean;
}

/**
 * Props {@link OptimisticToggle} serializes into the page for hydration, which is why they
 * are a `type`: `SerializableProps` rejects an interface.
 */
export type OptimisticToggleProps = {
	/** Where the form posts. */
	action: string;
	/** Field the next state submits under; its value is `"true"` to turn on, `"false"` to turn off. */
	name: string;
	/** Whether the toggle is on now, as the server knows it. */
	pressed: boolean;
	/** Hidden fields submitted with it: a CSRF token, the page to return to. */
	fields?: Record<string, string>;
	labels: {
		/** The control's name in both states, such as "Star"; `aria-pressed` carries the state. */
		label: string;
		/** Shown beside the control when the server refused the change. */
		failed: string;
	};
	/** What the button shows while on, such as a filled star; defaults to `labels.label`. */
	pressedContent?: RemixNode;
	/** What the button shows while off, such as an outlined star; defaults to `labels.label`. */
	unpressedContent?: RemixNode;
};

/**
 * Picks the button's tone: danger after a refusal, brand while on, neutral while off.
 *
 * @param pressed Whether the toggle is on.
 * @param failed Whether the last change was refused.
 * @returns The semantic color role for the button.
 */
function toneOf(pressed: boolean, failed: boolean): Button.Color {
	if (failed) return "danger";
	return pressed ? "brand" : "neutral";
}

/**
 * Renders the form and its toggle button. The latest press wins: an answer to an earlier
 * press that arrives after a newer one changes nothing.
 *
 * @example
 * <OptimisticToggle action={`/posts/${post.id}/star`} name="starred" pressed={post.starred}
 * 	fields={{ returnTo: url.pathname }} labels={{ label: "Star", failed: "Failed" }}
 * 	pressedContent={<StarIcon fill="currentColor" />} unpressedContent={<StarIcon />} />
 */
export const OptimisticToggle: EntryComponent<OptimisticToggleProps> = clientEntry(
	"@sdxc/ui/app/optimistic-toggle#OptimisticToggle",
	function OptimisticToggle(handle) {
		let pressed = handle.props.pressed;
		let failed = false;
		let latest = 0;
		let form: HTMLFormElement | null = null;

		/** Shows `next` and tells the page, so a row can restyle with it. */
		function show(next: boolean, hasFailed: boolean) {
			pressed = next;
			failed = hasFailed;
			form?.dispatchEvent(
				new CustomEvent<OptimisticToggleDetail>(OPTIMISTIC_TOGGLE_EVENT, {
					bubbles: true,
					detail: { pressed: next, failed: hasFailed },
				}),
			);
			void handle.update();
		}

		/** Flips at once, posts the form as it stood, and puts the toggle back if the post fails. */
		async function toggle(event: SubmitEvent) {
			event.preventDefault();
			form = event.currentTarget as HTMLFormElement;
			let body = new FormData(form);
			let previous = pressed;
			let token = ++latest;

			show(!previous, false);

			let ok = await fetch(handle.props.action, {
				method: "POST",
				credentials: "same-origin",
				headers: { [OPTIMISTIC_TOGGLE_HEADER]: "1" },
				body,
			}).then(
				(response) => response.ok,
				() => false,
			);

			if (!ok && token === latest) show(previous, true);
		}

		return () => {
			let { action, name, fields, labels, pressedContent, unpressedContent } = handle.props;
			let content = pressed ? pressedContent : unpressedContent;

			return (
				<form
					method="post"
					action={action}
					data-slot="optimistic-toggle"
					data-pressed={pressed ? "" : undefined}
					data-failed={failed ? "" : undefined}
					mix={[
						inlineFlex(),
						items("center"),
						gap(1.5),
						on<HTMLFormElement, "submit">("submit", toggle),
					]}
				>
					{Object.entries(fields ?? {}).map(([field, value]) => (
						<input type="hidden" name={field} value={value} />
					))}
					<input type="hidden" name={name} value={pressed ? "false" : "true"} />
					<Button
						type="submit"
						size="sm"
						variant="ghost"
						color={toneOf(pressed, failed)}
						aria-pressed={pressed ? "true" : "false"}
						aria-label={content ? labels.label : undefined}
						title={labels.label}
					>
						{content ?? labels.label}
					</Button>
					<span role="status" mix={[text("xs"), fg("danger")]}>
						{failed ? labels.failed : ""}
					</span>
				</form>
			);
		};
	},
);
