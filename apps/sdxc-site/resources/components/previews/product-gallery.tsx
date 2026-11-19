/**
 * Live preview for `ProductGallery`: a poster's three pictures on a stage that zooms under
 * the pointer, with a rail of thumbnail links, and a swipeable strip on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { ProductGallery } from "@sdxc/ui/commerce/product-gallery";

/** The source the page shows. */
const CODE = `<ProductGallery
	images={poster.images.map((image) => ({ id: image.id, alt: image.alt, href: \`?image=\${image.id}\`, media: <img src={image.src} alt="" /> }))}
	current={url.searchParams.get("image") ?? "front"}
	lightbox="poster-photos"
	labels={{ zoom: "Zoom", image: "Image {n} of {total}" }}
/>
<Lightbox id="poster-photos" label="Photos of Dune at dusk" photos={poster.images} />`;

/** One drawn view of the poster: alone, in its frame, or a close detail. */
function View(handle: Handle<{ view: "front" | "framed" | "detail" }>) {
	return () => {
		let { view } = handle.props;
		if (view === "detail") {
			return (
				<svg viewBox="0 0 80 100" aria-hidden="true">
					<rect width="80" height="100" fill="oklch(0.78 0.11 55)" />
					<circle cx="40" cy="60" r="40" fill="oklch(0.93 0.08 90)" />
				</svg>
			);
		}
		let framed = view === "framed";
		return (
			<svg viewBox="0 0 80 100" aria-hidden="true">
				{framed ? <rect width="80" height="100" fill="#8a6a48" /> : null}
				<rect
					x={framed ? 8 : 0}
					y={framed ? 8 : 0}
					width={framed ? 64 : 80}
					height={framed ? 84 : 100}
					fill="oklch(0.78 0.11 55)"
				/>
				<circle cx="40" cy="44" r="14" fill="oklch(0.93 0.08 90)" />
				<path d="M8 74 Q30 56 50 70 T72 64 V92 H8 Z" fill="rgb(0 0 0 / 0.28)" />
			</svg>
		);
	};
}

/** The poster's pictures. */
const IMAGES: ProductGallery.Image[] = (["front", "framed", "detail"] as const).map((view) => ({
	id: view,
	alt: `Dune at dusk, ${view}`,
	href: `/examples/shop/dune?image=${view}`,
	media: <View view={view} />,
}));

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "24rem", paddingBlock: "1rem" })]}>
			<ProductGallery
				images={IMAGES}
				current="front"
				background="oklch(0.95 0.01 80)"
				labels={{ zoom: "Zoom", image: "Image {n} of {total}" }}
			/>
		</div>
	),
};
