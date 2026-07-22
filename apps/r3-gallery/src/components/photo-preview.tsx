/**
 * PhotoPreview component for the gallery, rendering a large photo card with its album
 * label, title-cased heading, and an optional actions slot that defaults to an "Open
 * album" link. It is shared between the standalone photo page and the modal overlay so
 * a photo looks consistent in both contexts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { AspectRatio, Card, Header, LinkButton } from "@pkg/r3-ui";
import { css } from "remix/ui";

import type { Photo } from "../data/types";

import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/**
 * Props for photo preview UI shared by modal and direct page.
 */
export interface PhotoPreviewProps {
	actions?: RemixNode;
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
		<Card
			mix={css({
				overflow: "hidden",
				maxWidth: "44rem",
				margin: "0 auto",
				borderRadius: "2rem",
			})}
		>
			<Card.Content mix={css({ padding: 0 })}>
				<AspectRatio ratio="1 / 1">
					<img
						mix={css({ display: "block", width: "100%", height: "100%", objectFit: "cover" })}
						src={handle.props.photo.url}
						alt={handle.props.photo.title}
					/>
				</AspectRatio>
			</Card.Content>
			<Card.Header>
				<Header mix={css({ padding: 0, color: "var(--ui-primary-fg-emphasis)" })}>
					Album {handle.props.photo.albumId}
				</Header>
				<Card.Title
					mix={css({
						fontFamily: 'Georgia, "Times New Roman", serif',
						fontSize: "clamp(2rem, 5vw, 4rem)",
						fontWeight: 500,
						letterSpacing: "-0.06em",
						lineHeight: 0.95,
					})}
				>
					{titleCase(handle.props.photo.title)}
				</Card.Title>
			</Card.Header>
			<Card.Footer>
				{handle.props.actions ?? (
					<LinkButton
						href={routes.album.href({ id: String(handle.props.photo.albumId) })}
						color="primary"
						variant="outline"
					>
						Open album
					</LinkButton>
				)}
			</Card.Footer>
		</Card>
	);
}
