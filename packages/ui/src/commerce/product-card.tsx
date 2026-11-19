/**
 * A product in a shop's grid: its picture at a fixed ratio, the title, a subtitle, the price
 * and the colours it comes in. The title's link covers the whole card, so the card is one
 * tab stop, while a control such as a wishlist button sits above it at the picture's corner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** How many colour dots the card draws before it counts the rest as "+N". */
const MAX_SWATCHES = 5;

/** The swatch list's accessible name when `swatchesLabel` is unset. */
const DEFAULT_SWATCHES_LABEL = "Colours";

/** The picture and hover picture fill their layer whatever element the caller passes. */
const MEDIA_FILL = {
	"& > img, & > picture, & > svg": {
		display: "block",
		inlineSize: "100%",
		blockSize: "100%",
		objectFit: "cover",
	},
};

/** Prop types for {@link ProductCard}. */
export namespace ProductCard {
	/** One colour the product comes in. */
	export interface Swatch {
		name: string;
		/** Any CSS colour or gradient. */
		color: string;
	}

	/** Props accepted by {@link ProductCard}; the host is an `<article>`. */
	export interface Props extends Omit<TagProps<"article">, "children" | "title"> {
		/** The product's page; the title links there and the link covers the card. */
		href: string;
		title: RemixNode;
		/** A line under the title, such as the artist or the material. */
		subtitle?: RemixNode;
		media: RemixNode;
		/** A second picture the card crossfades to on hover and focus, such as the poster framed. */
		hoverMedia?: RemixNode;
		/** The colour behind the picture. */
		mediaBackground?: string;
		/** The picture's aspect ratio. @default "4 / 5" */
		ratio?: string;
		/** The price, such as a {@link Price}. */
		price: RemixNode;
		/** Tags over the picture's top-start corner, such as "New" or "Sale". */
		badges?: RemixNode;
		/** The colours the product comes in; five dots show, then "+N". */
		swatches?: Swatch[];
		/** The swatch list's accessible name. @default "Colours" */
		swatchesLabel?: string;
		/** A control over the picture's top-end corner, such as a wishlist form; it stays clickable. */
		action?: RemixNode;
		/** The title's heading level. @default 3 */
		headingLevel?: 2 | 3 | 4;
	}
}

/**
 * Renders the card. The title link's `::after` fills the article, so a click anywhere opens
 * the product, and `badges` and `action` sit on a layer above it to stay reachable.
 *
 * @example
 * <ProductCard href="/posters/dune" title="Dune at dusk" subtitle="Ana Ortiz" media={<img src="/dune.jpg" alt="" />} price={<Price amount={4500} currency="USD" />} swatches={[{ name: "Oak", color: "#b58a5a" }]} />
 */
export function ProductCard(handle: Handle<ProductCard.Props>) {
	return () => {
		let {
			action,
			badges,
			headingLevel = 3,
			hoverMedia,
			href,
			media,
			mediaBackground,
			mix,
			price,
			ratio = "4 / 5",
			subtitle,
			swatches = [],
			swatchesLabel = DEFAULT_SWATCHES_LABEL,
			title,
			...rest
		} = handle.props;
		let shown = swatches.slice(0, MAX_SWATCHES);
		let extra = swatches.length - shown.length;
		let Heading = `h${headingLevel}` as "h3";

		return (
			<article
				{...rest}
				data-slot="product-card"
				mix={mergeMix(
					[
						raw({
							position: "relative",
							display: "grid",
							alignContent: "start",
							gap: "0.75rem",
							minInlineSize: "0",
							"&:hover [data-slot='product-card-hover'], &:focus-within [data-slot='product-card-hover']":
								{ opacity: "1" },
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="product-card-media"
					mix={[
						raw({
							position: "relative",
							aspectRatio: ratio,
							overflow: "clip",
							borderRadius: "var(--ui-radius-md, 0.5rem)",
							backgroundColor: mediaBackground ?? "var(--ui-neutral-bg-tint)",
						}),
					]}
				>
					<div
						data-slot="product-card-image"
						mix={[raw({ position: "absolute", inset: "0", display: "grid", ...MEDIA_FILL })]}
					>
						{media}
					</div>
					{hoverMedia === undefined ? null : (
						<div
							aria-hidden="true"
							data-slot="product-card-hover"
							mix={[
								raw({
									position: "absolute",
									inset: "0",
									display: "grid",
									opacity: "0",
									transition: "opacity 240ms ease",
									backgroundColor: mediaBackground ?? "var(--ui-neutral-bg-tint)",
									...MEDIA_FILL,
								}),
								motionReduce(raw({ transition: "none" })),
							]}
						>
							{hoverMedia}
						</div>
					)}
					{badges === undefined ? null : (
						<div
							data-slot="product-card-badges"
							mix={[
								raw({
									position: "absolute",
									zIndex: "2",
									insetBlockStart: "0.625rem",
									insetInlineStart: "0.625rem",
									display: "flex",
									flexWrap: "wrap",
									gap: "0.375rem",
								}),
							]}
						>
							{badges}
						</div>
					)}
					{action === undefined ? null : (
						<div
							data-slot="product-card-action"
							mix={[
								raw({
									position: "absolute",
									zIndex: "2",
									insetBlockStart: "0.5rem",
									insetInlineEnd: "0.5rem",
								}),
							]}
						>
							{action}
						</div>
					)}
				</div>
				<div mix={[raw({ display: "grid", gap: "0.25rem", minInlineSize: "0" })]}>
					<Heading
						data-slot="product-card-title"
						mix={[
							raw({
								margin: "0",
								fontSize: "0.9375rem",
								fontWeight: "600",
								lineHeight: "1.35",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						<a
							href={href}
							mix={[
								raw({
									color: "inherit",
									textDecoration: "none",
									"&::after": {
										content: '""',
										position: "absolute",
										inset: "0",
										zIndex: "1",
										borderRadius: "var(--ui-radius-md, 0.5rem)",
									},
								}),
								when("&:hover", raw({ textDecoration: "underline", textUnderlineOffset: "0.2em" })),
								when("&:focus-visible", raw({ outline: "none" })),
								when(
									"&:focus-visible::after",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "4px" }),
								),
							]}
						>
							{title}
						</a>
					</Heading>
					{subtitle === undefined ? null : (
						<p
							data-slot="product-card-subtitle"
							mix={[
								raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							{subtitle}
						</p>
					)}
					<div data-slot="product-card-price" mix={[raw({ fontSize: "0.9375rem" })]}>
						{price}
					</div>
					{shown.length === 0 ? null : (
						<ul
							aria-label={swatchesLabel}
							data-slot="product-card-swatches"
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.375rem",
									margin: "0",
									marginBlockStart: "0.25rem",
									padding: "0",
									listStyle: "none",
								}),
							]}
						>
							{shown.map((swatch) => (
								<li
									title={swatch.name}
									data-slot="product-card-swatch"
									style={{ background: swatch.color }}
									mix={[
										raw({
											inlineSize: "0.875rem",
											blockSize: "0.875rem",
											borderRadius: "999px",
											boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.14)",
										}),
									]}
								>
									<span mix={[visuallyHidden()]}>{swatch.name}</span>
								</li>
							))}
							{extra > 0 ? (
								<li
									data-slot="product-card-swatch-more"
									mix={[
										raw({
											fontSize: "0.75rem",
											fontVariantNumeric: "tabular-nums",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{`+${extra}`}
								</li>
							) : null}
						</ul>
					)}
				</div>
			</article>
		);
	};
}
