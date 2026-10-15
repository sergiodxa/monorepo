/**
 * Live preview island for `SharedElement`. Its identity is its own `id`, matched
 * against the same `id` on the other side of a navigation — which shows nothing on a
 * page that never navigates. So the island moves the element between a grid cell and
 * a detail header and runs the swap inside `document.startViewTransition()`, the same
 * call `viewTransition()` makes for a Frame reload: the cover morphs rather than pops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, SharedElement, Text } from "@sdxc/ui";
import { clientEntry, css, on } from "remix/component";

/** The covers the grid lays out, one of which the detail view opens. */
const COVERS = [
	{ slug: "standards", title: "Built on standards", tint: "brand" },
	{ slug: "results", title: "Results everywhere", tint: "success" },
	{ slug: "schemas", title: "One schema, both ends", tint: "warning" },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SHARED_ELEMENT_CODE = `let openSlug: string | null = null;

/** The same call viewTransition() makes for a Frame reload. */
function open(slug: string | null) {
	openSlug = slug;

	if (typeof document.startViewTransition !== "function") {
		void handle.update();
		return;
	}

	document.startViewTransition(() => handle.update());
}

openCover === undefined ? (
	<div mix={[vstack({ gap: 3, align: "stretch" })]}>
		<Text>Pick a cover.</Text>
		<div mix={[grid(), gridTemplate({ columns: "repeat(3, 1fr)" }), gap(3)]}>
			{covers.map((cover) => (
				<Button
					key={cover.slug}
					variant="ghost"
					mix={[p(0), bs("5rem"), on<HTMLButtonElement, "click">("click", () => open(cover.slug))]}
				>
					<SharedElement
						id={\`preview-cover-\${cover.slug}\`}
						mix={[
							is("100%"),
							bs("100%"),
							rounded("lg"),
							bg(\`\${cover.tint}.tint\`),
							fg(cover.tint),
							p(2),
							text("xs"),
							weight("medium"),
							css({ display: "grid", placeItems: "center", textAlign: "center" }),
						]}
					>
						{cover.title}
					</SharedElement>
				</Button>
			))}
		</div>
	</div>
) : (
	<div mix={[vstack({ gap: 3, align: "stretch" })]}>
		<SharedElement
			id={\`preview-cover-\${openCover.slug}\`}
			mix={[
				is("100%"),
				bs("9rem"),
				rounded("lg"),
				bg(\`\${openCover.tint}.tint\`),
				fg(openCover.tint),
				p(4),
				text("xl"),
				weight("semibold"),
				css({ display: "grid", placeItems: "center", textAlign: "center" }),
			]}
		>
			{openCover.title}
		</SharedElement>
		<Text>The same id on both views, so the browser morphs it instead of swapping it.</Text>
		<div mix={[hstack({ gap: 2, align: "center" })]}>
			<Button
				variant="outline"
				size="sm"
				mix={[on<HTMLButtonElement, "click">("click", () => open(null))]}
			>
				Back to the grid
			</Button>
		</div>
	</div>
)`;

/** A cover that morphs between a grid cell and a detail header, hydrated so it runs. */
export const SharedElementPreview = clientEntry(
	import.meta.url,
	function SharedElementPreview(handle: Handle) {
		let openSlug: string | null = null;

		/** Swaps the two views inside a transition, so the shared id has something to morph. */
		function open(slug: string | null) {
			openSlug = slug;

			if (typeof document.startViewTransition !== "function") {
				void handle.update();
				return;
			}

			document.startViewTransition(() => handle.update());
		}

		return () => {
			let openCover = COVERS.find((cover) => cover.slug === openSlug);

			if (openCover === undefined) {
				return (
					<div mix={[vstack({ gap: 3, align: "stretch" }), is("26rem")]}>
						<Text>Pick a cover.</Text>
						<div mix={[grid(), gridTemplate({ columns: "repeat(3, 1fr)" }), gap(3)]}>
							{COVERS.map((cover) => (
								<Button
									key={cover.slug}
									variant="ghost"
									mix={[
										p(0),
										bs("5rem"),
										on<HTMLButtonElement, "click">("click", () => open(cover.slug)),
									]}
								>
									<SharedElement
										id={`preview-cover-${cover.slug}`}
										mix={[
											is("100%"),
											bs("100%"),
											rounded("lg"),
											bg(`${cover.tint}.tint`),
											fg(cover.tint),
											p(2),
											text("xs"),
											weight("medium"),
											css({ display: "grid", placeItems: "center", textAlign: "center" }),
										]}
									>
										{cover.title}
									</SharedElement>
								</Button>
							))}
						</div>
					</div>
				);
			}

			return (
				<div mix={[vstack({ gap: 3, align: "stretch" }), is("26rem")]}>
					<SharedElement
						id={`preview-cover-${openCover.slug}`}
						mix={[
							is("100%"),
							bs("9rem"),
							rounded("lg"),
							bg(`${openCover.tint}.tint`),
							fg(openCover.tint),
							p(4),
							text("xl"),
							weight("semibold"),
							css({ display: "grid", placeItems: "center", textAlign: "center" }),
						]}
					>
						{openCover.title}
					</SharedElement>
					<Text>The same id on both views, so the browser morphs it instead of swapping it.</Text>
					<div mix={[hstack({ gap: 2, align: "center" })]}>
						<Button
							variant="outline"
							size="sm"
							mix={[on<HTMLButtonElement, "click">("click", () => open(null))]}
						>
							Back to the grid
						</Button>
					</div>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SHARED_ELEMENT_CODE, render: () => <SharedElementPreview /> };
