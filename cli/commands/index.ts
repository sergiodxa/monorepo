/**
 * Every command the monorepo command line answers: release, doctor, and the package/app
 * wiring commands. Handlers live beside this contract under `cli/commands/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import { argument, command, commands, flag } from "@sdxc/cli";

/** Accepts every token as typed text, without pulling remix into the monorepo CLI. */
const STRING: StandardSchemaV1<string, string> = {
	"~standard": {
		version: 1,
		vendor: "monorepo",
		validate: (value) => ({ value: String(value) }),
	},
};

/** The monorepo's commands; new ones are declared here and mapped in `cli/index.ts`. */
export default commands({
	doctor: command({
		description: "Run sdxc doctor from the workspace kit in every app under apps/",
		flags: {
			json: flag.boolean("json", { description: "Print each app's report as JSON" }),
			only: flag
				.string("only", { valueName: "check", description: "Run only the named checks" })
				.multiple()
				.list(),
			skip: flag
				.string("skip", { valueName: "check", description: "Leave out the named checks" })
				.multiple()
				.list(),
		},
		examples: ["doctor", "doctor --json", "doctor --only pins,remix", "doctor --skip ui"],
	}),
	release: commands({
		description: "Publish changed @sdxc packages under today's dated version, or bootstrap them",
		flags: {
			publish: flag.boolean("publish", {
				description: "Publish to npm and create the GitHub Release; dry-run without it",
			}),
			force: flag.boolean("force", {
				description: "Treat every public package as changed",
			}),
		},
		bootstrap: command({
			description: "First-publish packages npm has never seen as 0.0.0-pre.1 under the alpha tag",
			arguments: {
				packages: argument.variadic(STRING, {
					valueName: "package",
					description: "Package names such as @sdxc/hostname; every unpublished one when left out",
				}),
			},
			flags: {
				dryRun: flag.boolean("dry-run", {
					description: "Build and rehearse the publish without uploading",
				}),
			},
			examples: ["release bootstrap", "release bootstrap @sdxc/hostname --dry-run"],
		}),
	}),
	package: commands({
		description: "Create and wire shared packages under packages/",
		create: command({
			description: "Write the six minimum package files and wire the monorepo docs table",
			arguments: {
				name: argument(STRING, {
					valueName: "name",
					description: "Kebab-case directory and @sdxc/ suffix, such as hostname",
				}),
			},
			flags: {
				description: flag.string("description", {
					valueName: "text",
					description: "One-line description for package.json and the README",
				}),
				dryRun: flag.boolean("dry-run", {
					description: "Print what would be written and change nothing",
				}),
				force: flag.boolean("force", {
					description: "Replace the package directory when it already exists",
				}),
			},
			examples: [
				'package create hostname --description "Cloudflare for SaaS custom-hostname client"',
				"package create hostname --dry-run",
			],
		}),
	}),
	app: commands({
		description: "Wire apps created with sdxc create into this monorepo",
		register: command({
			description:
				"Add Vitest project, layout allowlist and deploy-workflow choice for an existing apps/<name>",
			arguments: {
				name: argument(STRING, {
					valueName: "name",
					description: "The app directory under apps/, such as demo",
				}),
			},
			flags: {
				dryRun: flag.boolean("dry-run", {
					description: "Print what would be edited and change nothing",
				}),
				converted: flag.boolean("converted", {
					default: true,
					description: "Also add the app to the layout-test allowlist (default: true)",
				}),
			},
			examples: [
				"app register demo",
				"app register demo --dry-run",
				"app register legacy --no-converted",
			],
		}),
	}),
});
