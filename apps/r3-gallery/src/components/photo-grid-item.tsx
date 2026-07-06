/**
 * PhotoGridItem component for album grids. It renders a photo thumbnail that opens as
 * a masked modal route while preserving the album URL, plus a like form wired to a
 * router fetcher that toggles and reflects liked state optimistically. It exists to
 * make each grid cell an interactive, likeable, deep-linkable photo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { RouterProvider } from "@pkg/r3-ui-router";
import { addEventListeners, css, on } from "remix/ui";

import type { Photo } from "../data/types";
import type { LikeToggleResult } from "../middleware/likes";

import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/**
 * Props for a photo grid item that opens with a masked URL.
 */
export interface PhotoGridItemProps {
	liked: boolean;
	photo: Photo;
}

/**
 * Renders a photo thumbnail link with album-preserving masked navigation.
 *
 * @param handle Component handle carrying one photo.
 * @returns A photo grid link that opens as a modal route.
 */
export function PhotoGridItem(handle: Handle<PhotoGridItemProps>) {
	let router = handle.context.get(RouterProvider);
	let fetcher = router.getFetcher<LikeToggleResult>(`photo-like:${handle.props.photo.id}`);

	addEventListeners(fetcher, handle.signal, {
		change() {
			handle.update();
		},
	});

	return () => {
		let liked =
			fetcher.data?.photoId === handle.props.photo.id ? fetcher.data.liked : handle.props.liked;

		return (
			<article
				mix={css({
					display: "grid",
					overflow: "hidden",
					borderRadius: "1.35rem",
					background: "#fff",
					boxShadow: "0 1rem 2.4rem rgb(124 45 18 / 0.1)",
					color: "inherit",
				})}
			>
				<a
					href={routes.photo.href({ id: String(handle.props.photo.id) })}
					mix={[
						css({
							display: "grid",
							color: "inherit",
							textDecoration: "none",
							WebkitTapHighlightColor: "transparent",
							"&:focus-visible": {
								outline: "3px solid #f97316",
								outlineOffset: "-3px",
							},
						}),
						on<HTMLAnchorElement, "click">("click", (event) => {
							event.preventDefault();

							let albumURL = new URL(
								routes.album.href({ id: String(handle.props.photo.albumId) }),
								window.location.href,
							);
							albumURL.searchParams.set("photoId", String(handle.props.photo.id));

							void router.navigate(albumURL, {
								mask: routes.photo.href({ id: String(handle.props.photo.id) }),
							});
						}),
					]}
				>
					<img
						mix={css({ display: "block", width: "100%", height: "auto" })}
						src={handle.props.photo.thumbnailUrl}
						alt=""
						loading="lazy"
						width="150"
						height="150"
					/>
					<p
						mix={css({
							margin: 0,
							padding: "0.85rem 0.85rem 0.35rem",
							color: "#5f3f33",
							fontSize: "0.9rem",
							fontWeight: 700,
						})}
					>
						{titleCase(handle.props.photo.title)}
					</p>
				</a>
				<form
					method="POST"
					action={routes.likePhoto.href({
						albumId: String(handle.props.photo.albumId),
						photoId: String(handle.props.photo.id),
					})}
					mix={[
						fetcher.form(),
						css({
							display: "flex",
							justifyContent: "space-between",
							gap: "0.5rem",
							padding: "0 0.85rem 0.85rem",
						}),
					]}
				>
					<input type="hidden" name="photoId" value={String(handle.props.photo.id)} />
					<button
						type="submit"
						disabled={fetcher.state !== "idle"}
						mix={css({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.35rem",
							padding: "0.45rem 0.7rem",
							border: "1px solid rgb(154 52 18 / 0.18)",
							borderRadius: "999rem",
							background: liked ? "#fed7aa" : "rgb(255 247 237 / 0.9)",
							color: "#7c2d12",
							cursor: "pointer",
							font: "inherit",
							fontSize: "0.82rem",
							fontWeight: 800,
							"&:disabled": {
								cursor: "wait",
								opacity: 0.72,
							},
							"&:focus-visible": {
								outline: "3px solid #f97316",
								outlineOffset: "3px",
							},
						})}
					>
						{fetcher.state === "submitting" ? "Saving" : liked ? "Liked" : "Like"}
					</button>
					<span
						mix={css({
							alignSelf: "center",
							color: "#9a3412",
							fontSize: "0.78rem",
							fontWeight: 800,
						})}
					>
						{liked ? "Saved" : "Unsaved"}
					</span>
				</form>
			</article>
		);
	};
}
