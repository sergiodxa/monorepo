/**
 * Emoji picker and suggest compounds: pure markup styled with `@sdxc/u` against
 * the shared `--ui-*` theme. Behavior arrives through mixins on the consumer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { hstack, shrink, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, maxBs, p, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, textAlign, weight } from "@sdxc/u/typography";
import { attrs } from "remix/component";

import type { EmojiEntry } from "./lib/types.js";

import { preferredName } from "./lib/search.js";
import { isCustomEmoji, isUnicodeEmoji } from "./lib/types.js";

export { EMOJI_PICK_EVENT, EmojiPickEvent } from "./lib/events.js";
export type { EmojiPickDetail } from "./lib/events.js";
export { emojiInput } from "./mixins/emoji-input.js";
export type { EmojiInputOptions } from "./mixins/emoji-input.js";
export { emojiPicker } from "./mixins/emoji-picker.js";

/** Prop types for {@link EmojiPicker} and its parts. */
export namespace EmojiPicker {
	export interface Props extends TagProps<"div"> {
		/** Preferred shortcodes or emoji keys shown in the recent category. */
		recents?: readonly string[];
		children: RemixNode;
	}

	export type SearchProps = TagProps<"input">;

	export interface CategoriesProps extends TagProps<"div"> {
		children: RemixNode;
	}

	export interface CategoryTabProps extends TagProps<"button"> {
		/** Category id this tab jumps to. */
		category: string;
		/** Accessible name for the tab. */
		label: string;
		children?: RemixNode;
	}

	export interface ViewportProps extends TagProps<"div"> {
		children: RemixNode;
	}

	export interface CategoryProps extends TagProps<"section"> {
		id: string;
		label: string;
		children?: RemixNode;
	}

	export interface CellProps extends TagProps<"button"> {
		entry: EmojiEntry;
	}

	export interface PreviewProps extends TagProps<"div"> {
		children?: RemixNode;
	}

	export interface EmptyProps extends TagProps<"div"> {
		children?: RemixNode;
	}

	export interface StatusProps extends TagProps<"div"> {
		children?: RemixNode;
	}
}

/**
 * Browse panel: search, category tabs, viewport, preview and status. Place
 * inside the app’s `<dialog>` or popover; attach picker mixins via `mix`.
 */
export function EmojiPicker(handle: Handle<EmojiPicker.Props>) {
	return () => {
		let { children, mix, recents: _recents, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-picker=""
				mix={mergeMix(
					[
						vstack({ gap: 2 }),
						rounded("xl"),
						border({ color: "neutral", width: 1 }),
						bg(),
						p(2),
						raw({
							"--emoji-columns": "8",
							"--emoji-cell-size": "2rem",
							inlineSize: "min(100%, 22rem)",
						}),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
}

EmojiPicker.Search = function EmojiPickerSearch(handle: Handle<EmojiPicker.SearchProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<input
				{...rest}
				data-emoji-search
				mix={mergeMix(
					[
						is("full"),
						rounded("full"),
						border({ color: "neutral", width: 1 }),
						bg(),
						pi(3),
						bs(9),
						text("sm"),
						fg("neutral.emphasis"),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					],
					mix,
				)}
			/>
		);
	};
};

EmojiPicker.Categories = function EmojiPickerCategories(
	handle: Handle<EmojiPicker.CategoriesProps>,
) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-categories=""
				mix={mergeMix(
					[
						attrs({ role: "tablist" }),
						hstack({ gap: 1, align: "center" }),
						overflow("auto"),
						pb(1),
						borderEdge("block-end", { color: "neutral", width: 1 }),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

EmojiPicker.CategoryTab = function EmojiPickerCategoryTab(
	handle: Handle<EmojiPicker.CategoryTabProps>,
) {
	return () => {
		let { category, children, label, mix, type = "button", ...rest } = handle.props;
		return (
			<button
				type={type}
				{...rest}
				data-emoji-category-tab={category}
				mix={mergeMix(
					[
						attrs({ role: "tab", "aria-label": label }),
						rounded("full"),
						bs(8),
						is(8),
						p(0),
						cursor("pointer"),
						bg("transparent"),
						fg("neutral"),
						when("&[aria-selected='true']", [bg("neutral.tint"), weight("semibold")]),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					],
					mix,
				)}
			>
				{children}
			</button>
		);
	};
};

EmojiPicker.Viewport = function EmojiPickerViewport(handle: Handle<EmojiPicker.ViewportProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-viewport=""
				mix={mergeMix([overflow("auto"), maxBs(64), vstack({ gap: 2 })], mix)}
			>
				{children}
			</div>
		);
	};
};

EmojiPicker.Category = function EmojiPickerCategory(handle: Handle<EmojiPicker.CategoryProps>) {
	return () => {
		let { children, id, label, mix, ...rest } = handle.props;
		return (
			<section {...rest} id={id} data-emoji-category={id} mix={mergeMix([vstack({ gap: 1 })], mix)}>
				<h3
					mix={[
						text("xs"),
						weight("semibold"),
						fg("neutral.muted"),
						raw({
							position: "sticky",
							insetBlockStart: "0",
							background: "var(--ui-bg, Canvas)",
							paddingBlock: "0.25rem",
							margin: "0",
							zIndex: "1",
						}),
					]}
				>
					{label}
				</h3>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(var(--emoji-columns), var(--emoji-cell-size))",
							gap: "0.25rem",
							justifyContent: "space-between",
						}),
					]}
				>
					{children}
				</div>
			</section>
		);
	};
};

EmojiPicker.Cell = function EmojiPickerCell(handle: Handle<EmojiPicker.CellProps>) {
	return () => {
		let { entry, mix, type = "button", ...rest } = handle.props;
		let name = preferredName(entry);
		return (
			<button
				type={type}
				{...rest}
				data-emoji-cell=""
				data-name={name}
				data-kind={isCustomEmoji(entry) ? "custom" : "unicode"}
				{...(isUnicodeEmoji(entry) ? { "data-emoji": entry.emoji } : { "data-src": entry.src })}
				aria-label={isCustomEmoji(entry) ? (entry.label ?? name) : name}
				title={`:${name}:`}
				mix={mergeMix(
					[
						rounded("md"),
						raw({
							blockSize: "var(--emoji-cell-size)",
							inlineSize: "var(--emoji-cell-size)",
						}),
						p(0),
						cursor("pointer"),
						bg("transparent"),
						text("lg"),
						textAlign("center"),
						when("&:hover, &:focus-visible", bg("neutral.tint")),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 1 })),
					],
					mix,
				)}
			>
				{isUnicodeEmoji(entry) ? (
					entry.emoji
				) : (
					<img
						src={entry.src}
						alt={entry.label ?? name}
						draggable="false"
						mix={[is("full"), bs("full"), raw({ objectFit: "contain" })]}
					/>
				)}
			</button>
		);
	};
};

EmojiPicker.Preview = function EmojiPickerPreview(handle: Handle<EmojiPicker.PreviewProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-preview=""
				mix={mergeMix(
					[
						hstack({ gap: 2, align: "center" }),
						borderEdge("block-start", { color: "neutral", width: 1 }),
						raw({ paddingBlockStart: "0.5rem" }),
						text("sm"),
						fg("neutral.muted"),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

EmojiPicker.Empty = function EmojiPickerEmpty(handle: Handle<EmojiPicker.EmptyProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-empty=""
				mix={mergeMix([text("sm"), fg("neutral.muted"), textAlign("center"), p(3)], mix)}
			>
				{children}
			</div>
		);
	};
};

EmojiPicker.Status = function EmojiPickerStatus(handle: Handle<EmojiPicker.StatusProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-status=""
				mix={mergeMix(
					[attrs({ role: "status", "aria-live": "polite" }), text("xs"), fg("neutral.muted")],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

/** Prop types for {@link EmojiSuggest}. */
export namespace EmojiSuggest {
	export interface Props extends TagProps<"div"> {
		children: RemixNode;
	}

	export interface ItemProps extends TagProps<"button"> {
		entry: EmojiEntry;
		/** Substring of the shortcode to highlight. */
		highlight?: string;
	}

	export interface EmptyProps extends TagProps<"div"> {
		children?: RemixNode;
	}

	export interface StatusProps extends TagProps<"div"> {
		children?: RemixNode;
	}
}

/** Colon-autocomplete listbox host. */
export function EmojiSuggest(handle: Handle<EmojiSuggest.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-suggest=""
				mix={mergeMix(
					[
						attrs({ role: "listbox" }),
						vstack({ gap: 0 }),
						rounded("lg"),
						border({ color: "neutral", width: 1 }),
						bg(),
						overflow("auto"),
						maxBs(64),
						p(1),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
}

EmojiSuggest.Item = function EmojiSuggestItem(handle: Handle<EmojiSuggest.ItemProps>) {
	return () => {
		let { entry, highlight, mix, type = "button", ...rest } = handle.props;
		let name = preferredName(entry);
		return (
			<button
				type={type}
				{...rest}
				data-emoji-item=""
				data-name={name}
				mix={mergeMix(
					[
						attrs({ role: "option" }),
						hstack({ gap: 2, align: "center" }),
						rounded("md"),
						pi(2),
						bs(9),
						is("full"),
						cursor("pointer"),
						bg("transparent"),
						text("sm"),
						textAlign("start"),
						when("&[data-active], &[aria-selected='true'], &:hover", bg("neutral.tint")),
					],
					mix,
				)}
			>
				{isUnicodeEmoji(entry) ? (
					<span mix={[text("lg"), shrink(0)]}>{entry.emoji}</span>
				) : (
					<img
						src={entry.src}
						alt={entry.label ?? name}
						draggable="false"
						mix={[bs(5), is(5), shrink(0), raw({ objectFit: "contain" })]}
					/>
				)}
				<span mix={[fg("neutral")]}>:{highlightName(name, highlight)}:</span>
			</button>
		);
	};
};

EmojiSuggest.Empty = function EmojiSuggestEmpty(handle: Handle<EmojiSuggest.EmptyProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-empty=""
				mix={mergeMix([text("sm"), fg("neutral.muted"), p(2)], mix)}
			>
				{children}
			</div>
		);
	};
};

EmojiSuggest.Status = function EmojiSuggestStatus(handle: Handle<EmojiSuggest.StatusProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-emoji-status=""
				mix={mergeMix(
					[
						attrs({ role: "status", "aria-live": "polite" }),
						text("xs"),
						fg("neutral.muted"),
						pi(2),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

function highlightName(name: string, highlight: string | undefined): RemixNode {
	if (!highlight) return name;
	let needle = highlight.toLowerCase();
	let at = name.toLowerCase().indexOf(needle);
	if (at < 0) return name;
	return (
		<>
			{name.slice(0, at)}
			<mark mix={[bg("warning.tint"), raw({ color: "inherit" })]}>
				{name.slice(at, at + needle.length)}
			</mark>
			{name.slice(at + needle.length)}
		</>
	);
}
