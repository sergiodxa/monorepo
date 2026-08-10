/**
 * AlbumPage view for the gallery. It renders one album's photo grid with liked counts
 * and a back link, and, when a photo is selected, layers a modal dialog that loads the
 * photo through a Frame while keeping the grid behind it, plus prev/next arrows and
 * LeftArrow/RightArrow keys for moving between the album's photos. It exists to present
 * an album and its optional photo overlay as a single cohesive route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ChevronLeftIcon, ChevronRightIcon } from "@pkg/lucide-remix";
import { bg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import {
	absolute,
	block,
	boxSizing,
	fixed,
	gap,
	grid,
	hstack,
	insBs,
	insIe,
	insIs,
	inset,
	place,
} from "@pkg/u/layout";
import { bs, is, mbe, p, width } from "@pkg/u/size";
import { translateY } from "@pkg/u/transform";
import { Button, LinkButton, Text } from "@pkg/ui";
import { RouterProvider } from "@pkg/ui-router";
import { Frame, addEventListeners, on } from "remix/ui";

import type { Album, Photo } from "../data/types";

import { PhotoGridItem } from "../components/photo-grid-item";
import { Shell } from "../components/shell";
import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/**
 * Props for the album detail grid and optional overlay.
 */
export interface AlbumPageProps {
	album: Album;
	photos: Photo[];
	likedPhotoIds: number[];
	selectedPhoto?: Photo;
}

/**
 * Styles an overlay-arrow button pinned to one inline edge of the backdrop,
 * vertically centered, shaped into a circle.
 *
 * @param side Which inline edge the button is pinned to.
 * @returns A `@pkg/u` mixin array ready for the button's `mix` prop.
 */
function overlayArrowMix(side: "start" | "end") {
	return [
		fixed(),
		insBs("50%"),
		translateY("-50%"),
		side === "start" ? insIs("1.5rem") : insIe("1.5rem"),
		is("3rem"),
		bs("3rem"),
		p(0),
		rounded("full"),
	];
}

/**
 * Renders one album and keeps the grid visible behind optional photo overlays.
 *
 * @param handle Component handle carrying album, photos, and optional overlay photo.
 * @returns Album route UI.
 */
export function AlbumPage(handle: Handle<AlbumPageProps>) {
	let router = handle.context.get(RouterProvider);
	let albumId = String(handle.props.album.id);

	function showPhoto(photo: Photo) {
		let albumURL = new URL(routes.album.href({ id: albumId }), window.location.href);
		albumURL.searchParams.set("photoId", String(photo.id));

		void router.navigate(albumURL, { mask: routes.photo.href({ id: String(photo.id) }) });
	}

	function closePhoto() {
		void router.navigate(routes.album.href({ id: albumId }));
	}

	addEventListeners(document, handle.signal, {
		keydown(event) {
			let selectedPhoto = handle.props.selectedPhoto;
			if (!selectedPhoto) return;

			let photos = handle.props.photos;
			let index = photos.findIndex((photo) => photo.id === selectedPhoto.id);

			if (event.key === "ArrowLeft") {
				let previous = photos[index - 1];
				if (index > 0 && previous) {
					event.preventDefault();
					showPhoto(previous);
				}
			} else if (event.key === "ArrowRight") {
				let next = photos[index + 1];
				if (index !== -1 && index < photos.length - 1 && next) {
					event.preventDefault();
					showPhoto(next);
				}
			}
		},
	});

	return () => {
		let likedPhotoIds = new Set(handle.props.likedPhotoIds);
		let selectedPhoto = handle.props.selectedPhoto;
		let selectedIndex = selectedPhoto
			? handle.props.photos.findIndex((photo) => photo.id === selectedPhoto.id)
			: -1;
		let previousPhoto = selectedIndex > 0 ? handle.props.photos[selectedIndex - 1] : undefined;
		let nextPhoto =
			selectedIndex !== -1 && selectedIndex < handle.props.photos.length - 1
				? handle.props.photos[selectedIndex + 1]
				: undefined;

		return (
			<Shell
				eyebrow={`Album ${handle.props.album.id}`}
				title={titleCase(handle.props.album.title)}
				intro="Click a photo to show it over the album while the address bar uses the standalone photo URL."
			>
				<div mix={[hstack({ gap: "1rem", align: "center", justify: "between" }), mbe("1.5rem")]}>
					<LinkButton href={routes.home.href()} color="brand" variant="outline" size="sm">
						Back to albums
					</LinkButton>
					<Text>
						{handle.props.photos.length} photos · {handle.props.likedPhotoIds.length} liked
					</Text>
				</div>
				<section
					mix={[
						grid(),
						gap("0.85rem"),
						raw({ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))" }),
					]}
					aria-label={`Photos in ${handle.props.album.title}`}
				>
					{handle.props.photos.map((photo) => (
						<PhotoGridItem key={photo.id} photo={photo} liked={likedPhotoIds.has(photo.id)} />
					))}
				</section>
				{selectedPhoto ? (
					<div
						role="presentation"
						mix={[
							fixed(),
							inset(0),
							grid(),
							place({ items: "center" }),
							p("1rem"),
							bg("rgb(36 27 22 / 0.62)"),
							// `backdropBlur()` would additionally set `WebkitBackdropFilter`, a
							// vendor-prefixed property this backdrop never had — kept as a raw
							// one-off to avoid introducing a rendering change on Safari.
							boxSizing("border-box"),
							raw({ backdropFilter: "blur(16px)" }),
							on<HTMLDivElement, "click">("click", (event) => {
								if (event.target === event.currentTarget) closePhoto();
							}),
						]}
					>
						{/*
						 * Not `@pkg/ui`'s Dialog: this overlay's open/close state comes from
						 * router navigation (the masked photo URL), not commandfor Invoker
						 * Commands, so a plain backdrop fits without fighting that model.
						 * The white card itself is PhotoPreview's own Card — no extra panel
						 * wraps it, so only one surface reads as "the card".
						 */}
						<Button
							type="button"
							color="neutral"
							variant="solid"
							size="sm"
							mix={[
								absolute(),
								insBs("1.5rem"),
								insIe("1.5rem"),
								on<HTMLButtonElement, "click">("click", closePhoto),
							]}
						>
							Close photo
						</Button>
						<Button
							type="button"
							color="neutral"
							variant="solid"
							aria-label="Previous photo"
							disabled={!previousPhoto}
							mix={[
								overlayArrowMix("start"),
								on<HTMLButtonElement, "click">("click", () => {
									if (previousPhoto) showPhoto(previousPhoto);
								}),
							]}
						>
							<ChevronLeftIcon />
						</Button>
						<Button
							type="button"
							color="neutral"
							variant="solid"
							aria-label="Next photo"
							disabled={!nextPhoto}
							mix={[
								overlayArrowMix("end"),
								on<HTMLButtonElement, "click">("click", () => {
									if (nextPhoto) showPhoto(nextPhoto);
								}),
							]}
						>
							<ChevronRightIcon />
						</Button>
						<div
							mix={width("min(100%, 56rem)")}
							role="dialog"
							aria-modal="true"
							aria-label={`Photo ${selectedPhoto.id}`}
						>
							<Frame
								name="selected-photo"
								src={routes.photo.href({ id: String(selectedPhoto.id) })}
								fallback={<Text mix={[block(), p("2rem")]}>Loading photo...</Text>}
							/>
						</div>
					</div>
				) : null}
			</Shell>
		);
	};
}
