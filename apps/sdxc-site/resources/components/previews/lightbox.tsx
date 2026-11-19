/**
 * Live preview for `Lightbox`: a cabin stay's photo grid where each tile opens the viewer at
 * its own photo and a button opens it at the first. The photos are drawn scenes, so the
 * preview fetches nothing; arrow keys, swipes and the step links move between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Lightbox } from "@sdxc/ui/lightbox";

/** The source the page shows, matching the markup below apart from the drawn photos. */
const CODE = `<div>
	{photos.map((photo, index) => (
		<Lightbox.Trigger lightbox="fern-cabin" index={index} aria-label={\`Open photo \${index + 1}\`}>
			<img src={photo.thumb} alt="" />
		</Lightbox.Trigger>
	))}
	<Lightbox.Trigger lightbox="fern-cabin">Show all photos</Lightbox.Trigger>
</div>
<Lightbox
	id="fern-cabin"
	label="Photos of Fern Cabin"
	photos={photos.map((photo) => ({ src: photo.src, alt: photo.alt, caption: photo.caption }))}
/>`;

/** Which drawn scene a photo shows. */
type Scene = "dusk" | "stove" | "loft" | "dock" | "trail";

/** The stay's photos, in the order the viewer pages through them. */
const PHOTOS: Array<{ scene: Scene; alt: string; caption: string }> = [
	{ scene: "dusk", alt: "A cedar cabin under pines at dusk", caption: "Fern Cabin at dusk" },
	{ scene: "stove", alt: "A wood stove beside a reading chair", caption: "Living room" },
	{ scene: "loft", alt: "A loft bed under a round window", caption: "Sleeping loft" },
	{ scene: "dock", alt: "A wooden dock reaching into a still lake", caption: "Private dock" },
	{ scene: "trail", alt: "A trail between ferns into the woods", caption: "Trail to the falls" },
];

/** Props {@link CabinPhoto} reads. */
interface CabinPhotoProps {
	scene: Scene;
}

/**
 * One of the stay's photos as flat shapes in a 4:3 frame. It uses no gradient ids, so the
 * same scene drawn as a thumbnail and in the viewer never collides.
 *
 * @param handle Runtime handle carrying which scene to draw.
 * @returns The render function producing the scene's SVG.
 */
function CabinPhoto(handle: Handle<CabinPhotoProps>) {
	return () => {
		let { scene } = handle.props;

		if (scene === "dusk")
			return (
				<svg viewBox="0 0 400 300" aria-hidden="true">
					<rect width="400" height="300" fill="#2b2f5a" />
					<rect y="150" width="400" height="150" fill="#3d4a6b" />
					<circle cx="300" cy="80" r="26" fill="#f6d28b" />
					<path d="M0 210 L60 120 L120 210 Z M300 220 L350 110 L400 220 Z" fill="#1f3b33" />
					<path d="M130 230 L200 160 L270 230 Z" fill="#6b3f2a" />
					<rect x="145" y="228" width="110" height="52" fill="#8a5636" />
					<rect x="170" y="244" width="22" height="18" fill="#ffd27a" />
					<rect x="210" y="244" width="22" height="18" fill="#ffd27a" />
					<rect y="278" width="400" height="22" fill="#24313a" />
				</svg>
			);
		if (scene === "stove")
			return (
				<svg viewBox="0 0 400 300" aria-hidden="true">
					<rect width="400" height="300" fill="#d9c4a6" />
					<rect y="220" width="400" height="80" fill="#8b6a4b" />
					<rect x="90" y="40" width="20" height="120" fill="#2e2e33" />
					<rect x="60" y="150" width="80" height="80" rx="6" fill="#2e2e33" />
					<rect x="76" y="172" width="48" height="34" rx="4" fill="#f08a3c" />
					<rect x="230" y="150" width="110" height="70" rx="14" fill="#5d7a6e" />
					<rect x="230" y="120" width="30" height="100" rx="12" fill="#4f6a5f" />
					<rect x="300" y="60" width="60" height="44" fill="#f4ead9" />
				</svg>
			);
		if (scene === "loft")
			return (
				<svg viewBox="0 0 400 300" aria-hidden="true">
					<rect width="400" height="300" fill="#c9a77e" />
					<path d="M0 0 L200 0 L0 140 Z M400 0 L200 0 L400 140 Z" fill="#a9845c" />
					<circle cx="200" cy="90" r="40" fill="#9fc7e8" />
					<circle cx="200" cy="90" r="40" fill="none" stroke="#6b4b2f" stroke-width="8" />
					<rect x="70" y="190" width="260" height="50" rx="10" fill="#f2efe8" />
					<rect x="80" y="176" width="70" height="28" rx="10" fill="#ffffff" />
					<rect x="150" y="196" width="180" height="44" rx="8" fill="#b4483c" />
					<rect y="240" width="400" height="60" fill="#7a5a3c" />
				</svg>
			);
		if (scene === "dock")
			return (
				<svg viewBox="0 0 400 300" aria-hidden="true">
					<rect width="400" height="300" fill="#bfe0ef" />
					<path d="M0 140 L90 90 L180 130 L280 80 L400 130 L400 160 L0 160 Z" fill="#4c7a68" />
					<rect y="160" width="400" height="140" fill="#5c9fbf" />
					<path d="M170 300 L230 300 L215 170 L185 170 Z" fill="#9b7350" />
					<rect x="183" y="168" width="34" height="6" fill="#7d5a3c" />
					<rect x="60" y="200" width="70" height="3" fill="#e8f4fa" />
					<rect x="270" y="230" width="90" height="3" fill="#e8f4fa" />
				</svg>
			);
		return (
			<svg viewBox="0 0 400 300" aria-hidden="true">
				<rect width="400" height="300" fill="#2f4d3a" />
				<rect x="40" width="34" height="300" fill="#4a3426" />
				<rect x="310" width="40" height="300" fill="#4a3426" />
				<path d="M150 300 L250 300 L215 120 L190 120 Z" fill="#b89a6c" />
				<path
					d="M0 300 L0 210 L80 250 L150 300 Z M400 300 L400 200 L320 250 L250 300 Z"
					fill="#6aa35a"
				/>
				<circle cx="202" cy="100" r="30" fill="#e7f0c8" />
			</svg>
		);
	};
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "grid",
					gap: "0.75rem",
					inlineSize: "100%",
					maxInlineSize: "36rem",
					paddingBlock: "1.5rem",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "2fr 1fr 1fr",
						gridTemplateRows: "repeat(2, minmax(0, 1fr))",
						gap: "0.375rem",
						aspectRatio: "2 / 1",
						borderRadius: "0.75rem",
						overflow: "hidden",
					}),
				]}
			>
				{PHOTOS.map((photo, index) => (
					<Lightbox.Trigger
						lightbox="fern-cabin"
						index={index}
						aria-label={`Open photo ${index + 1}: ${photo.caption}`}
						mix={[
							raw({ minBlockSize: 0, overflow: "hidden" }),
							index === 0 ? raw({ gridRow: "span 2" }) : undefined,
							when("& > svg", raw({ display: "block", inlineSize: "100%", blockSize: "100%" })),
						]}
					>
						<CabinPhoto scene={photo.scene} />
					</Lightbox.Trigger>
				))}
			</div>
			<Lightbox.Trigger
				lightbox="fern-cabin"
				mix={[
					raw({
						justifySelf: "end",
						paddingBlock: "0.5rem",
						paddingInline: "0.875rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.5rem",
						fontSize: "0.875rem",
						cursor: "pointer",
					}),
				]}
			>
				Show all 5 photos
			</Lightbox.Trigger>
			<Lightbox
				id="fern-cabin"
				label="Photos of Fern Cabin"
				photos={PHOTOS.map((photo) => ({
					alt: photo.alt,
					caption: photo.caption,
					art: <CabinPhoto scene={photo.scene} />,
				}))}
			/>
		</div>
	),
};
