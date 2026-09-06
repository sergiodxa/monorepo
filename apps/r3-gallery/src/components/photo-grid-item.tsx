/**
 * PhotoGridItem component for album grids. It renders a photo thumbnail whose click
 * reports the photo upward so the album can layer it, plus a like form that toggles
 * liked state through the router and reflects the answer in place. It exists to make
 * each grid cell an interactive, likeable, deep-linkable photo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, self } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { fit, height, minHeight, p, width } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { fontSize, leading, lineClamp, textDecoration } from "@sdxc/u/typography";
import { AspectRatio, Badge, Button, Card, Form } from "@sdxc/ui";
import { on } from "remix/ui";

import type { Photo } from "../data/types";
import type { LikeToggleResult } from "../middleware/likes";

import { router } from "../router";
import { routes } from "../routes";
import { titleCase } from "../utils/title-case";

/**
 * Props for a photo grid item.
 */
export interface PhotoGridItemProps {
	liked: boolean;
	photo: Photo;
	onOpen(photo: Photo): void;
}

/**
 * Renders a photo thumbnail that reports clicks to its album and keeps its own
 * liked state in sync with the like route's answer.
 *
 * @param handle Component handle carrying one photo.
 * @returns A photo grid cell with its like control.
 */
export function PhotoGridItem(handle: Handle<PhotoGridItemProps>) {
	let likedOverride: boolean | undefined;
	let isPending = false;

	function openPhoto(event: MouseEvent) {
		event.preventDefault();
		handle.props.onOpen(handle.props.photo);
	}

	async function toggleLike(likeHref: string) {
		if (isPending) return;

		isPending = true;
		await handle.update();

		try {
			let response = await router.fetch(likeHref, { method: "POST" });
			let result = (await response.json()) as LikeToggleResult;

			likedOverride = result.liked;
		} finally {
			isPending = false;
			await handle.update();
		}
	}

	return () => {
		let liked = likedOverride ?? handle.props.liked;
		let photoHref = routes.photo.href({ id: String(handle.props.photo.id) });
		let likeHref = routes.likePhoto.href({
			albumId: String(handle.props.photo.albumId),
			photoId: String(handle.props.photo.id),
		});
		let title = titleCase(handle.props.photo.title);

		return (
			<Card
				mix={[
					overflow("hidden"),
					rounded("1.35rem"),
					raw({ boxShadow: "0 1rem 2.4rem rgb(124 45 18 / 0.1)" }),
				]}
			>
				<Card.Content mix={p(0)}>
					<a
						href={photoHref}
						aria-label={title}
						mix={[
							when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
							block(),
							raw({ WebkitTapHighlightColor: "transparent" }),
							on<HTMLAnchorElement, "click">("click", openPhoto),
						]}
					>
						<AspectRatio ratio="1 / 1">
							<img
								mix={[block(), width("full"), height("full"), fit("cover")]}
								src={handle.props.photo.thumbnailUrl}
								alt=""
								loading="lazy"
							/>
						</AspectRatio>
					</a>
				</Card.Content>
				<Card.Header>
					<Badge
						color={liked ? "brand" : "neutral"}
						variant={liked ? "secondary" : "outline"}
						mix={self("start")}
					>
						{liked ? "Saved" : "Unsaved"}
					</Badge>
					<Card.Title mix={[fontSize("0.9rem"), leading(1.3), minHeight("3.5rem"), lineClamp(3)]}>
						<a
							href={photoHref}
							mix={[
								fg("inherit"),
								textDecoration("none"),
								on<HTMLAnchorElement, "click">("click", openPhoto),
							]}
						>
							{title}
						</a>
					</Card.Title>
				</Card.Header>
				<Card.Footer>
					<Form
						method="POST"
						action={likeHref}
						mix={on<HTMLFormElement, "submit">("submit", (event) => {
							event.preventDefault();
							void toggleLike(likeHref);
						})}
					>
						<Button
							type="submit"
							size="sm"
							color={liked ? "brand" : "neutral"}
							variant={liked ? "solid" : "outline"}
							isPending={isPending}
						>
							{liked ? "Liked" : "Like"}
						</Button>
					</Form>
				</Card.Footer>
			</Card>
		);
	};
}
