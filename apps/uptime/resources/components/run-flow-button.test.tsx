// @vitest-environment happy-dom

/**
 * Tests for the run-flow button hydrated on a page beside the flow monitor's latest-run cards:
 * a run that happened reloads those cards, which once stayed on the previous run until the
 * page was reloaded, and a refused run leaves them as they are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime } from "remix/component";

import { createTranslator } from "@sdxc/i18n";
import { setIntl } from "@sdxc/i18n/ui";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Frame, run } from "remix/component";
import { renderToStream } from "remix/component/server";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import en from "~/resources/locales/en";

import { FLOW_RESULTS_FRAME, RunFlowButton } from "./run-flow-button";

/** Where the button posts its run. */
const RUN_ACTION = "/actions/acme/run-flow";

/** A run that happened and passed, as the action answers it. */
const PASSED_RUN = {
	status: "up",
	reason: null,
	testsPassed: 3,
	testsTotal: 3,
	requestsMade: 4,
	durationMs: 1200,
	failedTest: null,
	failedAtLine: null,
	detail: null,
};

let server = setupServer(http.post(`*${RUN_ACTION}`, () => HttpResponse.json(PASSED_RUN)));

let app: AppRuntime | undefined;

/** The frame named in each frame request the page made after hydrating, oldest first. */
let reloaded: Array<string | undefined> = [];

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });
	/** The test document's style sheet cannot parse the layered rules `css()` writes. */
	vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => 0);
	setIntl(
		createTranslator({ resources: { en }, supportedLanguages: ["en"], fallbackLanguage: "en" })()
			.intl,
	);
});

afterEach(() => {
	app?.dispose();
	app = undefined;
	document.body.innerHTML = "";
	reloaded = [];
	server.resetHandlers();
});

afterAll(() => server.close());

/** Hydrates the button on a page holding the latest-run cards' frame, and returns its form. */
async function mount(): Promise<HTMLFormElement> {
	document.body.innerHTML = await new Response(
		renderToStream(
			<div>
				<RunFlowButton action={RUN_ACTION} monitorId="monitor-1" name="Checkout" />
				<Frame name={FLOW_RESULTS_FRAME} src="/frames/flow-results" />
			</div>,
			{ resolveFrame: () => "<p>Previous run</p>" },
		),
	).text();
	app = run({
		loadModule: () => RunFlowButton,
		resolveFrame: (_src, options) => {
			reloaded.push(options?.target);
			return "<p>Latest run</p>";
		},
	});
	await app.ready();
	return document.querySelector("form") as HTMLFormElement;
}

describe("RunFlowButton", () => {
	test("reloads the latest-run cards once the flow has run", async () => {
		let form = await mount();

		form.requestSubmit();

		await vi.waitFor(() => expect(reloaded).toEqual([FLOW_RESULTS_FRAME]));
		await vi.waitFor(() => expect(document.body.textContent).toContain("Latest run"));
	});

	test("leaves the cards alone when the run was refused", async () => {
		server.use(
			http.post(`*${RUN_ACTION}`, () =>
				HttpResponse.json({ ...PASSED_RUN, status: null, reason: "Disabled" }),
			),
		);
		let form = await mount();

		form.requestSubmit();

		await vi.waitFor(() =>
			expect(form.querySelector("button")?.hasAttribute("disabled")).toBe(false),
		);
		expect(reloaded).toEqual([]);
	});
});
