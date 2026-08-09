/**
 * Specifies the suite's `spec/config.jsonc` loading and its plugin section. The
 * unit tests pin the config parser, the `--allow-plugins` grant, the launch
 * plan, and the stdio transport's `dispose`; the acceptance tests drive the
 * real `spec` CLI against the committed `examples/plugin-loading` showcase,
 * proving deny-by-default — the run is refused without `--allow-plugins` and
 * passes with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { isFailure, isSuccess, success } from "@pkg/result";

import type { PermissionSet } from "./permissions";
import type { ToolContext } from "./plugin";
import type { Value } from "./values";
import type { Workspace } from "./workspace";

import { loadSuite } from "./loader";
import {
	connectDeclaredPlugins,
	deniedReferences,
	launchDeniedError,
	loadProjectConfig,
	parsePluginGrant,
	planPluginLaunch,
} from "./project-config";
import { connectStdioPlugin } from "./transport-stdio";

/** Absolute path of this package, the acceptance runs' working directory. */
const PACKAGE_DIR = resolve(import.meta.dir, "..");

/** The reference plugin the transport tests connect to. */
const DEMO_PLUGIN = join(import.meta.dir, "plugins", "demo.ts");

/** How long a CLI acceptance run may take: it spawns a CLI and a plugin. */
const CLI_TIMEOUT_MS = 60_000;

/** Make a temp directory for a config or suite fixture; caller removes it. */
function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), "spec-plugin-loading-"));
}

/** A `ToolContext` whose workspace root is all the stdio transport reads. */
function makeContext(root: string): ToolContext {
	let workspace: Workspace = {
		root,
		resolve: (target) => success(target),
		cleanup: async () => undefined,
	};
	let permissions: PermissionSet = {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
	return { workspace, permissions };
}

/** Run the `spec` CLI as a child and collect its output and exit code. */
async function runCli(args: string[]): Promise<{ stdout: string; exitCode: number }> {
	let child = Bun.spawn({
		cmd: [process.execPath, join(PACKAGE_DIR, "src", "cli.ts"), ...args],
		cwd: PACKAGE_DIR,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	let [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { stdout: `${stdout}${stderr}`, exitCode };
}

test("parsePluginGrant reads bare, scoped, and absent forms", () => {
	let absent = parsePluginGrant(["run", "spec"]);
	expect(isSuccess(absent) && absent.data.grant.mode).toBe("denied");
	expect(isSuccess(absent) && absent.data.remaining).toEqual(["run", "spec"]);

	let bare = parsePluginGrant(["spec", "--allow-plugins"]);
	expect(isSuccess(bare) && bare.data.grant.mode).toBe("all");
	expect(isSuccess(bare) && bare.data.remaining).toEqual(["spec"]);

	let scoped = parsePluginGrant(["spec", "--allow-plugins=demo,other"]);
	expect(isSuccess(scoped) && scoped.data.grant).toEqual({
		mode: "scoped",
		namespaces: ["demo", "other"],
	});
});

test("parsePluginGrant unions repeats and lets a bare flag absorb scopes", () => {
	let unioned = parsePluginGrant(["--allow-plugins=a", "--allow-plugins=b,a"]);
	expect(isSuccess(unioned) && unioned.data.grant).toEqual({
		mode: "scoped",
		namespaces: ["a", "b"],
	});

	let absorbed = parsePluginGrant(["--allow-plugins=a", "--allow-plugins"]);
	expect(isSuccess(absorbed) && absorbed.data.grant.mode).toBe("all");
});

test("parsePluginGrant rejects an empty scope list", () => {
	let empty = parsePluginGrant(["--allow-plugins="]);
	expect(isFailure(empty)).toBe(true);
	expect(isFailure(empty) && empty.error.code).toBe("usage-error");
});

test("loadProjectConfig returns no plugins when no config exists", async () => {
	let dir = makeTempDir();
	try {
		let config = await loadProjectConfig(dir);
		expect(isSuccess(config) && config.data.plugins).toEqual([]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("loadProjectConfig parses JSONC and resolves relative command paths", async () => {
	let dir = makeTempDir();
	try {
		writeFileSync(
			join(dir, "config.jsonc"),
			`{
				// a comment, and a trailing comma below
				"plugins": {
					"demo": { "command": ["bun", "./plugins/demo.ts"], },
				},
			}`,
			"utf8",
		);
		let config = await loadProjectConfig(dir);
		expect(isSuccess(config)).toBe(true);
		if (!isSuccess(config)) throw new Error("config did not load");
		expect(config.data.plugins).toHaveLength(1);
		let declaration = config.data.plugins[0];
		expect(declaration?.namespace).toBe("demo");
		// The executable stays as written; the relative path is made absolute
		// against the config directory so the command is cwd-independent.
		expect(declaration?.command).toEqual(["bun", join(dir, "plugins", "demo.ts")]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("loadProjectConfig rejects shadowing a built-in namespace", async () => {
	let dir = makeTempDir();
	try {
		writeFileSync(
			join(dir, "config.json"),
			JSON.stringify({ plugins: { fs: { command: ["bun", "./fs.ts"] } } }),
			"utf8",
		);
		let config = await loadProjectConfig(dir);
		expect(isFailure(config)).toBe(true);
		expect(isFailure(config) && config.error.code).toBe("load-error");
		expect(isFailure(config) && config.error.message).toContain("fs");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("loadProjectConfig rejects malformed declarations", async () => {
	let dir = makeTempDir();
	try {
		writeFileSync(
			join(dir, "config.json"),
			JSON.stringify({ plugins: { demo: { command: [] } } }),
			"utf8",
		);
		let config = await loadProjectConfig(dir);
		expect(isFailure(config) && config.error.code).toBe("load-error");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("loadProjectConfig reports invalid JSONC", async () => {
	let dir = makeTempDir();
	try {
		writeFileSync(join(dir, "config.jsonc"), "{ not json", "utf8");
		let config = await loadProjectConfig(dir);
		expect(isFailure(config) && config.error.code).toBe("load-error");
		expect(isFailure(config) && config.error.message).toContain("JSONC");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("planPluginLaunch partitions declarations by the grant", () => {
	let config = {
		plugins: [
			{ namespace: "a", command: ["bun", "a.ts"] },
			{ namespace: "b", command: ["bun", "b.ts"] },
		],
	};

	let all = planPluginLaunch(config, { mode: "all" });
	expect(all.launch.map((declaration) => declaration.namespace)).toEqual(["a", "b"]);
	expect(all.deniedNamespaces).toEqual([]);

	let scoped = planPluginLaunch(config, { mode: "scoped", namespaces: ["a"] });
	expect(scoped.launch.map((declaration) => declaration.namespace)).toEqual(["a"]);
	expect(scoped.deniedNamespaces).toEqual(["b"]);

	let denied = planPluginLaunch(config, { mode: "denied" });
	expect(denied.launch).toEqual([]);
	expect(denied.deniedNamespaces).toEqual(["a", "b"]);
});

test("deniedReferences finds only refused namespaces the suite imports", async () => {
	let dir = makeTempDir();
	try {
		writeFileSync(
			join(dir, "uses-greet.spec"),
			'use greet\n\ntest "t" {\n\tthen {\n\t\texpect true\n\t}\n}\n',
			"utf8",
		);
		let loaded = await loadSuite(dir);
		expect(isSuccess(loaded)).toBe(true);
		if (!isSuccess(loaded)) throw new Error("suite did not load");
		expect(deniedReferences(loaded.data, ["greet"])).toEqual(["greet"]);
		expect(deniedReferences(loaded.data, ["unused"])).toEqual([]);
		expect(deniedReferences(loaded.data, [])).toEqual([]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("launchDeniedError is a permission-style diagnostic naming the flag", () => {
	let error = launchDeniedError(["greet"]);
	expect(error.code).toBe("permission-denied");
	expect(error.message).toContain("greet");
	expect(error.remedy).toBe("spec run --allow-plugins=greet");
});

test(
	"connectStdioPlugin round-trips a call and dispose kills the child",
	async () => {
		let connected = await connectStdioPlugin([process.execPath, DEMO_PLUGIN], "demo");
		expect(isSuccess(connected)).toBe(true);
		if (!isSuccess(connected)) throw new Error(String(connected));
		let plugin = connected.data;

		let context = makeContext(tmpdir());
		let before = await plugin.call("upper", [{ kind: "value", value: "hi" }], context);
		expect(isSuccess(before) && before.data).toBe("HI" as Value);

		// The transport must give the connected plugin a dispose that terminates
		// its child — the runner calls it after every run.
		expect(plugin.dispose).toBeDefined();
		await plugin.dispose?.();

		// After dispose the child is gone, so a further call cannot be served.
		let after = await plugin.call("upper", [{ kind: "value", value: "again" }], context);
		expect(isFailure(after)).toBe(true);
	},
	CLI_TIMEOUT_MS,
);

test(
	"connectDeclaredPlugins launches a declaration and fails cleanly on a bad command",
	async () => {
		let ok = await connectDeclaredPlugins([
			{ namespace: "demo", command: [process.execPath, DEMO_PLUGIN] },
		]);
		expect(isSuccess(ok)).toBe(true);
		if (!isSuccess(ok)) throw new Error(String(ok));
		expect(ok.data).toHaveLength(1);
		let call = await ok.data[0]?.call(
			"upper",
			[{ kind: "value", value: "x" }],
			makeContext(tmpdir()),
		);
		expect(call !== undefined && isSuccess(call) && call.data).toBe("X" as Value);
		for (let plugin of ok.data) await plugin.dispose?.();

		// A command that cannot serve the handshake fails the launch, and the
		// error names the offending namespace.
		let bad = await connectDeclaredPlugins([
			{
				namespace: "nope",
				command: [process.execPath, join(import.meta.dir, "no-such-plugin.ts")],
			},
		]);
		expect(isFailure(bad)).toBe(true);
		expect(isFailure(bad) && bad.error.message).toContain("nope");
	},
	CLI_TIMEOUT_MS,
);

test(
	"a suite importing a declared plugin is refused without --allow-plugins",
	async () => {
		let { stdout, exitCode } = await runCli(["run", "examples/plugin-loading"]);
		expect(exitCode, stdout).not.toBe(0);
		expect(stdout).toContain("--allow-plugins");
		expect(stdout).toContain("greet");
	},
	CLI_TIMEOUT_MS,
);

test(
	"the same suite passes once --allow-plugins launches the plugin",
	async () => {
		let { stdout, exitCode } = await runCli(["run", "examples/plugin-loading", "--allow-plugins"]);
		expect(exitCode, stdout).toBe(0);
		expect(stdout).not.toContain("✗");
		let summary = /(\d+) passed, (\d+) failed/.exec(stdout);
		expect(summary, stdout).not.toBeNull();
		expect(Number(summary?.[1]), stdout).toBeGreaterThan(0);
		expect(Number(summary?.[2]), stdout).toBe(0);
	},
	CLI_TIMEOUT_MS,
);

test(
	"a scoped --allow-plugins=greet launches exactly that plugin",
	async () => {
		let { stdout, exitCode } = await runCli([
			"run",
			"examples/plugin-loading",
			"--allow-plugins=greet",
		]);
		expect(exitCode, stdout).toBe(0);
		expect(stdout).not.toContain("✗");
	},
	CLI_TIMEOUT_MS,
);

test(
	"a scoped grant for a different namespace still refuses the suite",
	async () => {
		let { stdout, exitCode } = await runCli([
			"run",
			"examples/plugin-loading",
			"--allow-plugins=other",
		]);
		expect(exitCode, stdout).not.toBe(0);
		expect(stdout).toContain("--allow-plugins");
	},
	CLI_TIMEOUT_MS,
);
