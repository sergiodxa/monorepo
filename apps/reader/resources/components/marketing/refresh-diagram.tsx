/**
 * One fetch of a busy feed fanning out, animated: Harbor Daily is asked only for what
 * changed on its own rhythm, and that single fetch lands the same new posts in every
 * follower's queue, which catches up when its reader opens it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { ClockIcon, UsersIcon } from "@sdxc/icons";
import { FanOutDiagram } from "@sdxc/ui/landing";

import { POLL_FLOOR_MS } from "~/database/feed-schema";
import { SAMPLE_FEEDS } from "~/resources/components/marketing/sample-data";
import { formatInterval } from "~/resources/components/marketing/scenes";

/** The followers whose queues the one fetch fills, generic names that read in any locale. */
const READERS = ["Ana", "Ben", "Chen", "Dana", "Eli"] as const;

/** The conditional request the fetch sends, carrying the validator the feed gave last time. */
const REQUEST = 'GET /feed.xml  If-None-Match: "a1f3"';

/**
 * Renders the fan-out. Without motion every queue shows filled, so the static picture is
 * the delivered fetch.
 */
export default function RefreshDiagram(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let harbor = SAMPLE_FEEDS.find((feed) => feed.title === "Harbor Daily");
		return (
			<FanOutDiagram
				aria-label={t("landing.freshness.diagram.label")}
				pauseLabel={t("landing.freshness.diagram.pause")}
				source={{
					icon: <ClockIcon size={14} aria-hidden="true" />,
					title: harbor?.title,
					detail: REQUEST,
				}}
				targets={READERS.map((name) => ({
					title: t("landing.freshness.diagram.queue", { name }),
					detail: t("landing.freshness.diagram.added"),
				}))}
				outcome={t("landing.freshness.diagram.outcome")}
				footnote={
					<>
						<UsersIcon size={14} aria-hidden="true" />
						{t("landing.freshness.diagram.footnote", {
							pollFloor: formatInterval(POLL_FLOOR_MS),
						})}
					</>
				}
			/>
		);
	};
}
