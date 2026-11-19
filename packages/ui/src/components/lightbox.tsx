/**
 * A full-screen photo viewer for a gallery, as a native `<dialog>` a trigger opens through
 * Invoker Commands. Every photo sits in a scroll-snap track with its own address, so swiping
 * and the step links work without script; a small island adds arrow keys and opening at a photo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { outline } from "@sdxc/u/color";
import { raw, mergeMix } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at, motionReduce, motionSafe, startingStyle } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { tabularNums } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { lightboxControls } from "../mixins/lightbox-controls.js";

/** Container the viewer names, so its step buttons move beside the photo once there is room. */
const CONTAINER_NAME = "ui-lightbox";

/** Width from which the step buttons sit in their own gutters instead of over the photo. */
const GUTTER_WIDTH = "48rem";

/** Words the controls are named by when `labels` leaves them out. */
const DEFAULT_LABELS: Lightbox.Labels = {
	close: "Close",
	previous: "Previous photo",
	next: "Next photo",
};

/** The round, 44px control shared by the close button and the step links. */
const CONTROL_STYLES = raw({
	display: "inline-grid",
	placeItems: "center",
	inlineSize: "2.75rem",
	blockSize: "2.75rem",
	padding: 0,
	border: 0,
	borderRadius: "999px",
	background: "rgb(0 0 0 / 0.55)",
	color: "white",
	cursor: "pointer",
	textDecoration: "none",
	zIndex: 1,
});

/**
 * Prop types for {@link Lightbox} and its compound parts.
 */
export namespace Lightbox {
	/** One photo in the gallery. */
	export interface Photo {
		/** The image's address; leave it out to draw the photo with `art` instead. */
		src?: string;
		/** Candidate sources, as the native `srcset`. */
		srcset?: string;
		/** What the photo shows, for a reader who cannot see it. */
		alt: string;
		/** A line under the photo, such as the room it shows. */
		caption?: RemixNode;
		/**
		 * Drawn content standing in for `src`, such as an inline SVG with a `viewBox`; it is
		 * scaled to fit the viewer as an image would be.
		 */
		art?: RemixNode;
	}

	/** The words each control is named by. */
	export interface Labels {
		/** @default "Close" */
		close: string;
		/** @default "Previous photo" */
		previous: string;
		/** @default "Next photo" */
		next: string;
	}

	/** Every native `<dialog>` attribute, plus the gallery. */
	export interface Props extends Omit<TagProps<"dialog">, "children" | "open"> {
		/** Targeted by each trigger's `commandfor`, and the prefix of every photo's own id. */
		id: string;
		/** The gallery's name, such as "Photos of Fern Cabin", read when the viewer opens. */
		label: string;
		photos: Photo[];
		/**
		 * Renders the viewer already open at this zero-based photo, for a page whose address
		 * names one (`?photo=3`). Without script it is a non-modal dialog covering the page;
		 * the island reopens it as a modal.
		 */
		initial?: number;
		labels?: Partial<Labels>;
	}

	/** Every native `<button>` attribute, plus the viewer and photo it opens. */
	export interface TriggerProps extends Omit<TagProps<"button">, "commandfor" | "command"> {
		/** `id` of the {@link Lightbox} this opens. */
		lightbox: string;
		/**
		 * Zero-based photo the viewer opens at once the island has loaded.
		 *
		 * @default 0
		 */
		index?: number;
	}
}

/** The id of photo `index`, one-based so it reads like the counter (`photos-photo-3`). */
function slideId(id: string, index: number): string {
	return `${id}-photo-${index + 1}`;
}

/**
 * Loads the viewer's script: the hidden host whose mixin wires the arrow keys, the
 * index-aware triggers and the live region. It loads from `@sdxc/ui/lightbox`, which the
 * app's browser entry maps; {@link Lightbox} renders it, so a page never places it itself.
 */
export const LightboxControls: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/lightbox#LightboxControls",
	function LightboxControls() {
		return () => <span hidden mix={[lightboxControls()]} />;
	},
);

/**
 * Renders the viewer: a full-screen dark `<dialog>` with a close button, one slide per photo
 * (contained, with "n / N" and its caption) and step links between neighbours. Opened from a
 * {@link Lightbox.Trigger}; Escape and the close button dismiss it.
 *
 * @param handle Runtime handle carrying the dialog's props.
 * @returns The render function producing the viewer's markup.
 * @example
 * <Lightbox.Trigger lightbox="cabin-photos" index={2}><img src={thumb} alt="" /></Lightbox.Trigger>
 * <Lightbox id="cabin-photos" label="Photos of Fern Cabin" photos={photos} />
 * @example
 * <Lightbox id="cabin-photos" label="Photos" photos={photos} initial={Number(url.searchParams.get("photo")) - 1} />
 */
export function Lightbox(handle: Handle<Lightbox.Props>) {
	return () => {
		let { id, label, photos, initial, labels, mix, ...rest } = handle.props;
		let words = { ...DEFAULT_LABELS, ...labels };
		let total = photos.length;
		let start = initial === undefined ? undefined : Math.max(0, Math.min(total - 1, initial));

		return (
			<dialog
				{...rest}
				id={id}
				aria-label={label}
				open={start !== undefined}
				data-lightbox-initial={start === undefined ? undefined : String(start)}
				data-slot="lightbox"
				mix={mergeMix(
					[
						raw({
							position: "fixed",
							inset: 0,
							inlineSize: "auto",
							blockSize: "auto",
							maxInlineSize: "none",
							maxBlockSize: "none",
							margin: 0,
							padding: 0,
							border: 0,
							overflow: "hidden",
							background: "rgb(12 12 14)",
							color: "white",
							colorScheme: "dark",
							zIndex: 50,
							opacity: 1,
						}),
						container(CONTAINER_NAME, "inline-size"),
						when("&[open]", raw({ display: "block" })),
						when("&::backdrop", raw({ background: "rgb(0 0 0 / 0.9)" })),
						motionSafe([
							raw({
								transition:
									"opacity 160ms ease-out, display 160ms allow-discrete, overlay 160ms allow-discrete",
							}),
							startingStyle(when("&[open]", raw({ opacity: 0 }))),
						]),
					],
					mix,
				)}
			>
				<LightboxControls />
				<button
					type="button"
					commandfor={id}
					command="close"
					aria-label={words.close}
					data-slot="lightbox-close"
					mix={[
						CONTROL_STYLES,
						raw({ position: "absolute", insetBlockStart: "0.75rem", insetInlineEnd: "0.75rem" }),
						when("&:focus-visible", outline({ color: "white", offset: 2, width: 2 })),
					]}
				>
					<XIcon size={20} />
				</button>
				<p role="status" data-lightbox-status="" mix={[visuallyHidden()]} />
				<div
					data-lightbox-track=""
					data-slot="lightbox-track"
					mix={[
						raw({
							display: "flex",
							blockSize: "100%",
							overflowX: "auto",
							overflowY: "hidden",
							scrollSnapType: "x mandatory",
							overscrollBehaviorX: "contain",
							scrollbarWidth: "none",
						}),
						when("&::-webkit-scrollbar", raw({ display: "none" })),
						motionSafe(raw({ scrollBehavior: "smooth" })),
						motionReduce(raw({ scrollBehavior: "auto" })),
					]}
				>
					{photos.map((photo, index) => (
						<LightboxSlide
							viewer={id}
							photo={photo}
							index={index}
							total={total}
							initial={index === start}
							labels={words}
						/>
					))}
				</div>
			</dialog>
		);
	};
}

/** Props {@link LightboxSlide} reads. */
interface LightboxSlideProps {
	viewer: string;
	photo: Lightbox.Photo;
	index: number;
	total: number;
	/** Whether the server opened the viewer here, which snaps the track to it on first paint. */
	initial: boolean;
	labels: Lightbox.Labels;
}

/**
 * One photo filling the track: the picture contained in the space above its counter and
 * caption, with a link to each neighbour that addresses it by id, so the track scrolls there
 * with or without script. The first photo has no previous link and the last no next.
 *
 * @param handle Runtime handle carrying the slide's photo and position.
 * @returns The render function producing the slide's markup.
 */
function LightboxSlide(handle: Handle<LightboxSlideProps>) {
	return () => {
		let { viewer, photo, index, total, initial, labels } = handle.props;
		let hasPrevious = index > 0;
		let hasNext = index < total - 1;

		return (
			<figure
				id={slideId(viewer, index)}
				data-lightbox-slide=""
				data-slot="lightbox-slide"
				mix={[
					raw({
						position: "relative",
						flex: "0 0 100%",
						display: "grid",
						gridTemplateRows: "minmax(0, 1fr) auto",
						gap: "0.75rem",
						margin: 0,
						paddingBlock: "4rem 1rem",
						scrollSnapAlign: "center",
						minInlineSize: 0,
					}),
					initial ? raw({ scrollInitialTarget: "nearest" } as never) : undefined,
					at(GUTTER_WIDTH, CONTAINER_NAME, raw({ paddingInline: "4.5rem" })),
				]}
			>
				{photo.art === undefined ? (
					<img
						src={photo.src}
						srcset={photo.srcset}
						alt={photo.alt}
						loading={initial ? "eager" : "lazy"}
						decoding="async"
						mix={[
							raw({
								display: "block",
								inlineSize: "100%",
								blockSize: "100%",
								minBlockSize: 0,
								objectFit: "contain",
							}),
						]}
					/>
				) : (
					<div
						role="img"
						aria-label={photo.alt}
						data-slot="lightbox-art"
						mix={[
							raw({
								display: "grid",
								placeItems: "center",
								minBlockSize: 0,
								overflow: "hidden",
							}),
							when("& > svg", raw({ inlineSize: "100%", blockSize: "100%" })),
						]}
					>
						{photo.art}
					</div>
				)}
				<figcaption
					mix={[
						raw({
							display: "flex",
							gap: "0.75rem",
							alignItems: "baseline",
							justifyContent: "center",
							flexWrap: "wrap",
							paddingInline: "1rem",
							fontSize: "0.875rem",
							lineHeight: 1.4,
							textAlign: "center",
							color: "rgb(255 255 255 / 0.86)",
						}),
					]}
				>
					<span
						data-lightbox-announce=""
						data-slot="lightbox-counter"
						mix={[tabularNums(), raw({ color: "rgb(255 255 255 / 0.6)" })]}
					>
						{`${index + 1} / ${total}`}
					</span>
					{photo.caption === undefined ? null : (
						<span data-lightbox-announce="" data-slot="lightbox-caption">
							{photo.caption}
						</span>
					)}
				</figcaption>
				{hasPrevious ? (
					<LightboxStep
						href={`#${slideId(viewer, index - 1)}`}
						to={index - 1}
						label={labels.previous}
						side="start"
					/>
				) : null}
				{hasNext ? (
					<LightboxStep
						href={`#${slideId(viewer, index + 1)}`}
						to={index + 1}
						label={labels.next}
						side="end"
					/>
				) : null}
			</figure>
		);
	};
}

/** Props {@link LightboxStep} reads. */
interface LightboxStepProps {
	href: string;
	to: number;
	label: string;
	side: "start" | "end";
}

/**
 * A round link to a neighbouring photo, centred on the slide's edge: over the photo on a
 * phone, in the slide's own gutter once the viewer is wide. The chevron mirrors under RTL.
 *
 * @param handle Runtime handle carrying the link's target and side.
 * @returns The render function producing the link's markup.
 */
function LightboxStep(handle: Handle<LightboxStepProps>) {
	return () => {
		let { href, to, label, side } = handle.props;

		return (
			<a
				href={href}
				aria-label={label}
				data-lightbox-to={String(to)}
				data-slot={side === "start" ? "lightbox-previous" : "lightbox-next"}
				mix={[
					CONTROL_STYLES,
					raw({
						position: "absolute",
						insetBlockStart: "50%",
						translate: "0 -50%",
						[side === "start" ? "insetInlineStart" : "insetInlineEnd"]: "0.5rem",
					}),
					when(":dir(rtl) > &", raw({ scale: "-1 1" })),
					when("&:focus-visible", outline({ color: "white", offset: 2, width: 2 })),
				]}
			>
				{side === "start" ? <ChevronLeftIcon size={22} /> : <ChevronRightIcon size={22} />}
			</a>
		);
	};
}

/**
 * Renders a button that opens the viewer named by `lightbox` as a modal, at photo `index`
 * once the island has loaded. It is unstyled apart from a focus ring, so a thumbnail or a
 * "Show all photos" label inside it sets its look.
 *
 * @param handle Runtime handle carrying the button's props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <Lightbox.Trigger lightbox="cabin-photos" index={3} aria-label="Open photo 4"><img src={thumb} alt="" /></Lightbox.Trigger>
 */
Lightbox.Trigger = function LightboxTrigger(handle: Handle<Lightbox.TriggerProps>) {
	return () => {
		let { lightbox, index, mix, ...rest } = handle.props;

		return (
			<button
				type="button"
				{...rest}
				commandfor={lightbox}
				command="show-modal"
				data-lightbox-index={String(index ?? 0)}
				data-slot="lightbox-trigger"
				mix={mergeMix(
					[
						raw({
							display: "block",
							padding: 0,
							border: 0,
							background: "none",
							color: "inherit",
							font: "inherit",
							textAlign: "inherit",
							cursor: "zoom-in",
						}),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2, width: 2 })),
					],
					mix,
				)}
			/>
		);
	};
};
