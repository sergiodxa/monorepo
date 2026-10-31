/**
 * One fetch of a busy feed, animated: its own schedule starts it, the feed object fetches
 * with the validators it kept, stores what is new, publishes its head, and a reader's queue
 * catches up when they open it. Nothing in it waits on the reader, which is what it shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { ClockIcon, UsersIcon } from "@sdxc/icons";
import { FlowDiagram } from "@sdxc/ui/patterns";

import { POLL_FLOOR_MS } from "~/database/feed-schema";
import { formatInterval } from "~/resources/components/marketing/scenes";

/** The request and records each step shows, in the order a fetch runs them. */
const STEPS = [
	["fetch", 'GET /feed.xml  If-None-Match: "a1f3"'],
	["store", "200 OK · 3 new items"],
	["publish", "head → 3 ahead of your cursor"],
	["arrive", "3 posts arriving behind the page"],
] as const;

/**
 * Renders the run. Without motion every step shows as done, so the static picture is the
 * finished fetch.
 */
export default function RefreshDiagram(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		return (
			<FlowDiagram
				aria-label={t("landing.freshness.diagram.label")}
				pauseLabel={t("landing.freshness.diagram.pause")}
				trigger={{
					icon: <ClockIcon size={14} aria-hidden="true" />,
					title: t("landing.freshness.diagram.trigger"),
					detail: t("landing.freshness.diagram.detail", {
						interval: formatInterval(POLL_FLOOR_MS),
					}),
				}}
				steps={STEPS.map(([key, code]) => ({
					title: t(`landing.freshness.diagram.steps.${key}`),
					code,
				}))}
				outcome={t("landing.freshness.diagram.outcome")}
				footnote={
					<>
						<UsersIcon size={14} aria-hidden="true" />
						{t("landing.freshness.diagram.footnote")}
					</>
				}
			/>
		);
	};
}
