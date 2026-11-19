/**
 * Island picking an emoji from a popover grid: a trigger opens a filterable grid grouped
 * under headings, and a pick either submits the picker's form, as an "add reaction" does,
 * or writes the emoji at the composer's caret. Submit mode works before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, RemixNode } from "remix/component";

import { FaceSlightlySmilingIcon, SearchIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { hstack, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, maxBs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import type { Button as ButtonTypes } from "../components/button.js";
import type { Popover as PopoverTypes } from "../components/popover.js";

import { Button } from "../components/button.js";
import { Popover } from "../components/popover.js";

import type { EmojiEntry } from "./utils/emoji.js";

import { emojiGrid } from "./mixins/emoji-grid.js";
import { EMOJI, filterEmoji } from "./utils/emoji.js";

export type { EmojiEntry } from "./utils/emoji.js";
export { EMOJI, filterEmoji } from "./utils/emoji.js";

/** Prop types for {@link EmojiPicker}. */
export namespace EmojiPicker {
	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		/** The popover's `id`, which the trigger's `popovertarget` names. */
		id: string;
		/** The trigger's accessible name, the filter's label, and the line shown when nothing matches. */
		labels: { trigger: string; search: string; empty: string };
		/** The trigger's content. @default a smiling face icon */
		trigger?: RemixNode;
		/**
		 * Submit mode: each emoji is a submit button with this `name` and the emoji as its value,
		 * so a picker inside a `<form>` posts the pick without script.
		 */
		name?: string;
		/**
		 * Insert mode, used when `name` is absent: the `id` of the `<textarea>` a pick is written
		 * into, at its caret; the `Composer.Input` of the picker's form when omitted.
		 */
		target?: string;
		/** The emoji to offer, grouped by their `group` in first-seen order. @default {@link EMOJI} */
		emoji?: EmojiEntry[];
		/** The trigger's size. @default "sm" */
		size?: ButtonTypes.Size;
		/** The trigger's look. @default "ghost" */
		variant?: ButtonTypes.Variant;
		/** Where the grid opens against the trigger. @default "top-start" */
		placement?: PopoverTypes.Placement;
	};
}

/** The entries split into their groups, each group in the order it first appears. */
function groupEmoji(emoji: readonly EmojiEntry[]): Array<[string, EmojiEntry[]]> {
	let groups = new Map<string, EmojiEntry[]>();
	for (let entry of emoji) {
		let list = groups.get(entry.group) ?? [];
		list.push(entry);
		groups.set(entry.group, list);
	}
	return Array.from(groups);
}

/**
 * Renders the trigger and its popover. Hydrated, the filter narrows the grid by name, the
 * arrow keys move through it, and Enter in the filter picks the first match; Escape and a
 * click outside close it natively. In insert mode the trigger hides without script.
 *
 * @example
 * <form method="post" action={`/messages/${id}/reactions`}>
 * 	<EmojiPicker id={`react-${id}`} name="emoji" labels={{ trigger: "Add reaction", search: "Search emoji", empty: "No emoji found" }} />
 * </form>
 * @example
 * <Composer.Toolbar>
 * 	<EmojiPicker id="composer-emoji" labels={{ trigger: "Insert emoji", search: "Search emoji", empty: "No emoji found" }} />
 * </Composer.Toolbar>
 */
export const EmojiPicker: EntryComponent<EmojiPicker.Props> = clientEntry(
	"@sdxc/ui/chat/emoji-picker#EmojiPicker",
	function EmojiPicker(handle: Handle<EmojiPicker.Props>) {
		let query = "";
		let hydrated = false;
		/** The emoji whose button holds the grid's one tab stop. */
		let current: string | undefined;
		handle.queueTask(() => {
			if (handle.signal.aborted) return;
			hydrated = true;
			void handle.update();
		});

		/**
		 * The grid keeps one tab stop once hydrated, on `stop`, so Tab leaves it in one step;
		 * the server's grid leaves every button in the tab order for a page without script.
		 */
		function tabIndex(char: string, stop: string | undefined): number | undefined {
			if (!hydrated) return undefined;
			return char === stop ? 0 : -1;
		}

		/** Starts each opening with an empty filter. */
		function onOpen() {
			query = "";
			current = undefined;
			return handle.update();
		}

		/** Narrows the grid to the filter, moving the tab stop to the first match. */
		function onQuery(next: string) {
			query = next;
			current = undefined;
			void handle.update();
		}

		/** Records the button the arrow keys moved the tab stop to. */
		function onCurrent(char: string | undefined) {
			current = char;
		}

		return () => {
			let {
				id,
				labels,
				trigger,
				name,
				target,
				emoji = EMOJI,
				size = "sm",
				variant = "ghost",
				placement = "top-start",
			} = handle.props;
			let shown = filterEmoji(emoji, query);
			let stop =
				current !== undefined && shown.some((entry) => entry.char === current)
					? current
					: shown[0]?.char;
			let submit = name !== undefined;

			return (
				<span data-slot="emoji-picker" mix={[raw({ display: "contents" })]}>
					<Button
						type="button"
						popovertarget={id}
						size={size}
						variant={variant}
						color="neutral"
						aria-label={labels.trigger}
						title={labels.trigger}
						data-slot="emoji-picker-trigger"
						mix={submit ? [] : [media("(scripting: none)", raw({ display: "none" }))]}
					>
						{trigger ?? <FaceSlightlySmilingIcon size={16} aria-hidden="true" />}
					</Button>
					<Popover
						id={id}
						placement={placement}
						aria-label={labels.trigger}
						mix={[
							p(2),
							is("max-content"),
							raw({ maxInlineSize: "calc(100vw - 1rem)" }),
							emojiGrid({ submit, target, onQuery, onCurrent, onOpen }),
						]}
					>
						<label
							mix={[
								hstack({ gap: 2, align: "center" }),
								pi(2),
								bs("2.25rem"),
								rounded("md"),
								border({ color: "neutral", width: 1 }),
								bg(),
								when("&:focus-within", outline({ color: "neutral.ring", offset: 0 })),
								media("(scripting: none)", raw({ display: "none" })),
							]}
						>
							<SearchIcon size={14} aria-hidden="true" mix={[fg("neutral.muted"), shrink(0)]} />
							<input
								type="search"
								aria-label={labels.search}
								placeholder={labels.search}
								autocomplete="off"
								spellcheck={false}
								data-emoji-search=""
								value={query}
								mix={[
									raw({
										flex: "1",
										minInlineSize: 0,
										border: "none",
										background: "transparent",
										color: "inherit",
										font: "inherit",
										outline: "none",
									}),
									text("sm"),
								]}
							/>
						</label>
						<div mix={[maxBs("16rem"), raw({ overflowY: "auto" }), pbs(1)]}>
							{groupEmoji(shown).map(([group, entries]) => (
								<div key={group} role="group" aria-label={group}>
									<div
										aria-hidden="true"
										mix={[pi(1), pbs(2), pbe(1), text("xs"), weight("medium"), fg("neutral.muted")]}
									>
										{group}
									</div>
									<div
										mix={[
											raw({
												display: "grid",
												gridTemplateColumns: "repeat(8, 2rem)",
												gap: "0.125rem",
											}),
										]}
									>
										{entries.map((entry) => (
											<button
												key={entry.char}
												type={submit ? "submit" : "button"}
												name={name}
												value={submit ? entry.char : undefined}
												aria-label={entry.name}
												title={entry.name}
												tabIndex={tabIndex(entry.char, stop)}
												data-emoji={entry.char}
												mix={[
													is("2rem"),
													bs("2rem"),
													m(0),
													p(0),
													rounded("md"),
													bg("transparent"),
													cursor("pointer"),
													raw({ border: "none", fontSize: "1.25rem", lineHeight: "1" }),
													when("&:hover, &:focus-visible", bg("neutral.bg-tint")),
													when("&:focus-visible", outline({ color: "neutral.ring", offset: 0 })),
												]}
											>
												{entry.char}
											</button>
										))}
									</div>
								</div>
							))}
							{shown.length === 0 ? (
								<p role="status" mix={[m(0), p(3), text("sm"), fg("neutral.muted")]}>
									{labels.empty}
								</p>
							) : null}
						</div>
					</Popover>
				</span>
			);
		};
	},
);
