/**
 * The copyright line on every public page, marked up as the publisher's h-card.
 * The name stays the visible text it already was; the URL and photo ride on
 * `data` elements so the line does not become a padded footer link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { mf } from "@sdxc/microformats/ui";

import { PUBLISHER } from "~/config/site";

namespace SiteCredit {
	export interface Props {
		/** The public pages' translator, which already has the landing figures bound. */
		t: Translate;
	}
}

/**
 * Renders "© {year} {publisher}" as one h-card. The card's URL is the publisher's
 * own site, which the document's `rel="me"` links also name, so the home page's
 * representative card resolves to this person.
 */
export default function SiteCredit(handle: Handle<SiteCredit.Props>) {
	return () => {
		let { t } = handle.props;
		let year = String(new Date().getFullYear());

		return (
			<span mix={[mf("h-card")]}>
				{t("landing.footer.copyright", { year })}{" "}
				<span mix={[mf("p-name")]}>{t("landing.footer.publisher")}</span>
				<data mix={[mf("u-url", "u-uid")]} value={PUBLISHER.url} />
				<data mix={[mf("u-photo")]} value={PUBLISHER.photo} />
			</span>
		);
	};
}
