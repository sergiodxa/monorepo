/**
 * Live preview island for `AspectRatio`. The box reserves its shape from the `ratio` prop
 * alone and clips whatever it wraps, so a gallery of mixed media keeps its layout from the
 * first paint. Real posters are what make that visible, so the example lays out three
 * tiles at the three ratios a media grid usually mixes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "@sdxc/u/effects";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { fit, is, m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { AspectRatio, Badge } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** Posters drawn as data URIs, so a layout demo fetches nothing to lay out. */
const POSTERS = {
	keynote:
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%236366f1'/%3E%3Cstop offset='1' stop-color='%2306b6d4'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='16' height='9' fill='url(%23g)'/%3E%3C/svg%3E",
	album:
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='1' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23f97316'/%3E%3Cstop offset='1' stop-color='%23db2777'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='8' height='8' fill='url(%23g)'/%3E%3Ccircle cx='4' cy='4' r='1.2' fill='%23ffffff' fill-opacity='0.85'/%3E%3C/svg%3E",
	slide:
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2316a34a'/%3E%3Cstop offset='1' stop-color='%23065f46'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='4' height='3' fill='url(%23g)'/%3E%3C/svg%3E",
};

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 5, align: "start" }), flexWrap()]}>
	<figure mix={[vstack({ gap: 2, align: "stretch" }), is("13rem"), m(0)]}>
		<AspectRatio ratio="16 / 9" mix={[rounded("lg")]}>
			<img
				src={POSTERS.keynote}
				alt="Opening keynote poster"
				mix={[is("100%"), fit("cover")]}
			/>
		</AspectRatio>
		<figcaption mix={[vstack({ gap: 1, align: "start" })]}>
			<span mix={[text("sm"), weight("medium")]}>Opening keynote</span>
			<Badge variant="secondary" color="neutral">16 / 9 · 42 min</Badge>
		</figcaption>
	</figure>

	<figure mix={[vstack({ gap: 2, align: "stretch" }), is("9rem"), m(0)]}>
		<AspectRatio ratio="1 / 1" mix={[rounded("lg")]}>
			<img src={POSTERS.album} alt="Podcast cover art" mix={[is("100%"), fit("cover")]} />
		</AspectRatio>
		<figcaption mix={[vstack({ gap: 1, align: "start" })]}>
			<span mix={[text("sm"), weight("medium")]}>Season 3 cover</span>
			<Badge variant="secondary" color="neutral">1 / 1 · cover art</Badge>
		</figcaption>
	</figure>

	<figure mix={[vstack({ gap: 2, align: "stretch" }), is("11rem"), m(0)]}>
		<AspectRatio ratio={4 / 3} mix={[rounded("lg")]}>
			<img src={POSTERS.slide} alt="Slide deck preview" mix={[is("100%"), fit("cover")]} />
		</AspectRatio>
		<figcaption mix={[vstack({ gap: 1, align: "start" })]}>
			<span mix={[text("sm"), weight("medium")]}>Slide deck</span>
			<Badge variant="secondary" color="neutral">4 / 3 · 24 slides</Badge>
		</figcaption>
	</figure>
</div>`;

/** A media grid whose tiles hold their shape, hydrated the way every preview here loads. */
export const AspectRatioPreview = clientEntry(
	"/resources/components/previews/aspect-ratio.tsx#AspectRatioPreview",
	function AspectRatioPreview() {
		return () => (
			<div mix={[hstack({ gap: 5, align: "start" }), flexWrap()]}>
				<figure mix={[vstack({ gap: 2, align: "stretch" }), is("13rem"), m(0)]}>
					<AspectRatio ratio="16 / 9" mix={[rounded("lg")]}>
						<img
							src={POSTERS.keynote}
							alt="Opening keynote poster"
							mix={[is("100%"), fit("cover")]}
						/>
					</AspectRatio>
					<figcaption mix={[vstack({ gap: 1, align: "start" })]}>
						<span mix={[text("sm"), weight("medium")]}>Opening keynote</span>
						<Badge variant="secondary" color="neutral">
							16 / 9 · 42 min
						</Badge>
					</figcaption>
				</figure>

				<figure mix={[vstack({ gap: 2, align: "stretch" }), is("9rem"), m(0)]}>
					<AspectRatio ratio="1 / 1" mix={[rounded("lg")]}>
						<img src={POSTERS.album} alt="Podcast cover art" mix={[is("100%"), fit("cover")]} />
					</AspectRatio>
					<figcaption mix={[vstack({ gap: 1, align: "start" })]}>
						<span mix={[text("sm"), weight("medium")]}>Season 3 cover</span>
						<Badge variant="secondary" color="neutral">
							1 / 1 · cover art
						</Badge>
					</figcaption>
				</figure>

				<figure mix={[vstack({ gap: 2, align: "stretch" }), is("11rem"), m(0)]}>
					<AspectRatio ratio={4 / 3} mix={[rounded("lg")]}>
						<img src={POSTERS.slide} alt="Slide deck preview" mix={[is("100%"), fit("cover")]} />
					</AspectRatio>
					<figcaption mix={[vstack({ gap: 1, align: "start" })]}>
						<span mix={[text("sm"), weight("medium")]}>Slide deck</span>
						<Badge variant="secondary" color="neutral">
							4 / 3 · 24 slides
						</Badge>
					</figcaption>
				</figure>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <AspectRatioPreview /> };
