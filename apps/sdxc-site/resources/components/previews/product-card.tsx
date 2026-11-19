/**
 * Live preview for `ProductCard`: two posters in a shop grid, one on sale with a badge and
 * a wishlist button over its corner, each crossfading to its framed picture on hover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Price } from "@sdxc/ui/commerce/price";
import { ProductCard } from "@sdxc/ui/commerce/product-card";

/** The source the page shows. */
const CODE = `<ProductCard
	href={\`/posters/\${poster.slug}\`}
	title={poster.title}
	subtitle={poster.artist}
	media={<img src={poster.picture} alt="" />}
	hoverMedia={<img src={poster.framed} alt="" />}
	price={<Price amount={poster.price} compareAt={poster.compareAt} currency="USD" size="sm" />}
	badges={poster.onSale ? <Badge>Sale</Badge> : undefined}
	swatches={poster.frames}
	action={<WishlistButton poster={poster} />}
/>`;

/** A poster drawn as a sun over hills, optionally inside a frame. */
function Poster(handle: Handle<{ sky: string; sun: string; framed?: boolean }>) {
	return () => {
		let { framed = false, sky, sun } = handle.props;
		return (
			<svg viewBox="0 0 80 100" aria-hidden="true">
				{framed ? <rect width="80" height="100" fill="#8a6a48" /> : null}
				<rect
					x={framed ? 8 : 0}
					y={framed ? 8 : 0}
					width={framed ? 64 : 80}
					height={framed ? 84 : 100}
					fill={sky}
				/>
				<circle cx="40" cy="44" r="14" fill={sun} />
				<path
					d={framed ? "M8 74 Q30 56 50 70 T72 64 V92 H8 Z" : "M0 74 Q30 54 52 70 T80 62 V100 H0 Z"}
					fill="rgb(0 0 0 / 0.28)"
				/>
			</svg>
		);
	};
}

/** The frames each poster comes in. */
const FRAMES = [
	{ name: "Oak", color: "#b58a5a" },
	{ name: "Black", color: "#1d1d1f" },
	{ name: "White", color: "#f4f2ee" },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(2, minmax(0, 11rem))",
					gap: "1.25rem",
					paddingBlock: "1rem",
				}),
			]}
		>
			<ProductCard
				href="/examples/shop/dusk"
				title="Dune at dusk"
				subtitle="Ana Ortiz"
				media={<Poster sky="oklch(0.78 0.11 55)" sun="oklch(0.93 0.08 90)" />}
				hoverMedia={<Poster framed sky="oklch(0.78 0.11 55)" sun="oklch(0.93 0.08 90)" />}
				mediaBackground="oklch(0.95 0.01 80)"
				price={<Price amount={3600} compareAt={4500} currency="USD" size="sm" />}
				badges={
					<span
						mix={[
							raw({
								paddingInline: "0.5rem",
								borderRadius: "999px",
								fontSize: "0.75rem",
								fontWeight: "650",
								color: "white",
								backgroundColor: "oklch(0.32 0.01 275)",
							}),
						]}
					>
						Sale
					</span>
				}
				swatches={FRAMES}
				action={
					<button
						type="button"
						aria-label="Save Dune at dusk"
						mix={[
							raw({
								display: "inline-grid",
								placeItems: "center",
								inlineSize: "2.25rem",
								blockSize: "2.25rem",
								border: "0",
								borderRadius: "999px",
								backgroundColor: "rgb(255 255 255 / 0.9)",
								cursor: "pointer",
							}),
						]}
					>
						<HeartIcon size={16} aria-hidden="true" />
					</button>
				}
			/>
			<ProductCard
				href="/examples/shop/tide"
				title="Low tide"
				subtitle="Mo Rahman"
				media={<Poster sky="oklch(0.8 0.06 230)" sun="oklch(0.96 0.03 90)" />}
				hoverMedia={<Poster framed sky="oklch(0.8 0.06 230)" sun="oklch(0.96 0.03 90)" />}
				mediaBackground="oklch(0.95 0.01 230)"
				price={<Price amount={2900} from currency="USD" size="sm" />}
				swatches={FRAMES}
			/>
		</div>
	),
};
