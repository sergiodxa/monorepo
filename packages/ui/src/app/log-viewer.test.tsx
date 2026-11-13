/**
 * Renders the job log on the server, as a browser without script receives it: the failed and
 * running steps open and the rest closed, the running job's log so far with a Refresh link,
 * line links whose fragments are the lines' ids, and the search box left for the island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { LogViewer } from "./log-viewer.js";

const LABELS: LogViewer.Labels = {
	log: "Job log",
	states: {
		success: "Succeeded",
		failure: "Failed",
		running: "In progress",
		queued: "Queued",
		skipped: "Skipped",
		cancelled: "Cancelled",
	},
	search: "Search logs",
	matches: "{index} of {count}",
	noMatches: "No results",
	previousMatch: "Previous match",
	nextMatch: "Next match",
	showTimestamps: "Show timestamps",
	hideTimestamps: "Hide timestamps",
	jumpToLatest: "Jump to latest",
	refresh: "Refresh",
};

/** Renders a three-step job whose second step failed and third is still running. */
async function html(): Promise<string> {
	return String(
		await renderToString(
			<LogViewer
				lineHref={(step, n) => `/runs/7#step:${step}:${n}`}
				labels={LABELS}
				timestampsHref="?ts=1"
				steps={[
					{ name: "Install", state: "success", lines: [{ n: 1, text: "ok" }] },
					{ name: "Test", state: "failure", lines: [{ n: 1, text: "##[error]boom" }] },
					{
						name: "Deploy",
						state: "running",
						lines: [{ n: 1, text: "uploading" }],
						stream: { src: "/runs/7/steps/3/log?after=1", refresh: "/runs/7" },
					},
				]}
			/>,
		),
	);
}

describe("LogViewer on the server", () => {
	test("opens the failed and running steps and leaves the rest closed", async () => {
		let markup = await html();
		expect(markup).toMatch(/<details[^>]*data-log-step="1"(?![^>]*\sopen)[^>]*>/);
		expect(markup).toMatch(/<details[^>]*data-log-step="2"[^>]*\sopen/);
		expect(markup).toMatch(/<details[^>]*data-log-step="3"[^>]*\sopen/);
	});

	test("gives a running job its log so far and a Refresh link to the page", async () => {
		let markup = await html();
		expect(markup).toContain('data-log-stream="/runs/7/steps/3/log?after=1"');
		expect(markup).toContain('data-log-next="2"');
		expect(markup).toContain('data-log-href="/runs/7#step:3:987654321"');
		expect(markup).toMatch(/<p data-log-refresh[^>]*><a href="\/runs\/7"[^>]*>Refresh<\/a>/);
		expect(markup).toContain("uploading");
	});

	test("makes each line's link fragment its id, with the number in an attribute", async () => {
		let markup = await html();
		expect(markup).toContain('id="step:2:1"');
		expect(markup).toMatch(/<a href="\/runs\/7#step:2:1" data-n="1"[^>]*><\/a>boom/);
	});

	test("leaves the search box hidden for the island and links the timestamps toggle", async () => {
		let markup = await html();
		expect(markup).toMatch(/<div role="search" hidden data-log-search/);
		expect(markup).toMatch(/<a href="\?ts=1" aria-pressed="false" role="button"/);
	});
});
