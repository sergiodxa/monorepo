/**
 * AlbumPage view for the gallery. It renders one album's photo grid with liked counts and
 * a back link, and layers a modal dialog loading the selected photo through a Frame while
 * the grid stays mounted behind it, with arrow buttons and keys moving between photos.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
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
} from "@sdxc/u/layout";
import { bs, is, mbe, p, width } from "@sdxc/u/size";
import { translateY } from "@sdxc/u/transform";
import { Button, LinkButton, Text } from "@sdxc/ui";
import { Frame, navigate, on } from "remix/ui";

import type { Album, Photo } from "../data/types";

import { PhotoGridItem } from "../components/photo-grid-item";
import { Shell } from "../components/shell";
import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/** Names the overlay's frame so a photo navigation targets it and leaves the grid alone. */
const PHOTO_FRAME = "selected-photo";

/**
 * Props for the album detail grid.
 */
export interface AlbumPageProps {
	album: Album;
	photos: Photo[];
	likedPhotoIds: number[];
}

/**
 * Styles an overlay-arrow button pinned to one inline edge of the backdrop,
 * vertically centered, shaped into a circle.
 *
 * @param side Which inline edge the button is pinned to.
 * @returns A `@sdxc/u` mixin array ready for the button's `mix` prop.
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
 * Renders one album and keeps its grid visible behind the photo overlay. The backdrop's
 * blur uses `raw()` to preserve its existing Safari rendering, and opening a photo reloads
 * only the overlay's frame while the address bar moves to that photo's own URL.
 *
 * @param handle Component handle carrying the album and its photos.
 * @returns Album route UI.
 */
export function AlbumPage(handle: Handle<AlbumPageProps>) {
	let albumId = String(handle.props.album.id);
	let selectedPhoto: Photo | undefined;

	/**
	 * Layers one photo over the grid. The overlay's frame has to be mounted before the
	 * navigation targets it by name, since an unknown target falls back to the top frame
	 * and would replace the album with the standalone photo page.
	 *
	 * @param photo Photo to show in the overlay.
	 */
	async function showPhoto(photo: Photo) {
		selectedPhoto = photo;

		await handle.update();
		await navigate(routes.photo.href({ id: String(photo.id) }), { target: PHOTO_FRAME });
	}

	function closePhoto() {
		selectedPhoto = undefined;

		void navigate(routes.album.href({ id: albumId }));
	}

	/** `queueTask` never runs in the server renderer, so `document` is always there below. */
	handle.queueTask(() => {
		document.addEventListener(
			"keydown",
			(event) => {
				if (!selectedPhoto) return;

				let selected = selectedPhoto;
				let photos = handle.props.photos;
				let index = photos.findIndex((photo) => photo.id === selected.id);

				if (event.key === "ArrowLeft") {
					let previous = photos[index - 1];
					if (index > 0 && previous) {
						event.preventDefault();
						void showPhoto(previous);
					}
				} else if (event.key === "ArrowRight") {
					let next = photos[index + 1];
					if (index !== -1 && index < photos.length - 1 && next) {
						event.preventDefault();
						void showPhoto(next);
					}
				}
			},
			{ signal: handle.signal },
		);
	});

	return () => {
		let likedPhotoIds = new Set(handle.props.likedPhotoIds);
		let selected = selectedPhoto;
		let selectedIndex = selected
			? handle.props.photos.findIndex((photo) => photo.id === selected.id)
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
						<PhotoGridItem
							key={photo.id}
							photo={photo}
							liked={likedPhotoIds.has(photo.id)}
							onOpen={showPhoto}
						/>
					))}
				</section>
				{selected ? (
					<div
						role="presentation"
						mix={[
							fixed(),
							inset(0),
							grid(),
							place({ items: "center" }),
							p("1rem"),
							bg("rgb(36 27 22 / 0.62)"),
							boxSizing("border-box"),
							raw({ backdropFilter: "blur(16px)" }),
							on<HTMLDivElement, "click">("click", (event) => {
								if (event.target === event.currentTarget) closePhoto();
							}),
						]}
					>
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
									if (previousPhoto) void showPhoto(previousPhoto);
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
									if (nextPhoto) void showPhoto(nextPhoto);
								}),
							]}
						>
							<ChevronRightIcon />
						</Button>
						<div
							mix={width("min(100%, 56rem)")}
							role="dialog"
							aria-modal="true"
							aria-label={`Photo ${selected.id}`}
						>
							<Frame
								name={PHOTO_FRAME}
								src={routes.photo.href({ id: String(selected.id) })}
								fallback={<Text mix={[block(), p("2rem")]}>Loading photo...</Text>}
							/>
						</div>
					</div>
				) : null}
			</Shell>
		);
	};
}
