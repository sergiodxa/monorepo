/**
 * The `sdxc` command line as a contract: every command, its arguments and its flags, with the
 * prompts that fill them on a terminal. Help, usage errors and each handler's typed
 * `ctx.arguments` and `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag, prompt } from "@sdxc/cli";
import * as s from "remix/data-schema";

import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE } from "./create/templates.js";
import { KINDS } from "./make/kinds.js";

/** Route methods `make controller --method` accepts; `form` declares a GET page with a POST action. */
export const METHODS = ["get", "post", "put", "patch", "delete", "form"] as const;

/** Every kind `sdxc make` writes, in the order its help lists them. */
const KIND_NAMES = Object.keys(KINDS) as [keyof typeof KINDS, ...(keyof typeof KINDS)[]];

/** Text that holds at least one character, so an empty answer keeps a prompt open. */
function nonEmpty(message: string) {
	return s.string().refine((value) => value.trim() !== "", message);
}

/**
 * The `<name>` of a `make` kind, asked for on a terminal when it is left out.
 *
 * @param kind - The kind, as the question names it
 * @param placeholder - An example name, shown dimmed while the answer is empty
 */
function nameArgument(kind: string, placeholder: string) {
	return argument(nonEmpty("Name it"), {
		description: "The file's name; a slash makes a folder inside the kind's folder",
		prompt: prompt.text({ message: `What should the ${kind} be called?`, placeholder }),
	});
}

/**
 * `--test` / `--no-test`, shared by every kind that writes a test beside its file; unset, it
 * takes `make.tests`.
 */
const TEST_FLAG = flag.boolean("test", {
	default: undefined,
	description: "Write a test beside the file, or skip it with --no-test (default: make.tests)",
});

/** `--dry-run`, shared by every command that can print what it would write instead. */
const DRY_RUN_FLAG = flag.boolean("dry-run", {
	description: "Print what would be written and change nothing",
});

/** Every command `sdxc` takes. */
export const SDXC_COMMANDS = commands({
	create: command({
		description: "Write a new project from a built-in template or a GitHub repository",
		arguments: {
			directory: argument(nonEmpty("Name a directory, or . for this one"), {
				optional: true,
				description:
					"Where to write it, missing or empty apart from .git; the current directory when left out",
				prompt: prompt.text({ message: "Where should the project go?", placeholder: "my-app" }),
			}),
		},
		flags: {
			template: flag.string("template", {
				default: DEFAULT_TEMPLATE,
				valueName: "template",
				description: "A built-in template, or a GitHub repository as org/repo[/path][#ref]",
				prompt: prompt.select({
					message: "Which template?",
					options: BUILTIN_TEMPLATES,
					ask: "always",
				}),
			}),
			git: flag.boolean("git", {
				default: undefined,
				description: "Initialize a git repository without asking, or skip it with --no-git",
			}),
		},
		tasks: true,
		examples: ["create blog", "create blog --template org/repo/apps/blog#main --no-git"],
	}),
	init: command({
		description: "Write .config/sdxc.jsonc with every default spelled out",
		flags: { dryRun: flag.boolean("dry-run", { description: "Print it and write nothing" }) },
	}),
	make: commands({
		description: "Write a controller, job, model or other file where the app layout puts it",
		arguments: {
			kind: argument(s.enum_(KIND_NAMES), {
				description: "What to write; each kind is also a command with its own flags",
				prompt: prompt.select({ message: "What should sdxc make?", options: KIND_NAMES }),
			}),
			name: argument(nonEmpty("Name it"), {
				description: "The file's name; a slash makes a folder inside the kind's folder",
				prompt: prompt.text({ message: "What should it be called?" }),
			}),
		},
		flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		tasks: true,
		controller: command({
			description: "A route handler in app/http/controllers, declared and mapped",
			tasks: true,
			arguments: { name: nameArgument("controller", "admin/users") },
			flags: {
				method: flag.string("method", {
					default: "get",
					valueName: "method",
					schema: s.enum_(METHODS),
					description: METHODS.join(", "),
					prompt: prompt.select({ message: "Which method?", options: METHODS, ask: "always" }),
				}),
				path: flag.string("path", {
					valueName: "path",
					description: "The route's pattern (default: /<name>)",
				}),
				routes: flag.string("routes", {
					valueName: "contract",
					description: "The route contract in routes/ (default: make.routes)",
				}),
				test: TEST_FLAG,
				dryRun: DRY_RUN_FLAG,
			},
			examples: ["make controller ping --method post --path /api/ping"],
		}),
		middleware: command({
			description: "A middleware in app/http/middleware",
			tasks: true,
			arguments: { name: nameArgument("middleware", "require-user") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		}),
		validator: command({
			description: "An input validator in app/http/validators",
			tasks: true,
			arguments: { name: nameArgument("validator", "signup") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		}),
		job: command({
			description: "A background job in app/jobs, declared and mapped",
			tasks: true,
			arguments: { name: nameArgument("job", "trials/expire") },
			flags: {
				cron: flag.string("cron", {
					valueName: "expression",
					description: "A scheduled job instead of one with input",
				}),
				test: TEST_FLAG,
				dryRun: DRY_RUN_FLAG,
			},
			examples: ['make job digest --cron "0 8 * * *"'],
		}),
		model: command({
			description: "A model in app/models",
			tasks: true,
			arguments: { name: nameArgument("model", "post") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		}),
		migration: command({
			description: "A numbered SQL migration in a configured chain",
			tasks: true,
			arguments: { name: nameArgument("migration", "create-posts") },
			flags: {
				chain: flag.string("chain", {
					valueName: "chain",
					description: "The chain in make.migrations (default: default)",
				}),
				dryRun: DRY_RUN_FLAG,
			},
		}),
		factory: command({
			description: "A test factory in database/factories",
			tasks: true,
			arguments: { name: nameArgument("factory", "post") },
			flags: { dryRun: DRY_RUN_FLAG },
		}),
		service: command({
			description: "A service in app/services",
			tasks: true,
			arguments: { name: nameArgument("service", "billing/charge") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		}),
		policy: command({
			description: "An authorization policy in app/policies",
			tasks: true,
			arguments: { name: nameArgument("policy", "can-edit") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		}),
		initializer: command({
			description: "An initializer in app/initializers",
			tasks: true,
			arguments: { name: nameArgument("initializer", "cache") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		}),
		email: command({
			description: "An email template in app/emails",
			tasks: true,
			arguments: { name: nameArgument("email", "welcome") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG },
		}),
		mcp: command({
			description: "An MCP tool in app/mcp/tools, or a resource, declared and mapped",
			tasks: true,
			arguments: { name: nameArgument("tool", "get-post") },
			flags: {
				resource: flag.boolean("resource", {
					description: "A resource in app/mcp/resources instead of a tool",
				}),
				test: TEST_FLAG,
				dryRun: DRY_RUN_FLAG,
			},
		}),
		stubs: command({
			description: "Copy the built-in stubs into make.stubs to edit",
			arguments: {
				kinds: argument.variadic(s.enum_(KIND_NAMES), {
					valueName: "kind",
					description: "The kinds whose stubs to copy; every kind when left out",
				}),
			},
		}),
	}),
	ui: commands({
		description: "Copy @sdxc/ui components into the project and keep imports on the copies",
		list: command({ description: "Every component, marking copies that are edited or behind" }),
		add: command({
			description: "Copy components and point the project's imports at the copies",
			tasks: true,
			arguments: {
				components: argument.variadic(s.string(), {
					valueName: "component",
					description: "The components to copy; asked for on a terminal when left out",
				}),
			},
			flags: {
				withDeps: flag.boolean("with-deps", {
					description: "Also copy every component they reach through others",
				}),
				dryRun: DRY_RUN_FLAG,
			},
		}),
		diff: command({
			description: "Show how a copy differs from the installed version",
			arguments: { component: argument(s.string()) },
		}),
		update: command({
			description: "Replace copied files with the installed version",
			tasks: true,
			arguments: {
				components: argument.variadic(s.string(), { min: 1, valueName: "component" }),
			},
			flags: {
				force: flag.boolean("force", { description: "Replace edited files without asking" }),
				dryRun: DRY_RUN_FLAG,
			},
		}),
		remove: command({
			description: "Delete copies and point imports back at sdxc/ui/<name>",
			tasks: true,
			arguments: {
				components: argument.variadic(s.string(), {
					valueName: "component",
					description: "The copies to delete; asked for on a terminal when left out",
				}),
			},
			flags: { dryRun: DRY_RUN_FLAG },
		}),
	}),
	upgrade: command({
		description: "Move to another sdxc release and print the prompt for the code",
		tasks: true,
		arguments: {
			version: argument(s.string(), {
				optional: true,
				description: "The sdxc release to move to; the latest when left out",
			}),
		},
		flags: {
			install: flag.boolean("install", {
				default: true,
				description: "Change package.json only and print the commands to run next",
			}),
			output: flag.string("output", {
				valueName: "file",
				description: "Write the prompt to a file instead of stdout",
			}),
			prompt: flag.boolean("prompt", {
				description: "Print the prompt for the installed sdxc only; needs --from",
			}),
			from: flag.string("from", {
				valueName: "version",
				description: "The sdxc release the project moved from, with --prompt",
			}),
			remixFrom: flag.string("remix-from", {
				valueName: "version",
				description: "The remix version the project moved from, with --prompt",
			}),
		},
	}),
});
