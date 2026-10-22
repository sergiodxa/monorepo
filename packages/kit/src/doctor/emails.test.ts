/**
 * The `emails` check over fixture apps: declared emails mapped onto tested, previewable
 * templates pass, an email nothing maps fails, and a template without a test or without
 * `preview()` warns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vite-plus/test";

import { emailsCheck } from "./emails.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

/** A declarations module with a top-level email and a grouped one. */
const INDEX = [
	'import { email, emails } from "@sdxc/mail";',
	'import * as s from "remix/data-schema";',
	"export default emails({",
	"\t/** Greets a new account. */",
	"\twelcome: email({ props: s.object({ name: s.string() }) }),",
	"\tteams: {",
	"\t\tinvite: email({ props: s.object({ team: s.string() }) }),",
	"\t},",
	"});",
].join("\n");

/** An initializer mapping `names` lazily onto the templates beside the declarations. */
function initializer(entries: Record<string, string>): string {
	return [
		'import { createMail, lazy } from "@sdxc/mail";',
		'import emails from "~/app/emails";',
		"export const mail = createMail();",
		...Object.entries(entries).map(
			([name, file]) =>
				`mail.map(\n\temails.${name},\n\tlazy(() => import("~/app/emails/${file}")),\n);`,
		),
	].join("\n");
}

/**
 * A template module with a `preview` property, a `preview()` method, or none; its layout's
 * `preview` attribute is the preheader, which counts for nothing.
 */
function template(preview: "property" | "method" | "none"): string {
	return [
		'import { createEmail, Email } from "@sdxc/mail";',
		"export default createEmail(emails.welcome, {",
		"\tsubject: () => 'Hi',",
		'\tbody: () => () => <Email.Layout preview="Hi">Hi</Email.Layout>,',
		...(preview === "property" ? ["\tpreview: () => ({ name: 'Ada' }),"] : []),
		...(preview === "method" ? ["\tpreview() {", "\t\treturn { name: 'Ada' };", "\t},"] : []),
		"});",
	].join("\n");
}

describe("emailsCheck", () => {
	test("passes when every declared email is mapped onto a tested template with a preview", async () => {
		let context = await fixture({
			"app/emails/index.ts": INDEX,
			"app/initializers/mail.ts": initializer({
				welcome: "welcome",
				"teams.invite": "teams/invite",
			}),
			"app/emails/welcome.tsx": template("property"),
			"app/emails/welcome.test.tsx": "",
			"app/emails/teams/invite.tsx": template("method"),
			"app/emails/teams/invite.test.ts": "",
		});

		expect(await emailsCheck.run(context)).toMatchObject({ status: "pass", findings: [] });
	});

	test("fails on a declared email nothing maps", async () => {
		let context = await fixture({
			"app/emails/index.ts": INDEX,
			"app/initializers/mail.ts": initializer({ welcome: "welcome" }),
			"app/emails/welcome.tsx": template("property"),
			"app/emails/welcome.test.tsx": "",
		});

		let result = await emailsCheck.run(context);

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual([
			"teams.invite is declared in app/emails/index.ts and mapped by no template",
		]);
	});

	test("warns on a template without a test and on one without preview()", async () => {
		let context = await fixture({
			"app/emails/index.ts": INDEX,
			"app/initializers/mail.ts": initializer({
				welcome: "welcome",
				"teams.invite": "teams/invite",
			}),
			"app/emails/welcome.tsx": template("none"),
			"app/emails/welcome.test.tsx": "",
			"app/emails/teams/invite.tsx": template("property"),
		});

		let result = await emailsCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"app/emails/teams/invite.tsx has no test beside it",
			"app/emails/welcome.tsx has no preview()",
		]);
	});

	test("skips a project without email declarations", async () => {
		expect((await emailsCheck.run(await fixture({}))).status).toBe("skip");
		let other = await fixture({ "app/emails/index.ts": "export const SENDER = 'a@b.com';\n" });
		expect((await emailsCheck.run(other)).status).toBe("skip");
	});
});
