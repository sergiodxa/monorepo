/**
 * Client island: an on/off control (read, saved, starred) that is a real POST form. With
 * script it flips the moment it is pressed and posts in the background; a refused post
 * puts it back and says why in place, in copy picked by the response status. Without
 * script it is a plain form submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { gap, hidden, inlineFlex, items } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";

import { optimisticToggleSync, toneOf } from "./mixins/optimistic-toggle-sync.js";

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
		/** The control's name, such as "Star"; `aria-pressed` carries the state. */
		label: string;
		/** Its name while on, such as "Mark as unread", when that reads better than `label`. */
		pressed?: string;
		/** Shown beside the control when the server refused the change. */
		failed: string;
		/** Shown instead of `failed` for a refusal with one of these HTTP statuses, such as 507. */
		refused?: Record<number, string>;
	};
	/** What the button shows while on, such as a filled star; the label text when omitted. */
	pressedContent?: RemixNode;
	/** What the button shows while off, such as an outlined star; the label text when omitted. */
	unpressedContent?: RemixNode;
};

/**
 * Renders the form and its toggle button, with both states' content in the markup so a
 * flip is a change of `data-pressed` on the form.
 *
 * @example
 * <OptimisticToggle action={`/posts/${post.id}/star`} name="starred" pressed={post.starred}
 * 	fields={{ returnTo: url.pathname }} labels={{ label: "Star", failed: "Failed" }}
 * 	pressedContent={<StarIcon fill="currentColor" />} unpressedContent={<StarIcon />} />
 */
export const OptimisticToggle: EntryComponent<OptimisticToggleProps> = clientEntry(
	"@sdxc/ui/app/optimistic-toggle#OptimisticToggle",
	function OptimisticToggle(handle) {
		return () => {
			let { action, name, pressed, fields, labels, pressedContent, unpressedContent } =
				handle.props;
			let hasContent = pressedContent !== undefined || unpressedContent !== undefined;
			let pressedLabel = labels.pressed ?? labels.label;
			let currentLabel = pressed ? pressedLabel : labels.label;

			return (
				<form
					method="post"
					action={action}
					data-slot="optimistic-toggle"
					data-pressed={pressed ? "" : undefined}
					mix={[
						optimisticToggleSync({
							failed: labels.failed,
							refused: labels.refused,
							label: labels.label,
							pressedLabel,
							pressed,
						}),
						inlineFlex(),
						items("center"),
						gap(1.5),
						when('&[data-pressed] [data-toggle-content="off"]', hidden()),
						when('&:not([data-pressed]) [data-toggle-content="on"]', hidden()),
					]}
				>
					{Object.entries(fields ?? {}).map(([field, value]) => (
						<input type="hidden" name={field} value={value} />
					))}
					<input type="hidden" name={name} value={pressed ? "false" : "true"} data-toggle-next="" />
					<Button
						type="submit"
						size="sm"
						variant="ghost"
						color={toneOf(pressed, false)}
						aria-pressed={pressed ? "true" : "false"}
						aria-label={hasContent ? currentLabel : undefined}
						title={currentLabel}
					>
						<span data-toggle-content="on">{pressedContent ?? pressedLabel}</span>
						<span data-toggle-content="off">{unpressedContent ?? labels.label}</span>
					</Button>
					<span role="status" mix={[text("xs"), fg("danger")]} />
				</form>
			);
		};
	},
);
