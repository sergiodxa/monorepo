/**
 * The badge a domain registration's status is shown with, on the DNS monitor list and its
 * detail page alike, so both read a status in the same tone and words. `unavailable` reads
 * neutral: the registry having nothing to say is no fault of the domain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";
import type { getContext } from "remix/middleware/async-context";

import { Badge } from "@sdxc/ui";

import type { RegistrationStatus } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import { badgeVariant } from "~/resources/components/badge";

/** The tone each registration status is drawn in. */
const REGISTRATION_BADGE_TONE: Record<RegistrationStatus, BadgeTone> = {
	unknown: "neutral",
	valid: "up",
	expiring: "degraded",
	expired: "down",
	unavailable: "neutral",
	error: "down",
};

/** Renders a registration status as a toned badge with its localized label. */
export default function RegistrationBadge(handle: Handle<RegistrationBadge.Props>) {
	return () => {
		let { status, intl } = handle.props;
		return (
			<Badge {...badgeVariant(REGISTRATION_BADGE_TONE[status])}>
				{intl.t(`page.dnsMonitorDetail.registration.statuses.${status}`)}
			</Badge>
		);
	};
}

/** The props a {@link RegistrationBadge} takes. */
export namespace RegistrationBadge {
	/** The status to draw and the translator its label comes from. */
	export interface Props {
		status: RegistrationStatus;
		intl: ReturnType<typeof getContext>["intl"];
	}
}
