/**
 * The pieces every Tuppence screen shares: amounts in the app's locale, merchant and
 * category marks, the warm panel a section sits in, a screen's title row, and the note that
 * says no money really moves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ArrowLeftRightIcon,
	BusIcon,
	ClapperboardIcon,
	HeartPulseIcon,
	InfoIcon,
	PiggyBankIcon,
	PlaneIcon,
	ReceiptIcon,
	ShoppingBagIcon,
	ShoppingBasketIcon,
	UtensilsIcon,
	WalletIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Heading, HeadingScope } from "@sdxc/ui";
import { Amount } from "@sdxc/ui/amount";

import type { CategoryId, Merchant } from "./data";

import { LOCALE, findCategory } from "./data";

/** The serif balances are set in, so a figure reads as money before it reads as data. */
export const SERIF =
	"'Iowan Old Style', 'Palatino Linotype', Palatino, 'URW Palladio L', P052, Georgia, serif";

namespace Money {
	export interface Props {
		value: number;
		currency: string;
		sign?: Amount.Sign;
		smallMinor?: boolean;
		compact?: boolean;
	}
}

/** An amount in the app's locale. */
export function Money(handle: Handle<Money.Props>) {
	return () => <Amount locale={LOCALE} {...handle.props} />;
}

namespace MerchantMark {
	export interface Props {
		merchant: Merchant | undefined;
		/** The tile's side in rem. @default 2.5 */
		size?: number;
	}
}

/**
 * A merchant's mark: its letters on a soft tile of its own hue, round for a person and
 * rounded-square for a business, so the eye finds a shop in a long list by color first.
 */
export function MerchantMark(handle: Handle<MerchantMark.Props>) {
	return () => {
		let { merchant, size = 2.5 } = handle.props;
		let hue = merchant?.hue ?? 60;
		let person =
			merchant !== undefined &&
			(merchant.category === "transfers" || merchant.id === "landlord") &&
			merchant.id !== "exchange";
		return (
			<span
				aria-hidden="true"
				data-slot="merchant-mark"
				mix={raw({
					display: "grid",
					placeItems: "center",
					inlineSize: `${size}rem`,
					blockSize: `${size}rem`,
					flex: "none",
					borderRadius: person ? "999px" : "28%",
					backgroundColor: `light-dark(oklch(0.92 0.05 ${hue}), oklch(0.34 0.06 ${hue}))`,
					color: `light-dark(oklch(0.38 0.1 ${hue}), oklch(0.9 0.06 ${hue}))`,
					fontSize: `${size * 0.36}rem`,
					fontWeight: "650",
					letterSpacing: "-0.02em",
				})}
			>
				{merchant?.letters ?? "?"}
			</span>
		);
	};
}

namespace CategoryIcon {
	export interface Props {
		category: CategoryId;
		size?: number;
	}
}

/** The icon a category is drawn with. */
export function CategoryIcon(handle: Handle<CategoryIcon.Props>) {
	return () => {
		let { category, size = 16 } = handle.props;
		let props = { size, "aria-hidden": "true" as const };
		if (category === "groceries") return <ShoppingBasketIcon {...props} />;
		if (category === "eating-out") return <UtensilsIcon {...props} />;
		if (category === "bills") return <ReceiptIcon {...props} />;
		if (category === "transport") return <BusIcon {...props} />;
		if (category === "shopping") return <ShoppingBagIcon {...props} />;
		if (category === "entertainment") return <ClapperboardIcon {...props} />;
		if (category === "health") return <HeartPulseIcon {...props} />;
		if (category === "travel") return <PlaneIcon {...props} />;
		if (category === "savings") return <PiggyBankIcon {...props} />;
		if (category === "transfers") return <ArrowLeftRightIcon {...props} />;
		return <WalletIcon {...props} />;
	};
}

namespace CategoryTile {
	export interface Props {
		category: CategoryId;
		/** @default 2.25 */
		size?: number;
	}
}

/** A category's icon on a tile of its chart color, so the list and the chart share a key. */
export function CategoryTile(handle: Handle<CategoryTile.Props>) {
	return () => {
		let { category, size = 2.25 } = handle.props;
		let color = findCategory(category)?.color;
		let tone =
			color === null || color === undefined
				? "var(--ui-neutral-fg-muted)"
				: `var(--ui-chart-${color})`;
		return (
			<span
				aria-hidden="true"
				mix={raw({
					display: "grid",
					placeItems: "center",
					inlineSize: `${size}rem`,
					blockSize: `${size}rem`,
					flex: "none",
					borderRadius: "30%",
					color: tone,
					backgroundColor: `color-mix(in oklch, ${tone} 16%, transparent)`,
				})}
			>
				<CategoryIcon category={category} size={Math.round(size * 7.5)} />
			</span>
		);
	};
}

namespace Panel {
	export interface Props {
		/** The section's heading. */
		title?: RemixNode;
		/** A quiet link or control at the heading's end, such as "See all". */
		action?: RemixNode;
		/** An id for the section, so a redirect can land on it. */
		id?: string;
		/** Drops the inner padding, for a list whose rows pad themselves. */
		flush?: boolean;
		children: RemixNode;
	}
}

/** A section on a warm card: a heading row and its content, one level under the screen's title. */
export function Panel(handle: Handle<Panel.Props>) {
	return () => {
		let { title, action, id, flush = false, children } = handle.props;
		return (
			<section
				id={id}
				data-slot="tuppence-panel"
				mix={raw({
					display: "flex",
					flexDirection: "column",
					gap: "0.75rem",
					padding: flush ? "1rem 0.25rem 0.5rem" : "1.125rem 1.25rem 1.25rem",
					borderRadius: "1.25rem",
					backgroundColor: "var(--tuppence-card)",
					boxShadow: "0 0 0 1px var(--tuppence-hairline)",
					minInlineSize: "0",
					"--ui-ledger-bg": "var(--tuppence-card)",
				})}
			>
				{title === undefined ? null : (
					<header
						mix={raw({
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "1rem",
							paddingInline: flush ? "1rem" : "0",
						})}
					>
						<Heading
							mix={raw({
								fontSize: "1rem",
								fontWeight: "600",
								margin: "0",
								letterSpacing: "-0.01em",
							})}
						>
							{title}
						</Heading>
						{action}
					</header>
				)}
				<HeadingScope>{children}</HeadingScope>
			</section>
		);
	};
}

namespace ScreenTitle {
	export interface Props {
		title: RemixNode;
		/** A quiet line under the title. */
		detail?: RemixNode;
		/** Controls at the row's end. */
		actions?: RemixNode;
	}
}

/** A screen's title row: the screen's one `h1`, a line under it, and its actions. */
export function ScreenTitle(handle: Handle<ScreenTitle.Props>) {
	return () => {
		let { title, detail, actions } = handle.props;
		return (
			<header
				mix={raw({
					display: "flex",
					flexWrap: "wrap",
					alignItems: "flex-end",
					justifyContent: "space-between",
					gap: "0.75rem 1rem",
				})}
			>
				<div
					mix={raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.25rem",
						minInlineSize: "0",
					})}
				>
					<h1
						mix={raw({
							margin: "0",
							fontFamily: SERIF,
							fontSize: "clamp(1.625rem, 1.3rem + 1vw, 2rem)",
							fontWeight: "600",
							letterSpacing: "-0.015em",
							lineHeight: "1.15",
						})}
					>
						{title}
					</h1>
					{detail === undefined ? null : (
						<p
							mix={raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" })}
						>
							{detail}
						</p>
					)}
				</div>
				{actions === undefined ? null : (
					<div mix={raw({ display: "flex", flexWrap: "wrap", gap: "0.5rem" })}>{actions}</div>
				)}
			</header>
		);
	};
}

namespace DemoNote {
	export interface Props {
		children: RemixNode;
	}
}

/** The note beside every control that moves money, saying the demo moves none. */
export function DemoNote(handle: Handle<DemoNote.Props>) {
	return () => (
		<p
			data-slot="demo-note"
			mix={raw({
				display: "flex",
				alignItems: "flex-start",
				gap: "0.5rem",
				margin: "0",
				padding: "0.625rem 0.75rem",
				borderRadius: "0.75rem",
				fontSize: "0.8125rem",
				lineHeight: "1.45",
				color: "var(--ui-neutral-fg-muted)",
				backgroundColor: "color-mix(in oklch, var(--ui-brand-solid) 7%, transparent)",
				border: "1px dashed color-mix(in oklch, var(--ui-brand-solid) 35%, transparent)",
			})}
		>
			<InfoIcon
				size={16}
				aria-hidden="true"
				mix={raw({ flex: "none", marginBlockStart: "0.1rem" })}
			/>
			<span>
				<strong mix={raw({ color: "var(--ui-fg)", fontWeight: "600" })}>Demo:</strong>{" "}
				{handle.props.children}
			</span>
		</p>
	);
}

namespace Screen {
	export interface Props {
		children: RemixNode;
		/** The widest the column grows. @default "72rem" */
		width?: string;
	}
}

/**
 * A screen's column: centred, with room between sections. It points the chart palette at the
 * app's category colors here, below the theme's own declaration, so every chart keeps them.
 */
export function Screen(handle: Handle<Screen.Props>) {
	return () => (
		<HeadingScope
			level={2}
			mix={raw({
				display: "flex",
				flexDirection: "column",
				gap: "1.25rem",
				inlineSize: "100%",
				maxInlineSize: handle.props.width ?? "72rem",
				marginInline: "auto",
				paddingBlockEnd: "2rem",
				...Object.fromEntries(
					Array.from({ length: 8 }, (_, index) => [
						`--ui-chart-${index + 1}`,
						`var(--tuppence-cat-${index + 1})`,
					]),
				),
			})}
		>
			{handle.props.children}
		</HeadingScope>
	);
}

/**
 * A day as the statement heads it: "Today", "Yesterday", else the weekday and date.
 *
 * @param day `YYYY-MM-DD`.
 * @param today The demo's today.
 */
export function dayTitle(day: string, today: string): string {
	let date = new Date(`${day}T12:00:00Z`);
	let gap = Math.round((new Date(`${today}T12:00:00Z`).getTime() - date.getTime()) / 86400000);
	if (gap === 0) return "Today";
	if (gap === 1) return "Yesterday";
	if (gap === -1) return "Tomorrow";
	return new Intl.DateTimeFormat(LOCALE, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	}).format(date);
}

/**
 * A date written out for a sentence, such as "1 March 2027".
 *
 * @param day `YYYY-MM-DD`.
 * @param withYear Whether to name the year.
 */
export function longDate(day: string, withYear = true): string {
	return new Intl.DateTimeFormat(LOCALE, {
		day: "numeric",
		month: "long",
		...(withYear ? { year: "numeric" as const } : {}),
		timeZone: "UTC",
	}).format(new Date(`${day}T12:00:00Z`));
}
