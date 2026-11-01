/**
 * Live preview for `Timeline`: an incident's activity from the moment a check failed to
 * its resolution, with a folded run of retries, a comment card and a deploy in between.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CircleCheckIcon,
	CircleDotIcon,
	MessageSquareIcon,
	RefreshCwIcon,
	RocketIcon,
	UserPlusIcon,
} from "@sdxc/icons";
import { m } from "@sdxc/u/size";
import { Avatar } from "@sdxc/ui";
import { Timeline } from "@sdxc/ui/timeline";

/** The source the page shows, matching the markup below. */
const CODE = `<Timeline aria-label="Incident activity">
	<Timeline.Event icon={<CircleDotIcon />} tone="danger" actor="Uptime" time="14:02">
		opened the incident: api.example.com is down from 3 regions
	</Timeline.Event>
	<Timeline.More summary="3 more checks">
		<Timeline.Event icon={<RefreshCwIcon />} actor="Uptime" time="14:03">
			retried from Frankfurt
		</Timeline.Event>
		…
	</Timeline.More>
	<Timeline.Event icon={<UserPlusIcon />} avatar={<Avatar size="sm">…</Avatar>} actor="Ana Souza" time="14:05">
		assigned the incident to herself
	</Timeline.Event>
	<Timeline.Event
		icon={<MessageSquareIcon />}
		actor="Ana Souza"
		time="14:09"
		body={<p>The 13:58 deploy changed the pool size. Rolling it back.</p>}
	>
		commented
	</Timeline.Event>
	<Timeline.Event icon={<RocketIcon />} tone="brand" actor="deploy-bot" time="14:12">
		deployed v4.2.0 to production
	</Timeline.Event>
	<Timeline.Event icon={<CircleCheckIcon />} tone="success" actor="Uptime" time="14:14">
		resolved the incident after 12 minutes
	</Timeline.Event>
</Timeline>`;

/** Ana's small avatar, drawn from her initials. */
function Ana() {
	return () => (
		<Avatar size="sm">
			<Avatar.Fallback>AS</Avatar.Fallback>
		</Avatar>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<Timeline aria-label="Incident activity">
			<Timeline.Event icon={<CircleDotIcon />} tone="danger" actor="Uptime" time="14:02">
				opened the incident: api.example.com is down from 3 regions
			</Timeline.Event>
			<Timeline.More summary="3 more checks">
				<Timeline.Event icon={<RefreshCwIcon />} actor="Uptime" time="14:03">
					retried from Frankfurt
				</Timeline.Event>
				<Timeline.Event icon={<RefreshCwIcon />} actor="Uptime" time="14:03">
					retried from São Paulo
				</Timeline.Event>
				<Timeline.Event icon={<RefreshCwIcon />} actor="Uptime" time="14:04">
					retried from Singapore
				</Timeline.Event>
			</Timeline.More>
			<Timeline.Event icon={<UserPlusIcon />} avatar={<Ana />} actor="Ana Souza" time="14:05">
				assigned the incident to herself
			</Timeline.Event>
			<Timeline.Event
				icon={<MessageSquareIcon />}
				avatar={<Ana />}
				actor="Ana Souza"
				time="14:09"
				body={<p mix={[m(0)]}>The 13:58 deploy changed the database pool size. Rolling it back.</p>}
			>
				commented
			</Timeline.Event>
			<Timeline.Event icon={<RocketIcon />} tone="brand" actor="deploy-bot" time="14:12">
				deployed v4.2.0 to production
			</Timeline.Event>
			<Timeline.Event icon={<CircleCheckIcon />} tone="success" actor="Uptime" time="14:14">
				resolved the incident after 12 minutes
			</Timeline.Event>
		</Timeline>
	),
};
