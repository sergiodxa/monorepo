/**
 * The blog's one row for a post in a list: an emoji per kind, the title as the link, an
 * optional line of description under it, and the date at the end; a short post shows its
 * content in place of the title, and its date is the link. The home page's activity,
 * the `/search` results and the search dialog all draw their rows with it, so they match.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { formatParts, parseDate } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { gap, grid, gridTemplate, inlineFlex, items, justify } from "@sdxc/u/layout";
import { bs, is, m, mbs, minIs } from "@sdxc/u/size";
import { spacing } from "@sdxc/u/tokens";
import { nowrap, text, truncate } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";

import type { Kind } from "~/app/models/kinds";

import { POST_KINDS } from "~/app/models/kinds";

/**
 * Prop types for {@link ActivityRow}.
 */
export namespace ActivityRow {
	export interface Props {
		/** What the row lists, which picks its emoji and the emoji's tint. */
		kind: Kind;
		href: string;
		/** The link's content: plain text, or a title with its matches marked. */
		children: RemixNode;
		/** A date the row ends with, as anything `parseDate` reads; nothing shows for `null`. */
		date: string | null;
		/** One line under the title, cut with an ellipsis where it overflows. */
		description?: RemixNode;
		/**
		 * Content read in the row itself, shown instead of the linked title, which moves the link
		 * onto the date: how the index shows a note or a TIL whole.
		 */
		inline?: RemixNode;
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
		/** The `<li>`'s id, for a list that refers to its rows. */
		id?: string;
		/** `"option"` makes the row a choice of the `listbox` it sits in. */
		role?: "option";
		/** Whether an `option` row is the chosen one. */
		"aria-selected"?: "true" | "false";
		/** Extra mixins on the title link. */
		linkMix?: TagProps<"a">["mix"];
		/** Extra mixins on the paragraph holding the title, such as cutting it to one line. */
		titleMix?: TagProps<"p">["mix"];
		/** Extra mixins on the `<time>`. */
		dateMix?: TagProps<"time">["mix"];
	}
}

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
		let {
			badge,
			children,
			date,
			dateMix,
			description,
			href,
			inline,
			kind,
			kindLabel,
			linkMix,
			mix,
			titleMix,
		} = handle.props;
		let { id, role, "aria-selected": selected } = handle.props;
		let compact = handle.props.size === "sm";
		let icon = POST_KINDS[kind];

		return (
			<li
				id={id}
				role={role}
				aria-selected={selected}
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
					{inline ?? (
						<p mix={[m(0), text(compact ? "base" : "lg"), fg("neutral.emphasis"), titleMix]}>
							<Link href={href} mix={linkMix}>
								{children}
							</Link>
							{badge}
						</p>
					)}
					{description ? (
						<p mix={[m(0), text("sm"), fg("neutral.muted"), truncate()]}>{description}</p>
					) : null}
				</div>
				{date && inline ? (
					<Link href={href} mix={[mbs(compact ? 0.5 : 1), linkMix]}>
						<time
							datetime={isoDate(date)}
							mix={[fg("neutral.muted"), text("sm"), nowrap(), dateMix]}
						>
							{formatDate(date)}
						</time>
					</Link>
				) : date ? (
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
