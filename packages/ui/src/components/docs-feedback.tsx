/**
 * The quiet "Was this helpful?" closing a docs page, as a plain form that posts without
 * JavaScript: picking Yes or No reveals an optional note and the send button through CSS
 * alone, and the server answers by rendering the same component in its `sent` state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { ThumbsDownIcon, ThumbsUpIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { opacity, rounded, transition } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { flex, gap, hstack, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { motionSafe, startingStyle } from "@sdxc/u/responsive";
import { is, m, maxIs, minIs, p, pb, pi } from "@sdxc/u/size";
import { has, hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import { Button } from "./button.js";
import { TextArea } from "./textarea.js";

/** Field carrying the vote, posted as `"yes"` or `"no"`. */
export const DOCS_FEEDBACK_VOTE_FIELD = "helpful";

/** Field carrying the optional note. */
export const DOCS_FEEDBACK_NOTE_FIELD = "note";

/** Field carrying the page the vote is about. */
export const DOCS_FEEDBACK_PAGE_FIELD = "page";

/** Selector matching a picked vote; a form holding one shows its note. */
const VOTED = `input[name="${DOCS_FEEDBACK_VOTE_FIELD}"]:checked`;

/**
 * Prop types for {@link DocsFeedback}.
 */
export namespace DocsFeedback {
	/** `idle` asks the question; `sent` thanks the reader in place of the form. */
	export type State = "idle" | "sent";

	/** Every string the block shows. */
	export interface Labels {
		/** The question, such as "Was this page helpful?". */
		question: string;
		yes: string;
		no: string;
		/** Label of the optional note, such as "Anything we could add? (optional)". */
		note: string;
		send: string;
		/** Shown in the `sent` state, such as "Thanks for the feedback". */
		thanks: string;
	}

	/** Props accepted by {@link DocsFeedback}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** URL the form posts to. */
		action: string;
		/** Identifier of the page, posted in the `page` field; usually its path. */
		page: string;
		labels: Labels;
		/** @default "idle" */
		state?: State;
	}
}

/**
 * Renders the vote form, or the thank-you once `state` is `sent`. The form posts
 * `helpful=yes|no`, `page` and an optional `note` to `action`; the thank-you is a live
 * status so a reader on a screen reader hears it after an enhanced submit.
 *
 * @param handle Runtime handle carrying the block's props.
 * @returns The render function producing the block's markup.
 * @example
 * <DocsFeedback action="/docs/feedback" page="/docs/alerts" state={sent ? "sent" : "idle"} labels={labels} />
 */
export function DocsFeedback(handle: Handle<DocsFeedback.Props>) {
	return () => {
		let { action, page, labels, state, mix, ...rest } = handle.props;
		let isSent = state === "sent";

		return (
			<div
				{...rest}
				data-slot="docs-feedback"
				data-state={isSent ? "sent" : "idle"}
				mix={mergeMix([minIs(0), text("sm"), fg("neutral")], mix)}
			>
				<p
					role="status"
					data-slot="docs-feedback-thanks"
					mix={[m(0), isSent ? [] : visuallyHidden()]}
				>
					{isSent ? labels.thanks : ""}
				</p>
				{isSent ? null : (
					<form
						method="post"
						action={action}
						data-slot="docs-feedback-form"
						mix={[vstack({ gap: 3, align: "stretch" })]}
					>
						<input type="hidden" name={DOCS_FEEDBACK_PAGE_FIELD} value={page} />
						<fieldset
							mix={[
								flex(),
								items("center"),
								gap(4, 3),
								raw({ flexWrap: "wrap" }),
								m(0),
								p(0),
								border({ width: 0 }),
								minIs(0),
							]}
						>
							<legend
								mix={[raw({ float: "inline-start" }), weight("medium"), fg("neutral.emphasis")]}
							>
								{labels.question}
							</legend>
							<span mix={[hstack({ gap: 2, align: "center" })]}>
								<DocsFeedbackChoice value="yes" label={labels.yes} />
								<DocsFeedbackChoice value="no" label={labels.no} />
							</span>
						</fieldset>
						<div
							data-slot="docs-feedback-note"
							mix={[
								/**
								 * One rule holds both displays, so the revealed state always outranks the
								 * hidden one whatever order the stylesheet layers land in.
								 */
								raw({ display: "none", [`&:where(form:has(${VOTED}) *)`]: { display: "grid" } }),
								gap(2),
								maxIs("32rem"),
								motionSafe([transition("opacity", { duration: 150 }), startingStyle(opacity(0))]),
							]}
						>
							<label mix={[vstack({ gap: 1.5, align: "stretch" })]}>
								<span>{labels.note}</span>
								<TextArea name={DOCS_FEEDBACK_NOTE_FIELD} rows={3} />
							</label>
							<span>
								<Button type="submit" size="sm" variant="outline" color="neutral">
									{labels.send}
								</Button>
							</span>
						</div>
					</form>
				)}
			</div>
		);
	};
}

namespace DocsFeedbackChoice {
	export interface Props {
		value: "yes" | "no";
		label: string;
	}
}

/**
 * One vote as a radio inside a pill-shaped label, so the choice is a native, keyboardable
 * radio group; the picked pill fills, and keyboard focus rings the pill.
 */
function DocsFeedbackChoice(handle: Handle<DocsFeedbackChoice.Props>) {
	return () => {
		let { label, value } = handle.props;
		let Icon = value === "yes" ? ThumbsUpIcon : ThumbsDownIcon;

		return (
			<label
				data-slot="docs-feedback-choice"
				mix={[
					inlineFlex(),
					items("center"),
					gap(1.5),
					pi(3),
					pb(1),
					rounded("full"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					cursor("pointer"),
					transition("background-color, border-color, color", { duration: 150 }),
					hover(bg("neutral.bg-tint")),
					has(":checked", [bg("brand.tint"), border("brand.border"), fg("brand")]),
					has(":focus-visible", outline({ color: "brand.ring", offset: 2 })),
				]}
			>
				<input
					type="radio"
					name={DOCS_FEEDBACK_VOTE_FIELD}
					value={value}
					required
					mix={[visuallyHidden()]}
				/>
				<Icon size={16} aria-hidden="true" mix={[is("1rem")]} />
				{label}
			</label>
		);
	};
}
