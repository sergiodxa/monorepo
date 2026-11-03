/**
 * The `sdxc-ci` command line as a contract: `run` a script, `list` what it would run, post an
 * earlier green run's `signoff`, `verify` a commit's signoff, and `clean` the stored runs. The
 * flag sets are exported so a tool wrapping this command line declares exactly the same flags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The two places a run can happen. */
const RUNNERS = ["local", "remote"] as const;

/** `--runner`, shared by `run` and `list`. */
const RUNNER_FLAG = flag.string("runner", {
	valueName: "runner",
	schema: s.enum_(RUNNERS),
	description: "local or remote: run as on a laptop or on a CI host; detected from the CI variable",
});

/** The filters `run` and `list` share. */
const FILTER_FLAGS = {
	only: flag
		.string("only", {
			valueName: "pattern",
			description: "Run only steps, groups or entries (Workspaces/@acme/ui) matching it; * spans /",
		})
		.multiple(),
	skip: flag
		.string("skip", {
			valueName: "pattern",
			description: "Leave out steps, groups or entries matching it",
		})
		.multiple(),
	scope: flag
		.string("scope", {
			valueName: "workspace",
			description: "Keep matrix entries for this workspace path or name and its dependents",
		})
		.multiple(),
	runner: RUNNER_FLAG,
};

/** `--token-env`, naming where the GitHub token is read from. */
const TOKEN_ENV_FLAG = flag.string("token-env", {
	valueName: "NAME",
	default: "GITHUB_TOKEN",
	description:
		"Environment variable holding the GitHub token; `gh auth token` answers when it is unset",
});

/** `--remote`, naming the git remote a signoff pushes to and reads the repository from. */
const REMOTE_FLAG = flag.string("remote", {
	valueName: "name",
	description:
		"Git remote to push to and read the GitHub repository from; the upstream's by default",
});

/** `--json`, shared by every command. */
const JSON_FLAG = flag.boolean("json", { description: "Print the report as JSON" });

/** Every flag `run` takes. */
export const RUN_FLAGS = {
	...FILTER_FLAGS,
	push: flag.boolean("push", {
		description: "After a green run, push the tested commit to its upstream branch, then sign off",
	}),
	signoff: flag.boolean("signoff", {
		default: true,
		description: "Make ci.signoff a plain success that posts nothing",
	}),
	cache: flag.boolean("cache", {
		default: true,
		description: "Run every step, ignoring passes stored for unchanged inputs",
	}),
	concurrency: flag.number("concurrency", {
		valueName: "n",
		schema: s.number().refine((n) => Number.isInteger(n) && n > 0, "expects a positive integer"),
		description: "Most steps running at once; the machine's available parallelism by default",
	}),
	remote: REMOTE_FLAG,
	tokenEnv: TOKEN_ENV_FLAG,
	verbose: flag.boolean("verbose", {
		short: "v",
		description: "Print every step's log, not only a failed one's",
	}),
	json: JSON_FLAG,
	rerunFailed: flag.boolean("rerun-failed", {
		description: "Run only the steps the last recorded run failed",
	}),
};

/** Every flag `list` takes. */
export const LIST_FLAGS = {
	...FILTER_FLAGS,
	matrix: flag.string("matrix", {
		valueName: "name",
		description: "Print only the entry keys of this matrix",
	}),
	json: JSON_FLAG,
};

/** Every flag `signoff` takes. */
export const SIGNOFF_FLAGS = { remote: REMOTE_FLAG, tokenEnv: TOKEN_ENV_FLAG, json: JSON_FLAG };

/** Every flag `verify` takes. */
export const VERIFY_FLAGS = {
	wait: flag.string("wait", {
		valueName: "duration",
		description: "Poll until a signoff appears or this long passes: 30s, 2m, 500ms",
	}),
	repo: flag.string("repo", {
		valueName: "owner/name",
		description: "The GitHub repository; read from the git remote when left out",
	}),
	remote: REMOTE_FLAG,
	tokenEnv: TOKEN_ENV_FLAG,
	json: JSON_FLAG,
};

/** Every flag `clean` takes. */
export const CLEAN_FLAGS = { json: JSON_FLAG };

/** The commit a command acts on. */
const SHA = argument(s.string(), {
	optional: true,
	valueName: "sha",
	description: "The commit; HEAD when left out",
});

/** Every command `sdxc-ci` takes. */
export const CI_COMMANDS = commands({
	description:
		"sdxc-ci — run a CI script locally or on a CI host, and sign green commits off on GitHub",
	run: command({
		description:
			"Run a CI script; exits 0 when it passes, 1 when a step fails or a requested push or signoff does not happen",
		arguments: {
			script: argument(s.string(), {
				valueName: "script",
				description: "The script file, such as ci.ts",
			}),
		},
		flags: RUN_FLAGS,
		examples: [
			"run ci.ts",
			"run ci.ts --push",
			'run ci.ts --only "Workspaces/@acme/ui"',
			'run ci.ts --skip "Tests*" --runner remote',
		],
	}),
	list: command({
		description:
			"Print the steps and matrix entries a fully passing run takes, without running any",
		arguments: {
			script: argument(s.string(), {
				valueName: "script",
				description: "The script file, such as ci.ts",
			}),
		},
		flags: LIST_FLAGS,
		examples: ["list ci.ts", "list ci.ts --runner remote --matrix Workspaces --json"],
	}),
	signoff: command({
		description: "Post the signoff an earlier green run recorded for a commit already on GitHub",
		arguments: { sha: SHA },
		flags: SIGNOFF_FLAGS,
		examples: ["signoff", "signoff 1d9090458"],
	}),
	verify: command({
		description:
			"Exit 0 when a contributor signed the commit off, 1 when nobody did, 2 when GitHub cannot be reached",
		arguments: {
			sha: argument(s.string(), { valueName: "sha", description: "The commit to check" }),
		},
		flags: VERIFY_FLAGS,
		examples: ['verify "$GITHUB_SHA" --wait 60s', "verify 1d9090458 --repo acme/app --json"],
	}),
	clean: command({
		description:
			"Remove the step cache and run history kept in the git directory; signoff records stay",
		flags: CLEAN_FLAGS,
		examples: ["clean", "clean --json"],
	}),
});
