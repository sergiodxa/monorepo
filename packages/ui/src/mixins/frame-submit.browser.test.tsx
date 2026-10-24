/**
 * Tests for {@link "./frame-submit"} against a real frame runtime: a submission posts through
 * the frame in one request, honors its submitter, reports its states, and returns the frame
 * to its own address unless asked to adopt the action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime, FrameHandle, Handle, ResolveFrameOptions } from "remix/component";

import { clientEntry, Frame, run } from "remix/component";
import { renderToStream, renderToString } from "remix/component/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { FrameSubmit } from "./frame-submit.js";

import { frameSubmit } from "./frame-submit.js";

/** The address the frame loads its own content from. */
const FRAME_SRC = "/frames/rename";

let app: AppRuntime | undefined;

/**
 * The frame the hydrated island renders in. Server passes render the island too, under a
 * stand-in frame with no address, so only a frame with an address is captured.
 */
let frame: FrameHandle | undefined;

/** Every request the frame made, oldest first. */
let requested: Array<{ src: string; options?: ResolveFrameOptions }> = [];

/** Answers that wait until the test releases them. */
let held: ReturnType<typeof Promise.withResolvers<void>> | undefined;

/** Whether the next answer fails the way a server error does. */
let failing = false;

/** The options the island under test applies, set per test before it hydrates. */
let applied: FrameSubmit.Options | undefined;

afterEach(() => {
	app?.dispose();
	app = undefined;
	frame = undefined;
	document.body.innerHTML = "";
	requested = [];
	held = undefined;
	failing = false;
	applied = undefined;
});

/** The island under test: a rename form in the frame it submits into. */
const ISLAND = clientEntry(
	"/frame-submit-island.tsx#FrameSubmitIsland",
	function FrameSubmitIsland(handle: Handle<Record<string, never>>) {
		if (handle.frame.src) frame = handle.frame;
		return () => (
			<form method="post" action="/actions/rename" mix={[frameSubmit(applied)]}>
				<input name="name" required defaultValue="Ada" />
				<button type="submit">Save</button>
				<button type="submit" formAction="/actions/archive" formMethod="get">
					Archive
				</button>
			</form>
		);
	},
);

/** Hydrates the island inside a frame that records each request and answers with the island. */
async function mount(options?: FrameSubmit.Options): Promise<{
	form: HTMLFormElement;
	states: Array<string>;
}> {
	applied = options;
	document.body.innerHTML = await new Response(
		renderToStream(<Frame src={FRAME_SRC} />, { resolveFrame: () => renderToString(<ISLAND />) }),
	).text();
	app = run({
		loadModule: () => ISLAND,
		resolveFrame: async (src, options) => {
			requested.push({ src, options });
			await held?.promise;
			if (failing) throw new Error("Failed to resolve frame: 500");
			return renderToString(<ISLAND />);
		},
	});
	await app.ready();
	let form = document.querySelector("form") as HTMLFormElement;
	let states: Array<string> = [];
	form.addEventListener("ui:frame-submit", (event) => states.push(event.state));
	return { form, states };
}

/** The fields a request carried, as plain entries. */
function fields(options?: ResolveFrameOptions): Array<[string, string]> {
	return Array.from(options?.formData ?? [], ([name, value]) => [
		name,
		typeof value === "string" ? value : value.name,
	]);
}

describe(frameSubmit.name, () => {
	test("posts the form through its frame and keeps the frame's own address", async () => {
		let { form, states } = await mount();

		form.requestSubmit();

		await vi.waitFor(() => expect(states).toEqual(["pending", "settled"]));
		expect(requested).toHaveLength(1);
		expect(new URL(requested[0]?.src ?? "", document.baseURI).pathname).toBe("/actions/rename");
		expect(requested[0]?.options?.method).toBe("post");
		expect(requested[0]?.options?.encType).toBe("application/x-www-form-urlencoded");
		expect(fields(requested[0]?.options)).toEqual([["name", "Ada"]]);
		expect(frame?.src).toBe(FRAME_SRC);
	});

	test("adopts the action as the frame's address when keepSrc is false", async () => {
		let { form, states } = await mount({ keepSrc: false });

		form.requestSubmit();

		await vi.waitFor(() => expect(states).toEqual(["pending", "settled"]));
		expect(new URL(frame?.src ?? "", document.baseURI).pathname).toBe("/actions/rename");
	});

	test("applies the submitter's action and method", async () => {
		let { form, states } = await mount();
		let archive = form.querySelectorAll("button")[1] as HTMLButtonElement;

		form.requestSubmit(archive);

		await vi.waitFor(() => expect(states).toEqual(["pending", "settled"]));
		let url = new URL(requested[0]?.src ?? "", document.baseURI);
		expect(url.pathname).toBe("/actions/archive");
		expect(url.searchParams.get("name")).toBe("Ada");
		expect(requested[0]?.options?.formData).toBeUndefined();
		expect(frame?.src).toBe(FRAME_SRC);
	});

	test("marks the form busy until the answer renders", async () => {
		let { form, states } = await mount();
		held = Promise.withResolvers<void>();

		form.requestSubmit();
		await vi.waitFor(() => expect(requested).toHaveLength(1));
		expect(form.getAttribute("aria-busy")).toBe("true");

		held.resolve();
		await vi.waitFor(() => expect(states).toEqual(["pending", "settled"]));
		expect(document.querySelector("form")?.hasAttribute("aria-busy")).toBe(false);
	});

	test("sends nothing while the form is invalid", async () => {
		let { form, states } = await mount();
		(form.querySelector("input") as HTMLInputElement).value = "";

		form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

		expect(states).toEqual([]);
		expect(requested).toEqual([]);
	});

	test("reports a failed answer and clears the busy state", async () => {
		let { form, states } = await mount();
		failing = true;

		form.requestSubmit();

		await vi.waitFor(() => expect(states).toEqual(["pending", "failed"]));
		expect(form.hasAttribute("aria-busy")).toBe(false);
		expect(frame?.src).toBe(FRAME_SRC);
	});
});
