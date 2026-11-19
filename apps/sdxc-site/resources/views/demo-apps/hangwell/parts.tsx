/**
 * Pieces several Hangwell screens share: the page gutter and headings, a poster's card with
 * its price and wishlist heart, a grid and a scrolling shelf of cards, and the small notes the
 * shop repeats. Each is drawn from `@sdxc/ui` so the screens stay about the store.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Price } from "@sdxc/ui/commerce/price";
import { ProductCard } from "@sdxc/ui/commerce/product-card";

import type { Poster } from "./data";

import { FramedArt, PosterArt } from "./art";
import {
	CURRENCY,
	LOCALE,
	actionHref,
	findArtist,
	findPaint,
	fromPrice,
	href,
	listPrice,
} from "./data";

/** Wide layouts start here. */
export const WIDE = "(min-width: 56rem)";

/** The page's side gutter. */
export const GUTTER = "clamp(1rem, 4vw, 3rem)";

/** The widest the content grows. */
export const CONTENT_MAX = "88rem";

/** The header's height, which sticky parts sit under. */
export const HEADER = "4rem";

/** The quiet gallery wall a poster sits on in a card. */
export const WALL = "var(--ui-neutral-bg-tint)";

/** Centres a screen's content with the shop's gutter and width. */
export function Gutter(handle: Handle<{ children: RemixNode; narrow?: boolean }>) {
	return () => (
		<div
			mix={[
				raw({
					boxSizing: "border-box",
					inlineSize: "100%",
					maxInlineSize: handle.props.narrow ? "64rem" : CONTENT_MAX,
					marginInline: "auto",
					paddingInline: GUTTER,
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

namespace PageTitle {
	export interface Props {
		eyebrow?: RemixNode;
		children: RemixNode;
		lead?: RemixNode;
		aside?: RemixNode;
	}
}

/** A screen's one `h1`, with an optional eyebrow, lead and something at the end. */
export function PageTitle(handle: Handle<PageTitle.Props>) {
	return () => {
		let { aside, children, eyebrow, lead } = handle.props;
		return (
			<header
				mix={[
					raw({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "end",
						justifyContent: "space-between",
						gap: "1rem",
						paddingBlock: "clamp(1.5rem, 4vw, 3rem) 1.25rem",
					}),
				]}
			>
				<div mix={[raw({ display: "grid", gap: "0.5rem", maxInlineSize: "44rem" })]}>
					{eyebrow === undefined ? null : <p mix={[raw(EYEBROW)]}>{eyebrow}</p>}
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1.75rem, 4.5vw, 3rem)",
								fontWeight: "500",
								letterSpacing: "-0.02em",
								lineHeight: "1.05",
								textWrap: "balance",
							}),
						]}
					>
						{children}
					</h1>
					{lead === undefined ? null : (
						<p
							mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", textWrap: "pretty" })]}
						>
							{lead}
						</p>
					)}
				</div>
				{aside}
			</header>
		);
	};
}

/** Small spaced capitals for a label over a heading. */
export const EYEBROW = {
	margin: "0",
	fontSize: "0.75rem",
	fontWeight: "600",
	letterSpacing: "0.12em",
	textTransform: "uppercase",
	color: "var(--ui-neutral-fg-muted)",
} as const;

namespace WishButton {
	export interface Props {
		poster: Poster;
		saved: boolean;
		/** The page to come back to after the post. */
		back: string;
		variant?: "overlay" | "inline";
	}
}

/** A heart that saves a poster to the wishlist, or takes it off, as a form post. */
export function WishButton(handle: Handle<WishButton.Props>) {
	return () => {
		let { back, poster, saved, variant = "overlay" } = handle.props;
		return (
			<form method="post" action={actionHref("wishlist")} mix={[raw({ margin: "0" })]}>
				<input type="hidden" name="poster" value={poster.id} />
				<input type="hidden" name="back" value={back} />
				<button
					type="submit"
					aria-pressed={saved ? "true" : "false"}
					aria-label={
						saved
							? `Remove ${poster.title} from your wishlist`
							: `Save ${poster.title} to your wishlist`
					}
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							gap: "0.375rem",
							gridAutoFlow: "column",
							minInlineSize: "2.5rem",
							blockSize: "2.5rem",
							paddingInline: variant === "inline" ? "1rem" : "0",
							border: variant === "inline" ? "1px solid var(--ui-neutral-border)" : "0",
							borderRadius: variant === "inline" ? "var(--ui-cta-radius)" : "999px",
							backgroundColor: variant === "inline" ? "transparent" : "oklch(1 0 0 / 0.85)",
							backdropFilter: "blur(6px)",
							color: saved ? "var(--ui-color-brand-600)" : "var(--ui-neutral-fg-emphasis)",
							font: "inherit",
							fontWeight: "500",
							cursor: "pointer",
							"& svg": {
								inlineSize: "1.125rem",
								blockSize: "1.125rem",
								fill: saved ? "currentColor" : "none",
							},
						}),
						when("&:hover", raw({ color: "var(--ui-color-brand-600)" })),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-color-brand-600)", outlineOffset: "2px" }),
						),
					]}
				>
					<HeartIcon />
					{variant === "inline" ? <span>{saved ? "Saved" : "Save"}</span> : null}
				</button>
			</form>
		);
	};
}

namespace PosterCard {
	export interface Props {
		poster: Poster;
		saved: boolean;
		back: string;
	}
}

/** A poster in a grid: the print, a framed view on hover, artist, swatches and its "from" price. */
export function PosterCard(handle: Handle<PosterCard.Props>) {
	return () => {
		let { back, poster, saved } = handle.props;
		let artist = findArtist(poster.artist);
		let from = fromPrice(poster);
		let list = listPrice(poster, { format: "print", size: "a4", frame: null, mount: false });
		return (
			<ProductCard
				href={href(`p/${poster.id}`)}
				title={poster.title}
				subtitle={artist?.name}
				mediaBackground={WALL}
				media={<Mat poster={poster} />}
				hoverMedia={<Mat poster={poster} framed />}
				price={
					<Price
						amount={from}
						currency={CURRENCY}
						locale={LOCALE}
						from
						size="sm"
						compareAt={poster.sale === undefined ? undefined : list}
					/>
				}
				badges={<PosterBadge poster={poster} />}
				swatches={poster.paints.map((id) => ({
					name: findPaint(id)?.name ?? id,
					color: findPaint(id)?.color ?? "gray",
				}))}
				action={<WishButton poster={poster} saved={saved} back={back} />}
			/>
		);
	};
}

/** The print floating on its wall, or the same print in an oak frame. */
function Mat(handle: Handle<{ poster: Poster; framed?: boolean }>) {
	return () => {
		let { framed = false, poster } = handle.props;
		let landscape = poster.orientation === "landscape";
		return (
			<span
				mix={[
					raw({
						display: "grid",
						placeItems: "center",
						inlineSize: "100%",
						blockSize: "100%",
						padding: landscape ? "14%" : "12% 16%",
						boxSizing: "border-box",
					}),
				]}
			>
				<span
					mix={[
						raw({
							inlineSize: "100%",
							filter: framed ? "none" : "drop-shadow(0 6px 10px oklch(0.2 0.01 60 / 0.18))",
						}),
					]}
				>
					{framed ? <FramedArt poster={poster} frame="oak" mount /> : <PosterArt poster={poster} />}
				</span>
			</span>
		);
	};
}

/** A poster card's badge: its sale, or "New" for the latest posters. */
function PosterBadge(handle: Handle<{ poster: Poster }>) {
	return () => {
		let { poster } = handle.props;
		if (poster.sale !== undefined) return <Tag tone="sale">−{poster.sale}%</Tag>;
		return poster.added > 26 ? <Tag>New</Tag> : null;
	};
}

/** A small label on a card or a line: "New", a sale, "Low stock". */
export function Tag(handle: Handle<{ children: RemixNode; tone?: "sale" | "neutral" }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-block",
					paddingInline: "0.5rem",
					paddingBlock: "0.125rem",
					fontSize: "0.75rem",
					fontWeight: "600",
					letterSpacing: "0.02em",
					borderRadius: "999px",
					color: handle.props.tone === "sale" ? "oklch(0.99 0 0)" : "var(--ui-neutral-fg-emphasis)",
					backgroundColor:
						handle.props.tone === "sale" ? "var(--ui-color-brand-600)" : "oklch(1 0 0 / 0.9)",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

namespace PosterGrid {
	export interface Props {
		posters: Poster[];
		wish: string[];
		back: string;
		label: string;
	}
}

/** Posters as a responsive grid: two across on a phone, up to four on a wide screen. */
export function PosterGrid(handle: Handle<PosterGrid.Props>) {
	return () => {
		let { back, label, posters, wish } = handle.props;
		return (
			<ul
				aria-label={label}
				mix={[
					raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(10rem, 42vw), 1fr))",
						gap: "clamp(1rem, 2.5vw, 2rem) clamp(0.75rem, 2vw, 1.5rem)",
						"@media (min-width: 40rem)": {
							gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
						},
					}),
				]}
			>
				{posters.map((poster) => (
					<li>
						<PosterCard poster={poster} saved={wish.includes(poster.id)} back={back} />
					</li>
				))}
			</ul>
		);
	};
}

namespace Shelf {
	export interface Props {
		title: RemixNode;
		posters: Poster[];
		wish: string[];
		back: string;
		link?: { href: string; label: string };
		id?: string;
	}
}

/** A titled row of cards that scrolls sideways with snapping, for a home or product page. */
export function Shelf(handle: Handle<Shelf.Props>) {
	return () => {
		let { back, id, link, posters, title, wish } = handle.props;
		if (posters.length === 0) return null;
		let headingId = `${id ?? "shelf"}-title`;
		return (
			<section
				aria-labelledby={headingId}
				mix={[raw({ display: "grid", gap: "1rem", paddingBlock: "clamp(1.5rem, 4vw, 3rem)" })]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "1rem",
						}),
					]}
				>
					<h2
						id={headingId}
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1.25rem, 2.5vw, 1.625rem)",
								fontWeight: "500",
								letterSpacing: "-0.01em",
							}),
						]}
					>
						{title}
					</h2>
					{link === undefined ? null : (
						<a
							href={link.href}
							mix={[raw({ color: "inherit", fontWeight: "500", textUnderlineOffset: "0.2em" })]}
						>
							{link.label}
						</a>
					)}
				</div>
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0 0 0.5rem",
							display: "grid",
							gridAutoFlow: "column",
							gridAutoColumns: "min(14rem, 62vw)",
							gap: "clamp(0.75rem, 2vw, 1.5rem)",
							overflowX: "auto",
							scrollSnapType: "x mandatory",
							scrollPaddingInline: "0",
							overscrollBehaviorInline: "contain",
							"& > li": { scrollSnapAlign: "start" },
							scrollbarWidth: "thin",
						}),
					]}
				>
					{posters.map((poster) => (
						<li>
							<PosterCard poster={poster} saved={wish.includes(poster.id)} back={back} />
						</li>
					))}
				</ul>
			</section>
		);
	};
}

/** The note every payment screen carries: this is a demo and nothing is charged. */
export function DemoNote(handle: Handle<{ children?: RemixNode }>) {
	return () => (
		<p
			role="note"
			mix={[
				raw({
					margin: "0",
					padding: "0.75rem 1rem",
					borderRadius: "var(--ui-radius-md)",
					backgroundColor: "var(--ui-color-brand-50, oklch(0.97 0.015 30))",
					color: "var(--ui-color-brand-800, oklch(0.4 0.12 30))",
					fontSize: "0.875rem",
				}),
			]}
		>
			<strong>Demo store.</strong>{" "}
			{handle.props.children ??
				"Nothing is charged and nothing ships. Never enter real card details here; this checkout never asks for them."}
		</p>
	);
}

/** A thin rule between sections. */
export function Rule() {
	return () => (
		<hr
			mix={[
				raw({ margin: "0", border: "0", borderBlockStart: "1px solid var(--ui-neutral-border)" }),
			]}
		/>
	);
}
