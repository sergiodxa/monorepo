/**
 * The operator's `h-card`, the identity a public page's microformats name. The footer
 * carries it as the site's representative card; an article nests the same card as its
 * `p-author`, so both readers see the person the trust page names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { mf } from "@sdxc/microformats/ui";
import { fg } from "@sdxc/u/color";
import { text, textDecoration } from "@sdxc/u/typography";

import { SITE_OWNER } from "~/config/site";

namespace SiteOwnerCard {
	export interface Props {
		/**
		 * Set on an `h-entry` so this card is that entry's author. Omitted on the footer,
		 * where the card stands for the site rather than one post.
		 */
		property?: "p-author";
	}
}

/**
 * Renders the owner's name as a link to their site, with the photo and note a parser
 * needs and a visitor does not see as extra copy. `p-name` is explicit because the
 * note is a `p-*` property, which would otherwise block the implied name.
 */
export default function SiteOwnerCard(handle: Handle<SiteOwnerCard.Props>) {
	return () => {
		let { property } = handle.props;

		return (
			<a
				href={SITE_OWNER.url}
				rel="me"
				mix={[
					property ? mf(property, "h-card") : mf("h-card"),
					text("sm"),
					fg("neutral.muted"),
					textDecoration("none"),
				]}
			>
				<span mix={[mf("p-name")]}>{SITE_OWNER.name}</span>
				<data mix={[mf("u-url", "u-uid")]} value={SITE_OWNER.url} />
				<data mix={[mf("u-photo")]} value={SITE_OWNER.photo} />
				<data mix={[mf("p-note")]} value={SITE_OWNER.note} />
			</a>
		);
	};
}
