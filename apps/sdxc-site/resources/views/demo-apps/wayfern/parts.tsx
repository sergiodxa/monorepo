/**
 * The pieces every Wayfern screen shares: a stay's card and photo, the heart that saves it,
 * a person's drawn face, a rating line and a page heading. Each is server-rendered markup whose
 * actions are links and posts, so they work before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { HeartIcon, StarIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { PhotoKind, Stay } from "./data";

import { photoSrc } from "./art";
import { PHOTO_CAPTIONS, actionHref, href, placeOf, typeLabel } from "./data";
import { GUTTER, MEASURE } from "./layout";
import { money } from "./pricing";

namespace HostFace {
	export interface Props {
		name: string;
		/** The two hues the tile blends. */
		hues: [number, number];
		/** The tile's side in rem. Default: `2.5`. */
		size?: number;
	}
}

/**
 * A person's drawn face: a round tile in their two hues carrying their initial, so hosts,
 * reviewers and the traveller are told apart without photos of real people.
 */
export function HostFace(handle: Handle<HostFace.Props>) {
	return () => {
		let { hues, name, size = 2.5 } = handle.props;
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: "0",
						inlineSize: `${size}rem`,
						aspectRatio: "1",
						borderRadius: "999px",
						background: `linear-gradient(145deg, oklch(0.78 0.11 ${hues[0]}), oklch(0.52 0.13 ${hues[1]}))`,
						color: "white",
						fontSize: `${size * 0.42}rem`,
						fontWeight: "650",
						textShadow: "0 1px 1px rgb(0 0 0 / 0.25)",
					}),
				]}
			>
				{name.slice(0, 1)}
			</span>
		);
	};
}

namespace Rating {
	export interface Props {
		rating: number;
		reviews?: number;
		/** Draws the count as "(212)" after the score, as a card does. */
		compact?: boolean;
	}
}

/** A star, the score and the review count, read as one phrase by assistive technology. */
export function Rating(handle: Handle<Rating.Props>) {
	return () => {
		let { compact = false, rating, reviews } = handle.props;
		let label =
			reviews === undefined
				? `Rated ${rating.toFixed(2)} out of 5`
				: `Rated ${rating.toFixed(2)} out of 5 from ${reviews} reviews`;
		return (
			<span
				role="img"
				aria-label={label}
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.25rem",
						whiteSpace: "nowrap",
						fontVariantNumeric: "tabular-nums",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				<StarIcon aria-hidden="true" size={14} mix={[raw({ fill: "currentColor" })]} />
				<span>{rating.toFixed(2)}</span>
				{reviews === undefined ? null : (
					<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
						{compact ? `(${reviews})` : `· ${reviews} reviews`}
					</span>
				)}
			</span>
		);
	};
}

namespace StayPhoto {
	export interface Props {
		stay: Stay;
		kind?: PhotoKind;
		/** The cover above the fold loads at once; every other photo loads as it nears the screen. */
		eager?: boolean;
		/** The photo's description; empty for a photo beside the stay's name. */
		alt?: string;
	}
}

/**
 * One of a stay's drawn photos, filling its box on the stay's own sky colour until it arrives,
 * so a slow connection shows a calm block rather than a hole.
 */
export function StayPhoto(handle: Handle<StayPhoto.Props>) {
	return () => {
		let { alt = "", eager = false, kind = "outside", stay } = handle.props;
		return (
			<img
				src={photoSrc(stay, kind)}
				alt={alt}
				width="600"
				height="400"
				loading={eager ? "eager" : "lazy"}
				decoding="async"
				mix={[
					raw({
						display: "block",
						inlineSize: "100%",
						blockSize: "100%",
						objectFit: "cover",
						backgroundColor: stay.palette.sky,
					}),
				]}
			/>
		);
	};
}

namespace SaveButton {
	export interface Props {
		stay: Stay;
		saved: boolean;
		/** The page path and query the post returns to, so saving never moves the visitor. */
		back: string;
		/** Sits over a photo: white, with a shadow to read on any picture. */
		overlay?: boolean;
	}
}

/**
 * The heart that saves a stay to the visitor's wishlist or takes it off: a post that comes back
 * to the same page with an Undo toast. Its pressed state is the saved state.
 */
export function SaveButton(handle: Handle<SaveButton.Props>) {
	return () => {
		let { back, overlay = false, saved, stay } = handle.props;
		return (
			<form
				method="post"
				action={actionHref(`saved/${stay.id}`)}
				mix={[raw({ display: "contents" })]}
			>
				<input type="hidden" name="on" value={saved ? "false" : "true"} />
				<input type="hidden" name="back" value={back} />
				<button
					type="submit"
					aria-pressed={saved ? "true" : "false"}
					aria-label={
						saved ? `Remove ${stay.name} from your wishlist` : `Save ${stay.name} to your wishlist`
					}
					data-save={stay.id}
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							inlineSize: "2.75rem",
							blockSize: "2.75rem",
							padding: "0",
							border: overlay ? "0" : "1px solid var(--ui-neutral-border)",
							borderRadius: "999px",
							background: overlay ? "transparent" : "var(--ui-bg)",
							color: overlay ? "white" : "var(--ui-neutral-fg-emphasis)",
							cursor: "pointer",
							filter: overlay ? "drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))" : "none",
							transition: "transform 160ms ease",
							"& svg": { fill: overlay ? "rgb(0 0 0 / 0.35)" : "transparent" },
							"&[aria-pressed='true'] svg": {
								fill: "var(--wf-heart)",
								stroke: overlay ? "white" : "var(--wf-heart)",
							},
						}),
						when("&:hover", raw({ transform: "scale(1.08)" })),
						when("&:active", raw({ transform: "scale(0.92)" })),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "0" }),
						),
						motionReduce(raw({ transition: "none", "&:hover": { transform: "none" } })),
					]}
				>
					<HeartIcon aria-hidden="true" size={22} />
				</button>
			</form>
		);
	};
}

namespace StayCard {
	export interface Props {
		stay: Stay;
		/** The query each link carries, so the listing opens priced for the trip being planned. */
		query: string;
		/** Where the card leads instead of the listing, such as a package built on the stay. */
		href?: string;
		saved: boolean;
		/** The page the heart returns to. */
		back: string;
		/** The price line: a nightly price, or the trip's total when dates are picked. */
		price: RemixNode;
		/** A line under the name, such as the dates the stay is free. */
		note?: string;
		eager?: boolean;
		/** Links the card to its map pin on hover and focus. */
		mapKey?: string;
		/** The heading level of the stay's name. Default: `3`. */
		level?: 2 | 3;
	}
}

/**
 * A stay as a grid or list card: the cover photo with the heart, then the place, the rating,
 * the pitch and the price. The whole card is one link; the heart is its own button on top.
 */
export function StayCard(handle: Handle<StayCard.Props>) {
	return () => {
		let { back, eager, level = 3, mapKey, note, price, query, saved, stay } = handle.props;
		let url =
			handle.props.href ?? href(query === "" ? `stay/${stay.id}` : `stay/${stay.id}?${query}`);
		let headingMix = [
			raw({
				margin: "0",
				minInlineSize: "0",
				fontSize: "inherit",
				fontWeight: "650",
				color: "var(--ui-neutral-fg-emphasis)",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			}),
		];
		let nameLink = (
			<a
				href={url}
				data-rmx-prefetch="intent"
				mix={[
					raw({
						color: "inherit",
						textDecoration: "none",
						"&::after": { content: '""', position: "absolute", inset: "0", zIndex: "1" },
					}),
					when(
						"&:focus-visible",
						raw({
							outline: "none",
							"&::after": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "4px",
								borderRadius: "var(--ui-radius-lg)",
							},
						}),
					),
				]}
			>
				{stay.name}
			</a>
		);
		return (
			<article
				data-map-key={mapKey}
				data-stay={stay.id}
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						gap: "0.625rem",
						minInlineSize: "0",
						borderRadius: "var(--ui-radius-lg)",
						"&[data-highlighted] [data-cover]": {
							boxShadow: "0 0 0 3px var(--ui-brand-ring)",
						},
					}),
				]}
			>
				<div
					data-cover=""
					mix={[
						raw({
							position: "relative",
							aspectRatio: "20 / 19",
							overflow: "clip",
							borderRadius: "var(--ui-radius-lg)",
							transition: "box-shadow 140ms ease",
							"& img": { transition: "scale 400ms cubic-bezier(0.2, 0.7, 0.2, 1)" },
						}),
						when(":is(article:hover) > &", raw({ "& img": { scale: "1.035" } })),
						motionReduce(
							raw({
								"& img": { transition: "none" },
								":is(article:hover) > & img": { scale: "1" },
							}),
						),
					]}
				>
					<StayPhoto stay={stay} eager={eager} />
					{stay.favourite === true ? (
						<span
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "0.75rem",
									insetInlineStart: "0.75rem",
									paddingBlock: "0.3125rem",
									paddingInline: "0.625rem",
									borderRadius: "999px",
									backgroundColor: "color-mix(in oklch, white, transparent 6%)",
									color: "oklch(0.25 0.02 150)",
									fontSize: "0.8125rem",
									fontWeight: "650",
									boxShadow: "0 1px 4px rgb(0 0 0 / 0.18)",
								}),
							]}
						>
							Guest favourite
						</span>
					) : null}
				</div>
				<div
					mix={[
						raw({ display: "grid", gap: "0.125rem", fontSize: "0.9375rem", lineHeight: "1.35" }),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								alignItems: "baseline",
								gap: "0.5rem",
							}),
						]}
					>
						{level === 2 ? (
							<h2 mix={headingMix}>{nameLink}</h2>
						) : (
							<h3 mix={headingMix}>{nameLink}</h3>
						)}
						<Rating rating={stay.rating} reviews={stay.reviews} compact />
					</div>
					<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
						{typeLabel(stay.type)} in {placeOf(stay).name}
					</span>
					<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
						{note ??
							`${stay.guests} guests · ${stay.bedrooms} ${stay.bedrooms === 1 ? "bedroom" : "bedrooms"}`}
					</span>
					<span
						mix={[raw({ marginBlockStart: "0.25rem", color: "var(--ui-neutral-fg-emphasis)" })]}
					>
						{price}
					</span>
				</div>
				<div
					mix={[
						raw({
							position: "absolute",
							insetBlockStart: "0.375rem",
							insetInlineEnd: "0.375rem",
							zIndex: "2",
						}),
					]}
				>
					<SaveButton stay={stay} saved={saved} back={back} overlay />
				</div>
			</article>
		);
	};
}

/** A nightly price as a card prints it: the amount bold, "night" quiet. */
export function NightlyPrice(handle: Handle<{ cents: number }>) {
	return () => (
		<>
			<strong mix={[raw({ fontWeight: "650" })]}>{money(handle.props.cents)}</strong> night
		</>
	);
}

/** A trip's price as a card prints it once dates are picked: the total, then the nights. */
export function TotalPrice(handle: Handle<{ total: number; nights: number }>) {
	return () => (
		<>
			<strong mix={[raw({ fontWeight: "650" })]}>{money(handle.props.total)}</strong> total ·{" "}
			<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
				{handle.props.nights} {handle.props.nights === 1 ? "night" : "nights"}
			</span>
		</>
	);
}

/** Wraps a screen's content to the app's measure and gutter. */
export function Page(handle: Handle<{ children: RemixNode; narrow?: boolean }>) {
	return () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: handle.props.narrow === true ? "60rem" : MEASURE,
					marginInline: "auto",
					paddingInline: GUTTER,
					paddingBlockStart: "clamp(1.25rem, 3vw, 2.5rem)",
					boxSizing: "border-box",
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}

/** The caption a photo's kind reads as, for alt text and the viewer. */
export function photoCaption(stay: Stay, kind: PhotoKind): string {
	return `${stay.name}: ${PHOTO_CAPTIONS[kind].toLowerCase()}`;
}

/** A display heading in the brand's serif, for a screen's title. */
export function Title(handle: Handle<{ children: RemixNode; id?: string }>) {
	return () => (
		<h1
			id={handle.props.id}
			mix={[
				raw({
					margin: "0",
					fontFamily: "var(--ui-font-serif)",
					fontSize: "clamp(1.75rem, 1.3rem + 1.6vw, 2.5rem)",
					fontWeight: "600",
					lineHeight: "1.1",
					letterSpacing: "-0.015em",
					color: "var(--ui-neutral-fg-emphasis)",
					textWrap: "balance",
				}),
			]}
		>
			{handle.props.children}
		</h1>
	);
}
