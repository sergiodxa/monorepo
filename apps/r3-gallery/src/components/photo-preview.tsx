import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { Photo } from "../data/types";

import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

import { ActionLink } from "./action-link";

/**
 * Props for photo preview UI shared by modal and direct page.
 */
export interface PhotoPreviewProps {
	photo: Photo;
}

/**
 * Renders the large photo card for direct photo pages.
 *
 * @param handle Component handle carrying the fetched photo.
 * @returns Large standalone photo preview.
 */
export function PhotoPreview(handle: Handle<PhotoPreviewProps>) {
	return () => (
		<article
			mix={css({
				display: "grid",
				boxSizing: "border-box",
				gap: "1.5rem",
				maxWidth: "44rem",
				margin: "0 auto",
				padding: "clamp(1rem, 4vw, 2rem)",
				borderRadius: "2rem",
				background: "rgb(255 255 255 / 0.72)",
				boxShadow: "0 1.5rem 4rem rgb(124 45 18 / 0.1)",
			})}
			aria-labelledby={`standalone-photo-${handle.props.photo.id}`}
		>
			<img
				mix={css({ display: "block", width: "100%", height: "auto" })}
				src={handle.props.photo.url}
				alt={handle.props.photo.title}
			/>
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
					Album {handle.props.photo.albumId}
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
					id={`standalone-photo-${handle.props.photo.id}`}
				>
					{titleCase(handle.props.photo.title)}
				</h2>
			</div>
			<ActionLink href={routes.album.href({ id: String(handle.props.photo.albumId) })}>
				Open album
			</ActionLink>
		</article>
	);
}
