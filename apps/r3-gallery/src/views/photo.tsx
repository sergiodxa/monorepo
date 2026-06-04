import type { Handle } from "remix/ui";

import { css, on } from "remix/ui";

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
					<button
						type="button"
						mix={[
							frameButtonStyles(),
							on<HTMLButtonElement, "click">("click", () => {
								void handle.frame.reload();
							}),
						]}
					>
						Reload frame
					</button>
				}
			/>
		);
	};
}

/** Button style used by frame-only photo controls. */
function frameButtonStyles() {
	return css({
		display: "inline-flex",
		minHeight: "2.5rem",
		alignItems: "center",
		justifyContent: "center",
		padding: "0.6rem 0.9rem",
		border: "1px solid rgb(154 52 18 / 0.18)",
		borderRadius: "999rem",
		background: "rgb(255 255 255 / 0.74)",
		color: "#7c2d12",
		cursor: "pointer",
		font: "inherit",
		fontWeight: 800,
		"&:focus-visible": {
			outline: "3px solid #f97316",
			outlineOffset: "4px",
		},
	});
}
