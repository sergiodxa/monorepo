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
import { DEPLOY_STEPS } from "./deploy/plan.js";
import {
	ACTION_NAMES,
	DESTROY_KINDS,
	KINDS,
	MODEL_COMPANIONS,
	SCAFFOLD_PIECES,
} from "./make/kinds.js";
import { DEFAULT_TAGS } from "./notes.js";
import { ROUTE_SORTS } from "./routes/filter.js";
import { FIELD_TYPE_NAMES } from "./scaffold/fields.js";

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
 * The fields `make model` and `scaffold` take, each typed by convention from its name unless it
 * names a type; `scaffold` writes pages for every type but a reference.
 */
function fieldsArgument(references: boolean) {
	let types = FIELD_TYPE_NAMES.filter((type) => references || type !== "references");
	let reference = references ? ", *_id references" : "";
	return argument.variadic(s.string(), {
		valueName: "field[:type][?]",
		description: `name, name:type or name? (nullable), each with :index or :unique to index the column; a bare name is typed by convention: *_at timestamp, *_on date, is_* and published boolean, *_count integer, email, *_url url, body text${reference}, else string; types: ${types.join(", ")}`,
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

/**
 * `--spec` / `--no-spec`, for kinds that write a pairing `.spec` under `spec/`; unset, it takes
 * `make.specs`.
 */
const SPEC_FLAG = flag.boolean("spec", {
	default: undefined,
	description: "Write a pairing .spec under spec/, or skip it with --no-spec (default: make.specs)",
});

/** `--dry-run`, shared by every command that can print what it would write instead. */
const DRY_RUN_FLAG = flag.boolean("dry-run", {
	description: "Print what would be written and change nothing",
});

/**
 * `--force`, shared by every kind whose file takes its own name: an existing file, its test and
 * its pairing `.spec` are replaced, and the declaration and mapping they already have are kept.
 */
const FORCE_FLAG = flag.boolean("force", {
	description:
		"Replace the file, its test and its pairing .spec when they exist, keeping their declaration",
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
	deploy: command({
		description: "Build, then run the app's db migrate --remote and deploy commands",
		flags: {
			yes: flag.boolean("yes", {
				short: "y",
				description: "Deploy without asking; required without a terminal",
			}),
			dryRun: flag.boolean("dry-run", {
				description: "Build and print the plan; migrate and deploy nothing",
			}),
			skip: flag
				.string("skip", {
					valueName: "step",
					schema: s.enum_(DEPLOY_STEPS),
					description: "Leave out build, migrate or deploy; repeat it or list them",
				})
				.list(),
		},
		examples: [
			"deploy",
			"deploy --dry-run",
			"deploy --yes --skip build",
			"deploy --skip build --skip migrate",
		],
	}),
	destroy: command({
		description:
			"Remove a file sdxc make wrote, its test, its pairing .spec, its mapping and its declaration",
		arguments: {
			kind: argument(s.enum_(DESTROY_KINDS), {
				description: "What to remove; every make kind but migration and policy",
			}),
			name: argument(nonEmpty("Name it"), {
				description: "The name it was made with",
			}),
		},
		flags: {
			yes: flag.boolean("yes", {
				short: "y",
				description: "Remove without asking; required without a terminal",
			}),
			dryRun: DRY_RUN_FLAG,
			resource: flag.boolean("resource", {
				description: "With mcp, a resource in app/mcp/resources instead of a tool",
			}),
		},
		examples: [
			"destroy controller posts/archive",
			"destroy job digest --dry-run",
			"destroy model post --yes",
		],
	}),
	doctor: command({
		description: "Lint release drift, secrets, migrations, app layout and project checks",
		flags: {
			json: flag.boolean("json", { description: "Print the report as JSON for an agent" }),
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
	init: command({
		description: "Write .config/sdxc.jsonc with every default spelled out",
		flags: { dryRun: flag.boolean("dry-run", { description: "Print it and write nothing" }) },
	}),
	initializers: command({
		description: "List the initializers in app/initializers, their exports and what builds them",
		flags: { json: flag.boolean("json", { description: "Print a JSON array instead of a table" }) },
		examples: ["initializers", "initializers --json"],
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
		flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
		tasks: true,
		controller: command({
			description: "A route handler in app/http/controllers, declared and mapped",
			tasks: true,
			arguments: { name: nameArgument("controller", "admin/users") },
			flags: {
				method: flag.string("method", {
					valueName: "method",
					schema: s.enum_(METHODS),
					description: `${METHODS.join(", ")}; asked on a terminal (default: get)`,
				}),
				path: flag.string("path", {
					valueName: "path",
					description: "The route's pattern (default: /<name>)",
				}),
				routes: flag.string("routes", {
					valueName: "contract",
					description: "The route contract in routes/ (default: make.routes)",
				}),
				resource: flag.string("resource", {
					valueName: "name",
					description:
						"Check the resource's ability the method implies (get reads, form and post create, put and patch update, delete deletes); a read, update or delete route takes /<name>/:id",
				}),
				actions: flag
					.string("actions", {
						valueName: "action",
						schema: s.enum_(ACTION_NAMES),
						description:
							"One controller per action under <name>: index, new, show, edit and destroy pages, or with --routes api index, show, create, update and destroy endpoints; all writes each",
					})
					.list(),
				test: TEST_FLAG,
				spec: SPEC_FLAG,
				dryRun: DRY_RUN_FLAG,
				force: FORCE_FLAG,
			},
			examples: [
				"make controller api/keys --routes api",
				"make controller ping --method post",
				"make controller posts/archive --resource post --method delete",
				"make controller posts --actions all --resource post",
			],
		}),
		middleware: command({
			description: "A middleware in app/http/middleware",
			tasks: true,
			arguments: { name: nameArgument("middleware", "require-user") },
			flags: {
				mount: flag.string("mount", {
					valueName: "target",
					description:
						"Also call it last in a chain: a router initializer (router) or a chain module (page, api)",
				}),
				test: TEST_FLAG,
				dryRun: DRY_RUN_FLAG,
				force: FORCE_FLAG,
			},
			examples: ["make middleware require-user --mount page"],
		}),
		validator: command({
			description: "An input validator in app/http/validators",
			tasks: true,
			arguments: { name: nameArgument("validator", "signup") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
		}),
		job: command({
			description: "A background job in app/jobs, declared and mapped",
			tasks: true,
			arguments: { name: nameArgument("job", "trials/expire") },
			flags: {
				cron: flag.string("cron", {
					valueName: "expression",
					description:
						"A scheduled job instead of one with input, with the Worker trigger that fires it",
				}),
				test: TEST_FLAG,
				dryRun: DRY_RUN_FLAG,
				force: FORCE_FLAG,
			},
			examples: ['make job digest --cron "0 8 * * *"'],
		}),
		model: command({
			description: "A model in app/models, with the migration creating its table and its factory",
			tasks: true,
			arguments: { name: nameArgument("model", "post"), fields: fieldsArgument(true) },
			flags: {
				chain: flag.string("chain", {
					valueName: "chain",
					description: "The chain in make.migrations the migration goes in (default: default)",
				}),
				skip: flag
					.string("skip", {
						valueName: "file",
						schema: s.enum_(MODEL_COMPANIONS),
						description: "Leave out the migration or the factory; repeat it or list them",
					})
					.list(),
				test: TEST_FLAG,
				dryRun: DRY_RUN_FLAG,
				force: FORCE_FLAG,
			},
			examples: [
				"make model post title body published_at author_id",
				"make model post title 'subtitle?' views:integer",
				"make model post title --skip migration,factory",
			],
		}),
		migration: command({
			description: "A numbered SQL migration in a configured chain",
			tasks: true,
			arguments: {
				name: nameArgument("migration", "create-posts"),
				fields: argument.variadic(s.string(), {
					valueName: "field[:type][?]",
					description:
						"Columns, typed as make model types them, for a name create-<table>, add-<columns>-to-<table> or remove-<columns>-from-<table>; an added column needs ? unless it is a boolean",
				}),
			},
			flags: {
				chain: flag.string("chain", {
					valueName: "chain",
					description: "The chain in make.migrations (default: default)",
				}),
				fromModel: flag.string("from-model", {
					valueName: "model",
					description: "Write the SQL that brings the chain in step with app/models/<model>.ts",
				}),
				dryRun: DRY_RUN_FLAG,
			},
			examples: [
				"make migration create-posts title body published_at author_id",
				"make migration add-slug-to-posts 'slug?' featured",
				"make migration remove-slug-from-posts slug",
				"make migration sync-posts --from-model post",
			],
		}),
		factory: command({
			description: "A test factory in database/factories",
			tasks: true,
			arguments: { name: nameArgument("factory", "post") },
			flags: { dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
		}),
		service: command({
			description: "A service in app/services",
			tasks: true,
			arguments: { name: nameArgument("service", "billing/charge") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
		}),
		policy: command({
			description:
				"A resource's create, read, update and delete abilities in app/policies, with their test",
			tasks: true,
			arguments: { name: nameArgument("policy", "post") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
		}),
		initializer: command({
			description: "An initializer in app/initializers",
			tasks: true,
			arguments: { name: nameArgument("initializer", "cache") },
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
		}),
		email: command({
			description: "An email template in app/emails, its props declared and the template mapped",
			tasks: true,
			arguments: {
				name: nameArgument("email", "welcome"),
				fields: argument.variadic(s.string(), {
					valueName: "field[:type][?]",
					description:
						"Props, typed as make model types them, each optional with ?; the first text prop is the subject and heading; none declares heading and body",
				}),
			},
			flags: { test: TEST_FLAG, dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
			examples: ["make email welcome", "make email teams/invite team invite_url 'expires_on?'"],
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
				spec: SPEC_FLAG,
				dryRun: DRY_RUN_FLAG,
				force: FORCE_FLAG,
			},
		}),
		command: command({
			description: "A command-line command in app/commands, declared and mapped",
			tasks: true,
			arguments: { name: nameArgument("command", "users/grant") },
			flags: { test: TEST_FLAG, spec: SPEC_FLAG, dryRun: DRY_RUN_FLAG, force: FORCE_FLAG },
			examples: ["make command users/grant"],
		}),
		test: command({
			description: "The test make writes beside a file, for an existing file without one",
			tasks: true,
			arguments: {
				file: argument(nonEmpty("Name the file"), {
					valueName: "file",
					description: "The file to test, such as app/services/billing/charge.ts",
					prompt: prompt.text({
						message: "Which file needs a test?",
						placeholder: "app/services/billing/charge.ts",
					}),
				}),
			},
			flags: {
				dryRun: DRY_RUN_FLAG,
				force: flag.boolean("force", { description: "Replace the test when it exists" }),
			},
			examples: ["make test app/services/billing/charge.ts"],
		}),
		stubs: command({
			description: "Copy the built-in stubs into make.stubs to edit",
			arguments: {
				kinds: argument.variadic(s.enum_([...KIND_NAMES, "scaffold"]), {
					valueName: "kind",
					description: "The kinds whose stubs to copy, or scaffold; every one when left out",
				}),
			},
		}),
	}),
	middleware: command({
		description: "Print each router's global middleware and every chain in app/http/middleware",
		flags: { json: flag.boolean("json", { description: "Print the chains as JSON" }) },
		examples: ["middleware", "middleware --json"],
	}),
	models: command({
		description: "Print each model's table and whether the migrations create it, from app/models",
		tasks: false,
		arguments: {
			names: argument.variadic(s.string(), {
				valueName: "model",
				description:
					"The models to print in full, as sdxc make model names them; every one listed when left out",
			}),
		},
		flags: { json: flag.boolean("json", { description: "Print the models as JSON" }) },
		examples: ["models", "models post", "models post comment --json"],
	}),
	notes: command({
		description: "List the TODO, FIXME, HACK and OPTIMIZE comments in the app's code",
		flags: {
			tag: flag
				.string("tag", {
					valueName: "tag",
					description: `The tags to list instead of ${DEFAULT_TAGS.join(", ")}; repeat it or list them`,
				})
				.multiple()
				.list(),
			json: flag.boolean("json", { description: "Print a JSON array instead of a list" }),
		},
		examples: ["notes", "notes --tag TODO", "notes --tag TODO,REVIEW --json"],
	}),
	routes: command({
		description: "Print every route with its controller and the middleware that runs for it",
		flags: {
			json: flag.boolean("json", { description: "Print a JSON array instead of a table" }),
			expanded: flag.boolean("expanded", {
				short: "E",
				description: "Print one block per route with every field, for a narrow terminal",
			}),
			grep: flag.string("grep", {
				short: "g",
				valueName: "pattern",
				description: "Keep routes whose name, pattern, method or controller matches",
			}),
			controller: flag.string("controller", {
				short: "c",
				valueName: "path",
				description: "Keep routes of a controller file or folder, as posts or posts/show",
			}),
			method: flag.string("method", {
				valueName: "method",
				description: "Keep routes answering a method; ANY routes answer every one",
			}),
			contract: flag.string("contract", {
				valueName: "contract",
				description: "Keep routes declared in a contract in routes/, as web",
			}),
			unused: flag.boolean("unused", {
				description: "Keep routes no router maps, and report controllers no route maps",
			}),
			exceptPath: flag
				.string("except-path", {
					valueName: "path",
					description: "Leave out routes under a path, as /api or /mcp; repeat it or list them",
				})
				.multiple()
				.list(),
			sort: flag.string("sort", {
				valueName: "field",
				schema: s.enum_(ROUTE_SORTS),
				description: `Order routes by ${ROUTE_SORTS.join(", ")} instead of declaration order`,
			}),
		},
		examples: [
			"routes",
			"routes --json",
			"routes -g posts",
			"routes -c admin/users --method post",
			"routes --unused",
			"routes --except-path /api,/mcp --sort pattern",
		],
	}),
	run: command({
		description: "Run the project's own command line, bootstrap/cli.ts, with its runtime",
		arguments: {
			args: argument.rest({
				valueName: "command",
				description: "The app's command and its arguments, passed through as typed",
			}),
		},
		examples: ["run users find ada@example.com --limit 5", "run --help"],
	}),
	scaffold: command({
		description: "Write a resource's model, migration, pages, tests and more, declared and mapped",
		tasks: true,
		arguments: {
			name: argument(nonEmpty("Name it"), {
				description: "The resource's singular name, such as post or blog-post",
				prompt: prompt.text({
					message: "What should the resource be called?",
					placeholder: "post",
				}),
			}),
			fields: fieldsArgument(false),
		},
		flags: {
			plural: flag.string("plural", {
				valueName: "word",
				description: "The plural the table, URLs and folders take (default: <name>s)",
			}),
			mcp: flag.boolean("mcp", {
				description: "Also write MCP tools to list, get, create, update and delete",
			}),
			command: flag.boolean("command", {
				description: "Also write app commands to list, show, create and delete",
			}),
			api: flag.boolean("api", {
				description:
					"JSON endpoints in routes/api.ts with their OpenAPI operations, instead of pages",
			}),
			skip: flag
				.string("skip", {
					valueName: "piece",
					schema: s.enum_(SCAFFOLD_PIECES),
					description: `Leave out pieces the project already has: ${SCAFFOLD_PIECES.join(", ")}; repeat it or list them`,
				})
				.list(),
			test: TEST_FLAG,
			spec: SPEC_FLAG,
			dryRun: DRY_RUN_FLAG,
		},
		examples: [
			"scaffold post title body published_at featured view_count:integer",
			"scaffold person name email website 'bio?' born_on --plural people --mcp --command",
			"scaffold post title body --skip model,migration,factory",
			"scaffold post title body --api",
		],
	}),
	schedule: command({
		description: "List the scheduled jobs, their next runs and the Worker triggers that fire them",
		flags: { json: flag.boolean("json", { description: "Print the schedule as JSON" }) },
		examples: ["schedule", "schedule --json"],
	}),
	stats: command({
		description: "Count lines of code per kind of code the app layout names, and the test ratio",
		flags: { json: flag.boolean("json", { description: "Print the counts as JSON" }) },
		examples: ["stats", "stats --json"],
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
				components: argument.variadic(s.string(), {
					valueName: "component",
					description: "The copies to update; --all updates every one instead",
				}),
			},
			flags: {
				all: flag.boolean("all", {
					description: "Update every copy, leaving edited files unless --force",
				}),
				withDeps: flag.boolean("with-deps", {
					description: "Also copy components the new versions reach and the project lacks",
				}),
				force: flag.boolean("force", { description: "Replace edited files without asking" }),
				dryRun: DRY_RUN_FLAG,
			},
			examples: ["ui update dialog", "ui update --all --dry-run"],
		}),
		remove: command({
			description: "Delete copies and point imports back at @sdxc/ui/<name>",
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
		description: "Move the @sdxc packages to another release and print the prompt for the code",
		tasks: true,
		arguments: {
			version: argument(s.string(), {
				optional: true,
				description: "The release to move to, a date such as 2026.10.14; the latest when left out",
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
				description: "Print the prompt for this release of @sdxc/kit only; needs --from",
			}),
			from: flag.string("from", {
				valueName: "version",
				description: "The release the project moved from, with --prompt",
			}),
			since: flag
				.string("since", {
					valueName: "package@version",
					description:
						"A package's own pinned release when it lagged behind --from, with --prompt; repeatable",
				})
				.multiple(),
			remixFrom: flag.string("remix-from", {
				valueName: "version",
				description: "The remix version the project moved from, with --prompt",
			}),
		},
	}),
});
