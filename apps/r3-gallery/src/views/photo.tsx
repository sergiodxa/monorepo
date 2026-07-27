/**
 * PhotoPage view for the gallery. It renders a photo either as a full standalone page
 * (wrapped in the Shell for direct `/photo/:id` visits) or, when shown inside a Frame,
 * as a bare preview with a "Reload frame" control. It exists to adapt one photo view to
 * both the direct route and the album modal overlay.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Button } from "@pkg/r3-ui";
import { on } from "remix/ui";

import type { Photo } from "../data/types";

import { PhotoPreview } from "../components/photo-preview";
import { Shell } from "../components/shell";

/**
 * Props for the standalone photo route.
 */
export interface PhotoPageProps {
	photo: Photo;
}

/**
 * Renders the standalone photo page used for direct `/photo/:id` visits.
 *
 * @param handle Component handle carrying the fetched photo.
 * @returns Standalone photo route UI.
 */
export function PhotoPage(handle: Handle<PhotoPageProps>) {
	return () => {
		let frameSrc = handle.frame.src;
		let isFullPage =
			URL.canParse(frameSrc) && new URL(frameSrc).pathname === `/photo/${handle.props.photo.id}`;

		if (isFullPage) {
			return (
				<Shell
					eyebrow={`Photo ${handle.props.photo.id}`}
					title="A single image, no album backdrop"
					intro="This is the direct route. Reloading the masked URL renders only the photo instead of restoring the album overlay."
				>
					<PhotoPreview photo={handle.props.photo} />
				</Shell>
			);
		}

		return (
			<PhotoPreview
				photo={handle.props.photo}
				actions={
					<Button
						type="button"
						color="brand"
						variant="outline"
						mix={on<HTMLButtonElement, "click">("click", () => {
							void handle.frame.reload();
						})}
					>
						Reload frame
					</Button>
				}
			/>
		);
	};
}
