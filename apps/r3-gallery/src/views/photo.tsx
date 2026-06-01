import type { Handle } from "remix/ui";

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
	return () => (
		<Shell
			eyebrow={`Photo ${handle.props.photo.id}`}
			title="A single image, no album backdrop"
			intro="This is the direct route. Reloading the masked URL renders only the photo instead of restoring the album overlay."
		>
			<PhotoPreview photo={handle.props.photo} />
		</Shell>
	);
}
