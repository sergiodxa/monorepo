/**
 * The site owner's h-card: the name a page already credits, plus the note and photo a
 * parser reads beside it. One card on the home page is the representative card, because
 * its URL is also a `rel="me"` profile in the document head.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { mf } from "@sdxc/microformats/ui";
import { fg } from "@sdxc/u/color";
import { when } from "@sdxc/u/state";

import { AUTHOR_NAME, AUTHOR_PHOTO_URL, AUTHOR_URL, SITE_DESCRIPTION } from "~/config/constants";

/** Renders the author's name as an h-card whose URL is the author's own site. */
export default function OwnerCard(_handle: Handle) {
	return () => (
		<span mix={[mf("h-card")]}>
			<a
				href={AUTHOR_URL}
				rel="me"
				mix={[mf("p-name", "u-url", "u-uid"), fg("neutral.emphasis"), when("&:hover", fg("brand"))]}
			>
				{AUTHOR_NAME}
			</a>
			<data mix={[mf("p-note")]} value={SITE_DESCRIPTION} />
			<data mix={[mf("u-photo")]} value={AUTHOR_PHOTO_URL} />
		</span>
	);
}
