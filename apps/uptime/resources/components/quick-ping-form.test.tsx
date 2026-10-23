// @vitest-environment happy-dom

/**
 * Tests for the quick-check form hydrated inside the dashboard bar's frame: a submission goes
 * out once, through that frame and named after it, as the POST the run-ping action reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime, ResolveFrameOptions } from "remix/component";

import { Frame, run } from "remix/component";
import { renderToStream, renderToString } from "remix/component/server";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { QuickPingForm } from "./quick-ping-form";

/** Where the form posts its check. */
const RUN_PING_ACTION = "/actions/acme/run-ping";

/** The bar's frame name, which the action reads to answer with the bar. */
const FRAME_NAME = "dashboard-quick-ping";

let app: AppRuntime | undefined;

/** Every request the bar's frame made after hydrating, oldest first. */
let requested: Array<{ src: string; options?: ResolveFrameOptions }> = [];

beforeAll(() => {
	/** The test document's style sheet cannot parse the layered rules `css()` writes. */
	vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => 0);
});

afterEach(() => {
	app?.dispose();
	app = undefined;
	document.body.innerHTML = "";
	requested = [];
});

/** The bar's content, as the quick-check fragment renders it. */
function bar() {
	return renderToString(
		<QuickPingForm
			action={RUN_PING_ACTION}
			label="URL to check"
			placeholder="https://example.com"
			description="Checks a URL once."
			submit="Check"
		/>,
	);
}

/** Hydrates the form inside the bar's named frame, which records and answers each request. */
async function mount(): Promise<HTMLFormElement> {
	document.body.innerHTML = await new Response(
		renderToStream(<Frame name={FRAME_NAME} src="/app/acme/dashboard/quick-ping" />, {
			resolveFrame: bar,
		}),
	).text();
	app = run({
		loadModule: () => QuickPingForm,
		resolveFrame: (src, options) => {
			requested.push({ src, options });
			return bar();
		},
	});
	await app.ready();
	return document.querySelector("form") as HTMLFormElement;
}

describe("QuickPingForm", () => {
	test("posts the check through the bar's frame in one request", async () => {
		let form = await mount();
		(form.querySelector("input[name=url]") as HTMLInputElement).value = "https://example.com";

		form.requestSubmit();

		await vi.waitFor(() => expect(requested).toHaveLength(1));
		let [request] = requested;
		expect(new URL(request?.src ?? "", document.baseURI).pathname).toBe(RUN_PING_ACTION);
		expect(request?.options?.target).toBe(FRAME_NAME);
		expect(request?.options?.method).toBe("post");
		expect(request?.options?.formData?.get("url")).toBe("https://example.com");
	});
});
