/**
 * `sdxc make email` end to end in the app template: the fields become the props the email
 * declares, the template renders and previews, and the test renders through the registry the
 * template maps, so the project type checks and its tests pass straight after `make`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke as invokeCLI } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";
import { REGISTRY } from "../releases.js";
import { materialize, projectExec, registryDocument, testProject, typecheck } from "../testing.js";

/** The npm registry `create` pins `@sdxc/*` packages from: every one at 2026.10.14. */
const SERVER = setupServer(
	http.get(`${REGISTRY}/*`, ({ request }) =>
		HttpResponse.json(registryDocument(new URL(request.url).pathname.slice(1), ["2026.10.14"])),
	),
);

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterAll(() => SERVER.close());

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Runs `sdxc make <argv>` in `cwd`, without a terminal. */
function make(argv: string[], cwd: string, options: InvokeOptions = {}) {
	return invokeCLI(createSDXC(), ["make", ...argv], { cwd, interactive: false, ...options });
}

/** A project with the email registry's declarations and initializer, and nothing else. */
async function bareProject(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-make-email-"));
	DIRECTORIES.push(root);
	await writeFile(join(root, "package.json"), '{ "name": "@acme/app" }\n');
	return root;
}

describe("make email", () => {
	test(
		"declares the fields as props, maps the template, and leaves a project that passes",
		{ timeout: 240_000 },
		async () => {
			let root = unwrap(await materialize("app"));
			DIRECTORIES.push(dirname(root));
			let options = { exec: projectExec(root), env: { PATH: process.env.PATH ?? "" } };

			let welcome = await make(["email", "welcome"], root, options);
			let invite = await make(
				["email", "teams/invite", "team", "invite_url", "contact_email", "expires_on?", "is_admin"],
				root,
				options,
			);

			expect(welcome.code, welcome.stderr).toBe(0);
			expect(invite.code, invite.stderr).toBe(0);
			expect(invite.stdout).not.toContain("by hand");
			let read = (path: string) => readFile(join(root, path), "utf8");
			let declarations = await read("app/emails/index.ts");
			expect(declarations).toContain('import * as s from "remix/data-schema";');
			expect(declarations).toContain("welcome: email({");
			expect(declarations).toContain("heading: s.string(),");
			expect(declarations).toContain("teams: {");
			expect(declarations).toContain("inviteUrl: s.string(),");
			expect(declarations).toContain("expiresOn: s.optional(s.string()),");
			expect(declarations).toContain("isAdmin: s.boolean(),");
			let initializer = await read("app/initializers/mail.ts");
			expect(initializer).toContain('import { createMail, lazy } from "@sdxc/mail";');
			expect(initializer).toContain('import emails from "~/app/emails";');
			expect(initializer).toMatch(
				/mail\.map\(\s*emails\.teams\.invite,\s*lazy\(\(\) => import\("~\/app\/emails\/teams\/invite"\)\),?\s*\);/,
			);
			let template = await read("app/emails/teams/invite.tsx");
			expect(template).toContain("createEmail(emails.teams.invite, {");
			expect(template).toContain("subject: ({ team }) => team,");
			expect(template).toContain("<Email.Button href={handle.props.inviteUrl}>");
			expect(template).toContain("preview: () => ({");

			let checked = await typecheck(root);
			expect(checked.code, checked.output).toBe(0);
			let tested = await testProject(root);
			expect(tested.code, tested.output).toBe(0);
		},
	);

	test("refuses a field that describes a table, writing nothing", async () => {
		let root = await bareProject();

		let reference = await make(["email", "invite", "team_id"], root);
		let unique = await make(["email", "invite", "code:unique"], root);

		expect(reference.code).not.toBe(0);
		expect(reference.stderr).toContain("references a table");
		expect(unique.code).not.toBe(0);
		expect(unique.stderr).toContain("indexes a column");
	});

	test("prints the declaration and mapping to make by hand without a registry", async () => {
		let root = await bareProject();

		let made = await make(["email", "welcome", "name"], root);

		expect(made.code).toBe(0);
		expect(made.stdout).toContain("no initializer in app/initializers/ creates the email registry");
		expect(made.stdout).toContain("props: s.object({");
		expect(made.stdout).toContain(
			'mail.map(emails.welcome, lazy(() => import("~/app/emails/welcome")));',
		);
	});
});
