/**
 * The billing problem strip a signed-in screen hands its shell as `banner`: shown while the
 * owner's monitoring subscription is past due, which pauses checks until the payment is fixed.
 * The owner gets the one fixing action; everyone else learns who can fix it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";
import type { getContext as GetContext } from "remix/middleware/async-context";

import { Banner, LinkButton } from "@sdxc/ui";

import routes from "~/routes/web";

namespace BillingBanner {
	export interface Props {
		intl: ReturnType<typeof GetContext>["intl"];
		teamSlug: string;
		/** Whether the viewer owns the team, the only person who can update its payment method. */
		isOwner: boolean;
	}
}

/**
 * Renders the strip. It carries no dismiss, since it stays until the payment goes through; the
 * owner's action opens hosted billing as a document navigation, leaving the app.
 */
export default function BillingBanner(handle: Handle<BillingBanner.Props>) {
	return () => {
		let { intl, teamSlug, isOwner } = handle.props;

		return (
			<Banner
				color="danger"
				label={intl.t("page.billing.banner.region")}
				action={
					isOwner ? (
						<LinkButton
							href={routes.app.team.checkout.href({ team: teamSlug })}
							data-rmx-document=""
							size="sm"
						>
							{intl.t("page.billing.banner.cta")}
						</LinkButton>
					) : undefined
				}
			>
				{intl.t(isOwner ? "page.billing.banner.owner" : "page.billing.banner.member")}
			</Banner>
		);
	};
}
