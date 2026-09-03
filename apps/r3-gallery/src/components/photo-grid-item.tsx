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

import { fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, self } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { fit, height, minHeight, p, width } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { fontSize, leading, lineClamp, textDecoration } from "@sdxc/u/typography";
import { AspectRatio, Badge, Button, Card, Form } from "@sdxc/ui";
import { RouterProvider } from "@sdxc/ui-router";
import { on } from "remix/ui";

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

	fetcher.addEventListener(
		"change",
		() => {
			void handle.update();
		},
		{ signal: handle.signal },
	);

	function openPhoto(event: MouseEvent) {
		event.preventDefault();

		let albumURL = new URL(
			routes.album.href({ id: String(handle.props.photo.albumId) }),
			window.location.href,
		);
		albumURL.searchParams.set("photoId", String(handle.props.photo.id));

		void router.navigate(albumURL, {
			mask: routes.photo.href({ id: String(handle.props.photo.id) }),
		});
	}

	return () => {
		let liked =
			fetcher.data?.photoId === handle.props.photo.id ? fetcher.data.liked : handle.props.liked;
		let photoHref = routes.photo.href({ id: String(handle.props.photo.id) });
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
						action={routes.likePhoto.href({
							albumId: String(handle.props.photo.albumId),
							photoId: String(handle.props.photo.id),
						})}
						mix={fetcher.form()}
					>
						<input type="hidden" name="photoId" value={String(handle.props.photo.id)} />
						<Button
							type="submit"
							size="sm"
							color={liked ? "brand" : "neutral"}
							variant={liked ? "solid" : "outline"}
							isPending={fetcher.state !== "idle"}
						>
							{liked ? "Liked" : "Like"}
						</Button>
					</Form>
				</Card.Footer>
			</Card>
		);
	};
}
