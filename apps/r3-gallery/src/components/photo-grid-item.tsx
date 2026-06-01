import type { Handle } from "remix/ui";

import { RouterProvider } from "@pkg/r3-ui-router";
import { css, on } from "remix/ui";

import type { Photo } from "../data/types";

import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/**
 * Props for a photo grid item that opens with a masked URL.
 */
export interface PhotoGridItemProps {
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

	return () => (
		<a
			href={routes.photo.href({ id: String(handle.props.photo.id) })}
			mix={[
				css({
					display: "grid",
					overflow: "hidden",
					borderRadius: "1.35rem",
					background: "#fff",
					boxShadow: "0 1rem 2.4rem rgb(124 45 18 / 0.1)",
					color: "inherit",
					textDecoration: "none",
					WebkitTapHighlightColor: "transparent",
					"&:focus-visible": {
						outline: "3px solid #f97316",
						outlineOffset: "4px",
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
					padding: "0.85rem",
					color: "#5f3f33",
					fontSize: "0.9rem",
					fontWeight: 700,
				})}
			>
				{titleCase(handle.props.photo.title)}
			</p>
		</a>
	);
}
