/**
 * A statement of money movements grouped by day: each day a heading with its net total,
 * each entry a row of mark, name, detail and amount that may link to its record. The day
 * headings stick while their rows scroll, so a long list keeps saying which day it shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { leading, text, truncate, weight } from "@sdxc/u/typography";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/** Prop types for {@link Ledger} and its parts. */
export namespace Ledger {
	/** Props accepted by {@link Ledger}. */
	export interface Props extends TagProps<"div"> {
		/** {@link Ledger.Day} groups, newest first. */
		children: RemixNode;
	}

	/** Props accepted by {@link Ledger.Day}. */
	export interface DayProps extends Omit<TagProps<"section">, "title"> {
		/** The day's heading as the reader says it: "Today", "Yesterday", "Mon 16 Nov". */
		title: RemixNode;
		/** The day's net movement, usually an `Amount`; omitted on a day of one entry. */
		total?: RemixNode;
		/** {@link Ledger.Entry} rows, newest first. */
		children: RemixNode;
	}

	/** Props accepted by {@link Ledger.Entry}. */
	export interface EntryProps extends Omit<TagProps<"li">, "title"> {
		/** The merchant or person: a logo, an `Avatar` or an icon tile, about 2.5rem square. */
		mark?: RemixNode;
		/** Who the money went to or came from. */
		title: RemixNode;
		/** A quiet second line: the category, the account, a time or "Pending". */
		meta?: RemixNode;
		/** The amount, usually an `Amount` with `sign="ledger"`. */
		amount: RemixNode;
		/** A quiet line under the amount: the original currency, a split share, a note mark. */
		amountMeta?: RemixNode;
		/** The record's address; the whole row becomes one link to it. */
		href?: string;
		/** Marks the row whose record is open beside the list. */
		current?: boolean;
		/** Draws the row muted, for a pending or declined movement. */
		muted?: boolean;
	}
}

/**
 * Renders the statement as a column of day groups.
 *
 * @example
 * <Ledger>
 * 	<Ledger.Day title="Today" total={<Amount value={-2340} currency="EUR" />}>
 * 		<Ledger.Entry mark={<Avatar … />} title="Mercado Rua" meta="Groceries" amount={<Amount value={-2340} currency="EUR" sign="ledger" />} href="?tx=4" />
 * 	</Ledger.Day>
 * </Ledger>
 */
export function Ledger(handle: Handle<Ledger.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="ledger"
				mix={mergeMix([raw({ display: "flex", flexDirection: "column", gap: "1.25rem" })], mix)}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders one day: a sticky heading row with the day's total at its end, over its entries.
 * The heading paints `--ui-ledger-bg` (the page's background by default) and sticks at
 * `--ui-ledger-sticky-top`, so it reads over the rows passing under it.
 */
Ledger.Day = function LedgerDay(handle: Handle<Ledger.DayProps>) {
	return () => {
		let { title, total, children, mix, ...rest } = handle.props;
		let Tag = TAG_BY_LEVEL[resolveHeadingLevel(handle)];
		return (
			<section {...rest} data-slot="ledger-day" mix={mergeMix([], mix)}>
				<div
					data-slot="ledger-day-header"
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: "var(--ui-ledger-sticky-top, 0px)",
							zIndex: "1",
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "1rem",
							paddingBlock: "0.5rem",
							paddingInline: "var(--ui-ledger-inset, 0.75rem)",
							backgroundColor: "var(--ui-ledger-bg, var(--ui-bg, Canvas))",
						}),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					<Tag mix={[raw({ fontSize: "inherit", margin: "0" }), weight("semibold")]}>{title}</Tag>
					{total === undefined ? null : <span data-slot="ledger-day-total">{total}</span>}
				</div>
				<ul
					data-slot="ledger-entries"
					mix={raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "flex",
						flexDirection: "column",
					})}
				>
					{children}
				</ul>
			</section>
		);
	};
};

/**
 * Renders one movement. With `href` the row is a single link covering mark, name and amount,
 * so a tap anywhere opens it; the name truncates before the amount ever does.
 */
Ledger.Entry = function LedgerEntry(handle: Handle<Ledger.EntryProps>) {
	return () => {
		let { mark, title, meta, amount, amountMeta, href, current, muted, mix, ...rest } =
			handle.props;
		let body = (
			<>
				{mark === undefined ? null : (
					<span
						data-slot="ledger-mark"
						mix={raw({ display: "grid", placeItems: "center", flex: "none" })}
					>
						{mark}
					</span>
				)}
				<span
					mix={raw({ display: "flex", flexDirection: "column", minInlineSize: "0", flex: "1" })}
				>
					<span data-slot="ledger-title" mix={[truncate(), weight("medium"), leading("snug")]}>
						{title}
					</span>
					{meta === undefined ? null : (
						<span
							data-slot="ledger-meta"
							mix={[truncate(), text("xs"), fg("neutral.muted"), leading("snug")]}
						>
							{meta}
						</span>
					)}
				</span>
				<span
					mix={raw({
						display: "flex",
						flexDirection: "column",
						alignItems: "flex-end",
						flex: "none",
						textAlign: "end",
					})}
				>
					<span data-slot="ledger-amount" mix={[weight("medium"), leading("snug")]}>
						{amount}
					</span>
					{amountMeta === undefined ? null : (
						<span
							data-slot="ledger-amount-meta"
							mix={[text("xs"), fg("neutral.muted"), leading("snug")]}
						>
							{amountMeta}
						</span>
					)}
				</span>
			</>
		);
		let row = [
			raw({
				display: "flex",
				alignItems: "center",
				gap: "0.75rem",
				minBlockSize: "3.5rem",
				paddingBlock: "0.5rem",
				paddingInline: "var(--ui-ledger-inset, 0.75rem)",
				borderRadius: "var(--ui-radius-lg, 0.75rem)",
				color: "inherit",
				textDecoration: "none",
				outlineOffset: "-2px",
			}),
		];
		return (
			<li
				{...rest}
				data-slot="ledger-entry"
				data-current={current ? "" : undefined}
				data-muted={muted ? "" : undefined}
				mix={mergeMix(
					[
						when("&[data-muted]", raw({ opacity: "0.6" })),
						when("&[data-current] > *", bg("brand.tint")),
					],
					mix,
				)}
			>
				{href === undefined ? (
					<div mix={row}>{body}</div>
				) : (
					<a
						href={href}
						aria-current={current ? "true" : undefined}
						mix={[
							row,
							hover(bg("neutral.bg-tint-hover")),
							focusVisible(raw({ outline: "2px solid var(--ui-brand-solid, Highlight)" })),
						]}
					>
						{body}
					</a>
				)}
			</li>
		);
	};
};
