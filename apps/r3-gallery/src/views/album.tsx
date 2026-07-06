/**
 * AlbumPage view for the gallery. It renders one album's photo grid with liked counts
 * and a back link, and, when a photo is selected, layers a modal dialog that loads the
 * photo through a Frame while keeping the grid behind it. It exists to present an album
 * and its optional photo overlay as a single cohesive route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { RouterProvider } from "@pkg/r3-ui-router";
import { Frame, css, on } from "remix/ui";

import type { Album, Photo } from "../data/types";

import { ActionLink } from "../components/action-link";
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
 * Renders one album and keeps the grid visible behind optional photo overlays.
 *
 * @param handle Component handle carrying album, photos, and optional overlay photo.
 * @returns Album route UI.
 */
export function AlbumPage(handle: Handle<AlbumPageProps>) {
	let router = handle.context.get(RouterProvider);
	let albumId = String(handle.props.album.id);

	return () => {
		let likedPhotoIds = new Set(handle.props.likedPhotoIds);

		return (
			<Shell
				eyebrow={`Album ${handle.props.album.id}`}
				title={titleCase(handle.props.album.title)}
				intro="Click a photo to show it over the album while the address bar uses the standalone photo URL."
			>
				<div
					mix={css({
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "1rem",
						marginBlockEnd: "1.5rem",
					})}
				>
					<ActionLink href={routes.home.href()} variant="compact">
						Back to albums
					</ActionLink>
					<span>
						{handle.props.photos.length} photos · {handle.props.likedPhotoIds.length} liked
					</span>
				</div>
				<section
					mix={css({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))",
						gap: "0.85rem",
					})}
					aria-label={`Photos in ${handle.props.album.title}`}
				>
					{handle.props.photos.map((photo) => (
						<PhotoGridItem key={photo.id} photo={photo} liked={likedPhotoIds.has(photo.id)} />
					))}
				</section>
				{handle.props.selectedPhoto ? (
					<div
						role="presentation"
						mix={[
							css({
								position: "fixed",
								inset: 0,
								display: "grid",
								boxSizing: "border-box",
								placeItems: "center",
								padding: "1rem",
								background: "rgb(36 27 22 / 0.62)",
								backdropFilter: "blur(16px)",
							}),
							on<HTMLDivElement, "click">("click", (event) => {
								if (event.target === event.currentTarget) {
									void router.navigate(routes.album.href({ id: albumId }));
								}
							}),
						]}
					>
						<div
							mix={css({
								display: "block",
								overflow: "auto",
								width: "min(100%, 62rem)",
								maxHeight: "min(90vh, 44rem)",
								borderRadius: "1.75rem",
								background: "#fff7ed",
								boxShadow: "0 2rem 8rem rgb(0 0 0 / 0.28)",
							})}
							role="dialog"
							aria-modal="true"
							aria-label={`Photo ${handle.props.selectedPhoto.id}`}
						>
							<Frame
								name="selected-photo"
								src={routes.photo.href({ id: String(handle.props.selectedPhoto.id) })}
								fallback={<div mix={css({ padding: "2rem" })}>Loading photo...</div>}
							/>
							<button
								type="button"
								mix={[
									css({
										position: "absolute",
										top: "1rem",
										right: "1rem",
										display: "inline-flex",
										minHeight: "2.5rem",
										alignItems: "center",
										justifyContent: "center",
										padding: "0.6rem 0.9rem",
										border: "1px solid rgb(154 52 18 / 0.18)",
										borderRadius: "999rem",
										background: "rgb(255 255 255 / 0.82)",
										color: "#7c2d12",
										cursor: "pointer",
										font: "inherit",
										fontWeight: 800,
										"&:focus-visible": {
											outline: "3px solid #f97316",
											outlineOffset: "4px",
										},
									}),
									on<HTMLButtonElement, "click">("click", () => {
										void router.navigate(routes.album.href({ id: albumId }));
									}),
								]}
							>
								Close photo
							</button>
						</div>
					</div>
				) : null}
			</Shell>
		);
	};
}
