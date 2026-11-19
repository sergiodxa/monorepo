/**
 * A product's pictures: a large stage with a rail of thumbnail links on wide screens, and a
 * swipeable strip with dots on a phone. Each thumbnail is a link to the page showing that
 * picture, so it works without script; the stage zooms under the pointer and opens a Lightbox.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	EntryComponent,
	Handle,
	MixinFactory,
	Props as TagProps,
	RemixNode,
} from "remix/component";

import { ZoomInIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry, createMixin } from "remix/component";

import { Lightbox } from "../components/lightbox.js";

/** The query below which the gallery becomes a swipeable strip. */
const PHONE = "(max-width: 47.99rem)";

/** Where the zoom applies: a fine pointer that hovers, for a reader who allows motion. */
const ZOOM_QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/** How far the stage's picture scales while the pointer is over it. */
const ZOOM_SCALE = 2;

/** Marks a stage whose pointer is already tracked, so a mixin and an island never both listen. */
const TRACKED_ATTRIBUTE = "data-zoom-tracked";

/** Prop types for {@link ProductGallery}. */
export namespace ProductGallery {
	/** One picture. */
	export interface Image {
		/** Names the picture in `current` and keys its thumbnail. */
		id: string;
		/** The picture, such as an `<img>` or an inline SVG. */
		media: RemixNode;
		/** What the picture shows; the thumbnail link and the strip slide are named by it. */
		alt: string;
		/** The page showing this picture, such as `?image=2`. */
		href: string;
	}

	/** The words the controls are named by; `{n}` and `{total}` are filled in. */
	export interface Labels {
		/** The button that opens the Lightbox, such as "Zoom". */
		zoom: string;
		/** A slide's position, such as "Image {n} of {total}". */
		image: string;
	}

	/** Props accepted by {@link ProductGallery}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		images: Image[];
		/** The id of the picture on the stage; the first picture when it matches none. */
		current: string;
		/** The colour behind every picture. */
		background?: string;
		/** Every picture's aspect ratio. @default "4 / 5" */
		ratio?: string;
		/** The id of a root Lightbox dialog the zoom button opens at the current picture. */
		lightbox?: string;
		labels: Labels;
	}

	/** Props {@link ProductGalleryZoom} serializes for hydration. */
	export type ZoomProps = {
		/** The id of the stage whose zoom follows the pointer. */
		stage: string;
	};
}

/**
 * Moves the zoom's origin to the pointer while a mouse is over the stage, so the part under
 * it is what grows. Touch and pen leave the origin centred.
 *
 * @param stage The element carrying {@link zoomOnHover}'s styles.
 * @param signal Detaches the listeners.
 */
function trackZoom(stage: HTMLElement, signal: AbortSignal): void {
	if (stage.hasAttribute(TRACKED_ATTRIBUTE)) return;
	stage.setAttribute(TRACKED_ATTRIBUTE, "");
	signal.addEventListener("abort", () => stage.removeAttribute(TRACKED_ATTRIBUTE));
	stage.addEventListener(
		"pointermove",
		(event) => {
			if (event.pointerType !== "mouse") return;
			let box = stage.getBoundingClientRect();
			let x = ((event.clientX - box.left) / box.width) * 100;
			let y = ((event.clientY - box.top) / box.height) * 100;
			stage.style.setProperty("--ui-zoom-x", `${Math.min(100, Math.max(0, x))}%`);
			stage.style.setProperty("--ui-zoom-y", `${Math.min(100, Math.max(0, y))}%`);
		},
		{ signal },
	);
	stage.addEventListener(
		"pointerleave",
		() => {
			stage.style.removeProperty("--ui-zoom-x");
			stage.style.removeProperty("--ui-zoom-y");
		},
		{ signal },
	);
}

/**
 * Zooms an element's first child to twice its size while a mouse hovers it, growing from
 * the point under the pointer. It applies only where the device hovers with a fine pointer
 * and the reader allows motion, so touch screens and reduced motion keep the plain picture.
 *
 * @example <div mix={[zoomOnHover()]}><img src="/poster.jpg" alt="" /></div>
 */
export const zoomOnHover: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	handle.addEventListener("insert", (event) => trackZoom(event.node, handle.signal));
	return () => (
		<handle.element
			mix={[
				raw({ overflow: "clip" }),
				media(
					ZOOM_QUERY,
					raw({
						cursor: "zoom-in",
						"& > :first-child": {
							transformOrigin: "var(--ui-zoom-x, 50%) var(--ui-zoom-y, 50%)",
							transition: "transform 200ms ease-out",
						},
						"&:hover > :first-child": { transform: `scale(${ZOOM_SCALE})` },
					}),
				),
			]}
		/>
	);
});

/** The style every picture layer shares: fills its frame at the gallery's ratio. */
function frame(ratio: string, background: string | undefined) {
	return raw({
		position: "relative",
		display: "grid",
		aspectRatio: ratio,
		overflow: "clip",
		borderRadius: "var(--ui-radius-md, 0.5rem)",
		backgroundColor: background ?? "var(--ui-neutral-bg-tint)",
		"& > *": { gridArea: "1 / 1" },
		"& img, & svg": {
			display: "block",
			inlineSize: "100%",
			blockSize: "100%",
			objectFit: "cover",
		},
	});
}

/** Replaces each `{name}` in a template with its value. */
function format(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match,
	);
}

/**
 * Renders the gallery. Wide, the stage sits beside a rail of thumbnail links marked
 * `aria-current` at the current picture; on a phone, every picture sits in a scroll-snap strip
 * with a dot per picture, and the rail hides.
 *
 * @example
 * <ProductGallery images={images} current={url.searchParams.get("image") ?? "front"} lightbox="poster-photos" labels={{ zoom: "Zoom", image: "Image {n} of {total}" }} />
 */
export function ProductGallery(handle: Handle<ProductGallery.Props>) {
	return () => {
		let {
			background,
			current,
			id,
			images,
			labels,
			lightbox,
			mix,
			ratio = "4 / 5",
			...rest
		} = handle.props;
		let root = id ?? `${handle.id}-gallery`;
		let stageId = `${root}-stage`;
		let index = Math.max(
			0,
			images.findIndex((image) => image.id === current),
		);
		let shown = images[index];
		let total = images.length;

		return (
			<div
				{...rest}
				id={id}
				data-slot="product-gallery"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridTemplateColumns: "4.5rem minmax(0, 1fr)",
							alignItems: "start",
							gap: "0.75rem",
						}),
						media(PHONE, raw({ display: "block" })),
					],
					mix,
				)}
			>
				<ul
					data-slot="product-gallery-thumbnails"
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
						media(PHONE, raw({ display: "none" })),
					]}
				>
					{images.map((image, position) => (
						<li>
							<a
								href={image.href}
								aria-label={image.alt}
								aria-current={position === index ? "true" : undefined}
								data-slot="product-gallery-thumbnail"
								mix={[
									frame(ratio, background),
									raw({
										borderRadius: "var(--ui-radius-sm, 0.375rem)",
										opacity: "0.72",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
									}),
									when("&:hover", raw({ opacity: "1" })),
									when(
										"&[aria-current='true']",
										raw({
											opacity: "1",
											outline: "2px solid var(--ui-neutral-fg-emphasis)",
											outlineOffset: "2px",
										}),
									),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
								]}
							>
								{image.media}
							</a>
						</li>
					))}
				</ul>
				<div
					data-slot="product-gallery-main"
					mix={[raw({ position: "relative" }), media(PHONE, raw({ display: "none" }))]}
				>
					<div
						id={stageId}
						role="img"
						aria-label={shown?.alt}
						data-slot="product-gallery-stage"
						mix={[frame(ratio, background), zoomOnHover()]}
					>
						<div mix={[raw({ display: "grid", inlineSize: "100%", blockSize: "100%" })]}>
							{shown?.media}
						</div>
					</div>
					<ProductGalleryZoom stage={stageId} />
					{lightbox === undefined ? null : (
						<Lightbox.Trigger
							lightbox={lightbox}
							index={index}
							aria-label={labels.zoom}
							mix={[
								raw({
									position: "absolute",
									insetBlockEnd: "0.75rem",
									insetInlineEnd: "0.75rem",
									display: "inline-grid",
									placeItems: "center",
									inlineSize: "2.75rem",
									blockSize: "2.75rem",
									borderRadius: "999px",
									color: "var(--ui-neutral-fg-emphasis)",
									backgroundColor: "var(--ui-bg-raised, var(--ui-bg, white))",
									boxShadow: "0 0 0 1px var(--ui-neutral-border)",
								}),
							]}
						>
							<ZoomInIcon size={20} aria-hidden="true" />
						</Lightbox.Trigger>
					)}
				</div>
				<div
					data-slot="product-gallery-strip"
					mix={[raw({ display: "none" }), media(PHONE, raw({ display: "grid", gap: "0.625rem" }))]}
				>
					<ul
						data-slot="product-gallery-track"
						mix={[
							raw({
								display: "flex",
								gap: "0.5rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
								overflowX: "auto",
								scrollSnapType: "x mandatory",
								overscrollBehaviorX: "contain",
								scrollbarWidth: "none",
							}),
							when("&::-webkit-scrollbar", raw({ display: "none" })),
						]}
					>
						{images.map((image, position) => (
							<li
								id={`${root}-slide-${position + 1}`}
								role="img"
								aria-label={`${image.alt}, ${format(labels.image, { n: position + 1, total })}`}
								data-slot="product-gallery-slide"
								mix={[
									frame(ratio, background),
									raw({ flex: "0 0 100%", scrollSnapAlign: "center" }),
									position === index ? raw({ scrollInitialTarget: "nearest" } as never) : undefined,
								]}
							>
								{image.media}
							</li>
						))}
					</ul>
					{total < 2 ? null : (
						<div
							aria-hidden="true"
							data-slot="product-gallery-dots"
							mix={[raw({ display: "flex", justifyContent: "center", gap: "0.375rem" })]}
						>
							{images.map((image, position) => (
								<a
									href={`#${root}-slide-${position + 1}`}
									tabIndex={-1}
									data-current={position === index ? "" : undefined}
									title={image.alt}
									mix={[
										raw({
											inlineSize: "0.375rem",
											blockSize: "0.375rem",
											borderRadius: "999px",
											backgroundColor: "var(--ui-neutral-border-strong)",
										}),
										when(
											"&[data-current]",
											raw({ backgroundColor: "var(--ui-neutral-fg-emphasis)" }),
										),
									]}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		);
	};
}

/**
 * Makes a server-rendered stage's zoom follow the pointer. {@link ProductGallery} renders it
 * beside its stage, and it loads from `@sdxc/ui/commerce/product-gallery`.
 */
export const ProductGalleryZoom: EntryComponent<ProductGallery.ZoomProps> = clientEntry(
	"@sdxc/ui/commerce/product-gallery#ProductGalleryZoom",
	function ProductGalleryZoom(handle: Handle<ProductGallery.ZoomProps>) {
		handle.queueTask(() => {
			let stage = document.getElementById(handle.props.stage);
			if (stage === null || handle.signal.aborted) return;
			trackZoom(stage, handle.signal);
		});
		return () => <span hidden data-slot="product-gallery-zoom-live" />;
	},
);
