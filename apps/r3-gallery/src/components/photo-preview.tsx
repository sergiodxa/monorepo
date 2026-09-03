/**
 * PhotoPreview component for the gallery, rendering a photo card with its album
 * label, title-cased heading, and an optional actions slot that defaults to an
 * "Open album" link. Shared by the standalone photo page and the modal overlay
 * so a photo looks consistent in both contexts. It splits into an image column
 * beside a content column once wide enough, otherwise stacking the two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, container, flex, flexCol, grid } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { at } from "@sdxc/u/responsive";
import { aspect, fit, height, mbs, p, width } from "@sdxc/u/size";
import { leading, tracking, weight } from "@sdxc/u/typography";
import { Card, Header, LinkButton } from "@sdxc/ui";

import type { Photo } from "../data/types";

import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/** Named container the wrapper declares, so the Card can react to its own rendered width instead of the viewport. */
const CONTAINER_NAME = "photo-preview";

/** Container width past which the card splits into an image column beside a content column. */
const SPLIT_AT = "34rem";

/**
 * Props for photo preview UI shared by modal and direct page.
 */
export interface PhotoPreviewProps {
	actions?: RemixNode;
	photo: Photo;
}

/**
 * Renders the photo card shared by the standalone photo page and the modal overlay.
 *
 * @param handle Component handle carrying the fetched photo.
 * @returns The responsive photo preview card.
 */
export function PhotoPreview(handle: Handle<PhotoPreviewProps>) {
	return () => (
		<div mix={container(CONTAINER_NAME)}>
			<Card
				mix={[
					grid(),
					raw({ gridTemplateColumns: "1fr", maxHeight: "min(85vh, 34rem)" }),
					overflow(),
					rounded("1.25rem"),
					at(SPLIT_AT, CONTAINER_NAME, [
						raw({ gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)" }),
						aspect(16, 10),
					]),
				]}
			>
				<Card.Content mix={[p(0), overflow()]}>
					<img
						mix={[block(), width("full"), height("full"), fit("cover")]}
						src={handle.props.photo.url}
						alt={handle.props.photo.title}
					/>
				</Card.Content>
				<div mix={[flex(), flexCol(), overflow("auto")]}>
					<Card.Header>
						<Header mix={[p(0), fg("brand.emphasis")]}>Album {handle.props.photo.albumId}</Header>
						<Card.Title
							mix={[
								raw({
									fontFamily: 'Georgia, "Times New Roman", serif',
									fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
								}),
								tracking("-0.04em"),
								weight(500),
								leading(1.05),
							]}
						>
							{titleCase(handle.props.photo.title)}
						</Card.Title>
					</Card.Header>
					<Card.Footer mix={mbs("auto")}>
						{handle.props.actions ?? (
							<LinkButton
								href={routes.album.href({ id: String(handle.props.photo.albumId) })}
								color="brand"
								variant="outline"
							>
								Open album
							</LinkButton>
						)}
					</Card.Footer>
				</div>
			</Card>
		</div>
	);
}
