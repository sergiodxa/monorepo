/**
 * The closing call every Uptime marketing page ends on: one line of promise and the
 * account action, on an inset band in the brand fill, so each page closes on the same
 * decision with the same control the header offers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { ClosingCta } from "@sdxc/ui/patterns";

import AuthCta from "~/resources/components/marketing/auth-cta";

namespace ClosingBand {
	export interface Props {
		isSignedIn: boolean;
		/** The closing promise, such as `landing.marketingPage.finalCtaTitle`. */
		title: RemixNode;
		/** One supporting sentence under the title. */
		description?: RemixNode;
		/** Signed-out label; pass the chrome's `startLabel` so it matches the header. */
		startLabel: string;
		/** Signed-in label; pass the chrome's `dashboardLabel` so it matches the header. */
		dashboardLabel: string;
		/** A second, quieter action beside the account action, such as a docs link. */
		secondary?: RemixNode;
		/** Anchor target for in-page links. */
		id?: string;
	}
}

/**
 * Renders the band. The action is the inverted neutral button, since a brand button on
 * the brand fill would be legible only by its border.
 *
 * @example
 * <ClosingBand
 * 	isSignedIn={isSignedIn}
 * 	title={t("landing.marketingPage.finalCtaTitle")}
 * 	description={t("landing.finalCta.body")}
 * 	startLabel={chrome.startLabel}
 * 	dashboardLabel={chrome.dashboardLabel}
 * />
 */
export default function ClosingBand(handle: Handle<ClosingBand.Props>) {
	return () => {
		let { dashboardLabel, description, id, isSignedIn, secondary, startLabel, title } =
			handle.props;

		return (
			<ClosingCta
				id={id}
				tone="brand"
				inset
				title={title}
				description={description}
				actions={
					<>
						<AuthCta
							isSignedIn={isSignedIn}
							startLabel={startLabel}
							dashboardLabel={dashboardLabel}
							color="neutral"
							icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />}
						/>
						{secondary}
					</>
				}
			/>
		);
	};
}
