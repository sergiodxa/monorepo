/**
 * Live preview for `AutoRefresh`: a deploy runs list set to refresh every 30 seconds, with
 * the interval menu and the time the list was last fetched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AutoRefresh } from "@sdxc/ui/app/auto-refresh";

/** The source the page shows, matching the markup below. */
const CODE = `<AutoRefresh
	id="runs-refresh"
	url={request.url}
	frame="run-list"
	refreshedAt={new Date()}
	options={[
		{ value: 0, label: "Off" },
		{ value: 10, label: "10s" },
		{ value: 30, label: "30s" },
		{ value: 60, label: "1m" },
		{ value: 300, label: "5m" },
	]}
	labels={{ trigger: "Auto-refresh", updated: "Updated {time}" }}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<AutoRefresh
			id="preview-runs-refresh"
			url="/examples/runs?refresh=30"
			frame="preview-run-list"
			refreshedAt={new Date("2026-11-01T10:42:07Z")}
			options={[
				{ value: 0, label: "Off" },
				{ value: 10, label: "10s" },
				{ value: 30, label: "30s" },
				{ value: 60, label: "1m" },
				{ value: 300, label: "5m" },
			]}
			locale="en-US"
			timeZone="UTC"
			labels={{ trigger: "Auto-refresh", updated: "Updated {time}" }}
		/>
	),
};
