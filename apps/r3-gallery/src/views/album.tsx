import type { Handle } from "remix/ui";

import { RouterProvider } from "@pkg/r3-ui-router";
import { css, on } from "remix/ui";

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
						<section
							mix={css({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1.15fr) minmax(17rem, 0.85fr)",
								overflow: "hidden",
								width: "min(100%, 62rem)",
								maxHeight: "min(90vh, 44rem)",
								borderRadius: "1.75rem",
								background: "#fff7ed",
								boxShadow: "0 2rem 8rem rgb(0 0 0 / 0.28)",
								"@media (max-width: 760px)": {
									gridTemplateColumns: "1fr",
									overflow: "auto",
								},
							})}
							role="dialog"
							aria-modal="true"
							aria-labelledby={`photo-${handle.props.selectedPhoto.id}-title`}
						>
							<img
								mix={css({ display: "block", width: "100%", height: "auto" })}
								src={handle.props.selectedPhoto.url}
								alt={handle.props.selectedPhoto.title}
							/>
							<div
								mix={css({
									display: "grid",
									boxSizing: "border-box",
									alignContent: "space-between",
									gap: "1.5rem",
									padding: "clamp(1rem, 3vw, 2rem)",
								})}
							>
								<div>
									<p
										mix={css({
											margin: 0,
											color: "#9a3412",
											fontSize: "0.78rem",
											fontWeight: 800,
											letterSpacing: "0.18em",
											textTransform: "uppercase",
										})}
									>
										Photo {handle.props.selectedPhoto.id}
									</p>
									<h2
										mix={css({
											margin: 0,
											fontFamily: 'Georgia, "Times New Roman", serif',
											fontSize: "clamp(2rem, 5vw, 4rem)",
											fontWeight: 500,
											letterSpacing: "-0.06em",
											lineHeight: 0.95,
										})}
										id={`photo-${handle.props.selectedPhoto.id}-title`}
									>
										{titleCase(handle.props.selectedPhoto.title)}
									</h2>
								</div>
								<button
									type="button"
									mix={[
										css({
											display: "inline-flex",
											minHeight: "2.75rem",
											alignItems: "center",
											justifyContent: "center",
											padding: "0.7rem 1rem",
											border: "1px solid rgb(154 52 18 / 0.18)",
											borderRadius: "999rem",
											background: "rgb(255 255 255 / 0.74)",
											color: "#7c2d12",
											font: "inherit",
											fontWeight: 800,
											textDecoration: "none",
											cursor: "pointer",
											WebkitTapHighlightColor: "transparent",
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
						</section>
					</div>
				) : null}
			</Shell>
		);
	};
}
