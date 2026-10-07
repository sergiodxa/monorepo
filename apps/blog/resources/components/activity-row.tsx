/**
 * The blog's one row for a post in a list: an emoji per kind, the title as the link, an
 * optional line of description under it, and the date at the end. The home page's activity,
 * the `/search` results and the search dialog all draw their rows with it, so they match.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColorValue } from "@sdxc/u";
import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { formatParts, parseDate } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, inlineFlex, items, justify } from "@sdxc/u/layout";
import { bs, is, m, mbs, minIs } from "@sdxc/u/size";
import { spacing } from "@sdxc/u/tokens";
import { nowrap, text, truncate } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";

/**
 * Prop types for {@link ActivityRow}.
 */
export namespace ActivityRow {
	/** What a row lists, which picks its emoji and the emoji's tint. */
	export type Kind = "article" | "tutorial" | "bookmark" | "glossary";

	export interface Props {
		kind: Kind;
		href: string;
		/** The link's content: plain text, or a title with its matches marked. */
		children: RemixNode;
		/** A date the row ends with, as anything `parseDate` reads; nothing shows for `null`. */
		date: string | null;
		/** One line under the title, cut with an ellipsis where it overflows. */
		description?: RemixNode;
		/** Content after the link on the title line, such as a status badge. */
		badge?: RemixNode;
		/**
		 * Names the emoji for assistive technology. Without it the emoji is decoration, as
		 * in a list whose wording already says what each row is.
		 */
		kindLabel?: string;
		/** `"sm"` for a row inside a compact surface such as a dialog. */
		size?: "sm" | "lg";
		/** Extra mixins on the `<li>`, such as microformat classes. */
		mix?: TagProps<"li">["mix"];
		/** Extra mixins on the title link. */
		linkMix?: TagProps<"a">["mix"];
		/** Extra mixins on the `<time>`. */
		dateMix?: TagProps<"time">["mix"];
	}
}

/** The emoji each kind of row leads with, and the tone it is tinted with. */
const KIND_ICONS: Record<ActivityRow.Kind, { icon: string; tint: ColorValue }> = {
	article: { icon: "📝", tint: "brand.emphasis" },
	tutorial: { icon: "🛠️", tint: "brand" },
	bookmark: { icon: "🔖", tint: "neutral.emphasis" },
	glossary: { icon: "📘", tint: "neutral" },
};

/**
 * Formats a row's date on the UTC calendar, so the day shown is the same wherever the page
 * renders; an unparseable value yields an empty string so the row still renders.
 */
function formatDate(value: string) {
	let parsed = parseDate(value);
	if (isFailure(parsed)) return "";
	return formatParts(parsed.data, {
		locale: "en",
		timeZone: "UTC",
		month: "short",
		day: "2-digit",
		year: "2-digit",
	})
		.map((part) => part.value)
		.join("");
}

/**
 * The machine-readable instant for `<time datetime>`, which carries the `dt-published` a
 * microformats parser reads; `undefined` for an unparseable value, omitting it.
 */
function isoDate(value: string) {
	let parsed = parseDate(value);
	if (isFailure(parsed)) return undefined;
	return parsed.data.toISOString();
}

/**
 * Renders one list row. A fixed emoji column keeps every title at the same inline offset
 * whatever the emoji's intrinsic width, and the title column may shrink so a long title
 * or description is cut rather than pushing the date off the row.
 */
export function ActivityRow(handle: Handle<ActivityRow.Props>) {
	return () => {
		let { badge, children, date, dateMix, description, href, kind, kindLabel, linkMix, mix } =
			handle.props;
		let compact = handle.props.size === "sm";
		let icon = KIND_ICONS[kind];

		return (
			<li
				mix={[
					grid(),
					gridTemplate({ columns: `${spacing(compact ? 6 : 7)} minmax(0, 1fr) auto` }),
					gap(compact ? 2 : 3),
					items("start"),
					mix,
				]}
			>
				<span
					role={kindLabel ? "img" : undefined}
					aria-label={kindLabel}
					aria-hidden={kindLabel ? undefined : "true"}
					mix={[
						inlineFlex(),
						justify("center"),
						items("center"),
						is(compact ? 6 : 7),
						bs(compact ? 6 : 7),
						text(compact ? "base" : "xl"),
						fg(icon.tint),
					]}
				>
					{icon.icon}
				</span>
				<div mix={[minIs(0)]}>
					<p mix={[m(0), text(compact ? "base" : "lg"), fg("neutral.emphasis")]}>
						<Link href={href} mix={linkMix}>
							{children}
						</Link>
						{badge}
					</p>
					{description ? (
						<p mix={[m(0), text("sm"), fg("neutral.muted"), truncate()]}>{description}</p>
					) : null}
				</div>
				{date ? (
					<time
						datetime={isoDate(date)}
						mix={[fg("neutral.muted"), text("sm"), nowrap(), mbs(compact ? 0.5 : 1), dateMix]}
					>
						{formatDate(date)}
					</time>
				) : (
					<span />
				)}
			</li>
		);
	};
}
