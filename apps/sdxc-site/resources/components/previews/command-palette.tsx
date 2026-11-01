/**
 * Live preview for `CommandPalette`: an ops dashboard's palette that goes to monitors and
 * incidents, creates a monitor, pauses every check, copies the account ID and opens a nested
 * Switch Team page, opened from a trigger that shows its key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	ActivityIcon,
	CirclePauseIcon,
	CopyIcon,
	PlusIcon,
	SirenIcon,
	UsersIcon,
} from "@sdxc/icons";
import { CommandPalette } from "@sdxc/ui/app/command-palette";

/** The source the page shows, matching the markup below. */
const CODE = `<CommandPalette.Trigger for="ops-palette" shortcut="mod+shift+k">Search or jump to…</CommandPalette.Trigger>

<form id="pause-all" method="post" action="/monitors/pause-all" hidden></form>

<CommandPalette
	id="ops-palette"
	shortcut="mod+shift+k"
	recent={["go-incidents", "create-monitor"]}
	remember="pulse:palette"
	labels={{
		title: "Command menu",
		open: "Open command menu",
		placeholder: "Search monitors or run a command…",
		recent: "Recent",
		noResults: "No commands match",
		noResultsHint: "Try a monitor name, or “create”.",
		results: "{count} results",
		back: "Back",
		close: "Close",
	}}
>
	<CommandPalette.Group heading="Navigation">
		<CommandPalette.Item id="go-monitors" title="Go to Monitors" icon={<ActivityIcon size={16} />} href="/monitors" shortcut="g m" />
		<CommandPalette.Item id="go-incidents" title="Go to Incidents" icon={<SirenIcon size={16} />} href="/incidents" shortcut="g i" />
	</CommandPalette.Group>
	<CommandPalette.Group heading="Monitors">
		<CommandPalette.Item id="create-monitor" title="Create Monitor" keywords={["new", "check", "add"]} icon={<PlusIcon size={16} />} href="/monitors/new" shortcut="c" />
		<CommandPalette.Item id="pause-all" title="Pause All Monitors" description="Stops every check until resumed" icon={<CirclePauseIcon size={16} />} form="pause-all" />
	</CommandPalette.Group>
	<CommandPalette.Group heading="Account">
		<CommandPalette.Item id="copy-account-id" title="Copy Account ID" keywords={["clipboard"]} icon={<CopyIcon size={16} />} command="--copy-account-id" commandfor="account" />
		<CommandPalette.Item id="switch-team" title="Switch Team…" icon={<UsersIcon size={16} />} page="teams" />
	</CommandPalette.Group>
	<CommandPalette.Page id="teams" title="Switch Team" placeholder="Search teams…">
		<CommandPalette.Item id="team-acme" title="Acme Ops" href="/teams/acme" />
		<CommandPalette.Item id="team-globex" title="Globex Infrastructure" href="/teams/globex" />
		<CommandPalette.Item id="team-paris" title="Équipe Paris" href="/teams/paris" />
	</CommandPalette.Page>
</CommandPalette>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div id="account">
			<CommandPalette.Trigger for="ops-palette" shortcut="mod+shift+k">
				Search or jump to…
			</CommandPalette.Trigger>

			<form id="pause-all" method="post" action="/examples/monitors/pause-all" hidden />

			<CommandPalette
				id="ops-palette"
				shortcut="mod+shift+k"
				recent={["go-incidents", "create-monitor"]}
				remember="sdxc-preview:palette"
				labels={{
					title: "Command menu",
					open: "Open command menu",
					placeholder: "Search monitors or run a command…",
					recent: "Recent",
					noResults: "No commands match",
					noResultsHint: "Try a monitor name, or “create”.",
					results: "{count} results",
					back: "Back",
					close: "Close",
				}}
			>
				<CommandPalette.Group heading="Navigation">
					<CommandPalette.Item
						id="go-monitors"
						title="Go to Monitors"
						icon={<ActivityIcon size={16} />}
						href="/examples/monitors"
						shortcut="g m"
					/>
					<CommandPalette.Item
						id="go-incidents"
						title="Go to Incidents"
						icon={<SirenIcon size={16} />}
						href="/examples/incidents"
						shortcut="g i"
					/>
				</CommandPalette.Group>
				<CommandPalette.Group heading="Monitors">
					<CommandPalette.Item
						id="create-monitor"
						title="Create Monitor"
						keywords={["new", "check", "add"]}
						icon={<PlusIcon size={16} />}
						href="/examples/monitors/new"
						shortcut="c"
					/>
					<CommandPalette.Item
						id="pause-all"
						title="Pause All Monitors"
						description="Stops every check until resumed"
						icon={<CirclePauseIcon size={16} />}
						form="pause-all"
					/>
				</CommandPalette.Group>
				<CommandPalette.Group heading="Account">
					<CommandPalette.Item
						id="copy-account-id"
						title="Copy Account ID"
						keywords={["clipboard"]}
						icon={<CopyIcon size={16} />}
						command="--copy-account-id"
						commandfor="account"
					/>
					<CommandPalette.Item
						id="switch-team"
						title="Switch Team…"
						icon={<UsersIcon size={16} />}
						page="teams"
					/>
				</CommandPalette.Group>
				<CommandPalette.Page id="teams" title="Switch Team" placeholder="Search teams…">
					<CommandPalette.Item id="team-acme" title="Acme Ops" href="/examples/teams/acme" />
					<CommandPalette.Item
						id="team-globex"
						title="Globex Infrastructure"
						href="/examples/teams/globex"
					/>
					<CommandPalette.Item id="team-paris" title="Équipe Paris" href="/examples/teams/paris" />
				</CommandPalette.Page>
			</CommandPalette>
		</div>
	),
};
