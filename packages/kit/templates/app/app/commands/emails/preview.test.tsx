/**
 * `emails preview`, run through the app's command line with a sample email mapped onto the
 * registry for this file alone.
 */

import { invoke } from "@sdxc/cli/test";
import { createEmail, Email, email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";
import { beforeAll, describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";
import { mail } from "~/app/initializers/mail";

/** The emails this test maps: one with a preview, one without. */
const SAMPLES = emails({
	sample: email({ props: s.object({ heading: s.string() }) }),
	bare: email({ props: s.object({}) }),
});

beforeAll(() => {
	mail.map(
		SAMPLES.sample,
		createEmail(SAMPLES.sample, {
			subject: ({ heading }) => heading,
			body: (handle) => () => (
				<Email.Layout lang={handle.props.locale} title={handle.props.heading}>
					<Email.Text>Rendered in {handle.props.locale}</Email.Text>
				</Email.Layout>
			),
			preview: () => ({ heading: "Sample heading" }),
		}),
	);
	mail.map(
		SAMPLES.bare,
		createEmail(SAMPLES.bare, { subject: () => "Bare", body: () => () => <p>Bare</p> }),
	);
});

describe("emails preview", () => {
	test("prints the subject and the text part rendered from the preview props", async () => {
		let run = await invoke(cli, ["emails", "preview", "sample", "--locale", "en"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(/^Subject: Sample heading\n\n[^]*Rendered in en\n$/);
	});

	test("--html prints the HTML document", async () => {
		let run = await invoke(cli, ["emails", "preview", "sample", "--html"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toContain('lang="en"');
	});

	test("fails for an email without a preview, and for one nothing maps", async () => {
		let bare = await invoke(cli, ["emails", "preview", "bare"]);
		let unmapped = await invoke(cli, ["emails", "preview", "billing.receipt"]);

		expect(bare.code).toBe(1);
		expect(bare.stderr).toContain("has no preview");
		expect(unmapped.code).toBe(1);
		expect(unmapped.stderr).toContain('"billing.receipt"');
	});
});
