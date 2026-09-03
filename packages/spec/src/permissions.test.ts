/**
 * Tests for grant parsing and the centralized permission checks: `--allow-*`
 * flags parse into the documented grant modes, every family denies by
 * default, and every denial names the exact flag that would grant it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ConfigPermissionEntry, Grants } from "./permissions";

import { PermissionDeniedError } from "./errors";
import {
	configWouldAdmit,
	createPermissionSet,
	grantsAdmit,
	grantsFromConfig,
	mergeGrants,
	parseGrants,
} from "./permissions";

/**
 * Narrow a result to its error, failing the test when it succeeded.
 *
 * @param result - The result expected to be a failure.
 * @returns The carried error.
 */
function expectFailure<T, E extends Error>(result: Result<T, E>): E {
	if (isSuccess(result)) throw new Error("Expected a failure, got a success");
	return result.error;
}

/**
 * Build a full grant set from a partial override, everything else denied.
 *
 * @param overrides - The families to grant.
 * @returns A complete `Grants`.
 */
function grants(overrides: Partial<Grants> = {}): Grants {
	return {
		run: { mode: "denied" },
		net: { mode: "denied" },
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
		...overrides,
	};
}

describe("parseGrants", () => {
	test("denies every family when no flags are given", () => {
		let parsed = unwrap(parseGrants([]));
		expect(parsed.grants).toEqual(grants());
		expect(parsed.remaining).toEqual([]);
	});

	test("passes non-permission arguments through in order", () => {
		let parsed = unwrap(parseGrants(["run", "--allow-run", "spec/", "--reporter=json"]));
		expect(parsed.remaining).toEqual(["run", "spec/", "--reporter=json"]);
	});

	test("a bare flag grants its whole family", () => {
		let parsed = unwrap(
			parseGrants(["--allow-run", "--allow-net", "--allow-env", "--allow-host-fs"]),
		);
		expect(parsed.grants).toEqual({
			run: { mode: "all" },
			net: { mode: "all" },
			env: { mode: "all" },
			hostFs: { mode: "all" },
		});
	});

	test("a flag with a value grants an explicit scope list", () => {
		let parsed = unwrap(
			parseGrants([
				"--allow-run=node,bun",
				"--allow-net=example.com:8080",
				"--allow-env=CI",
				"--allow-host-fs=/opt/data",
			]),
		);
		expect(parsed.grants).toEqual({
			run: { mode: "scoped", scopes: ["node", "bun"] },
			net: { mode: "scoped", scopes: ["example.com:8080"] },
			env: { mode: "scoped", scopes: ["CI"] },
			hostFs: { mode: "scoped", scopes: ["/opt/data"] },
		});
	});

	test("repeated scoped flags union their scopes", () => {
		let parsed = unwrap(parseGrants(["--allow-run=node", "--allow-run=bun,node"]));
		expect(parsed.grants.run).toEqual({ mode: "scoped", scopes: ["node", "bun"] });
	});

	test("a bare flag absorbs scoped occurrences in either order", () => {
		let bareLast = unwrap(parseGrants(["--allow-run=node", "--allow-run"]));
		expect(bareLast.grants.run).toEqual({ mode: "all" });
		let bareFirst = unwrap(parseGrants(["--allow-run", "--allow-run=node"]));
		expect(bareFirst.grants.run).toEqual({ mode: "all" });
	});

	test("trims scopes and drops empty entries", () => {
		let parsed = unwrap(parseGrants(["--allow-run=node, bun,"]));
		expect(parsed.grants.run).toEqual({ mode: "scoped", scopes: ["node", "bun"] });
	});

	test("rejects an unknown --allow-* flag as a usage error", () => {
		let error = expectFailure(parseGrants(["--allow-device=camera"]));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("--allow-device");
		expect(error.message).toContain("--allow-host-fs");
	});

	test("rejects an empty scope list as a usage error", () => {
		let error = expectFailure(parseGrants(["--allow-net="]));
		expect(error.code).toBe("usage-error");
		expect(error.message).toContain("--allow-net");
	});
});

describe("createPermissionSet", () => {
	describe("checkRun", () => {
		test("denies by default with the exact remedy flag", () => {
			let set = createPermissionSet(grants());
			let error = expectFailure(set.checkRun("node"));
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect(error.code).toBe("permission-denied");
			expect(error.permission).toBe("run");
			expect(error.resource).toBe("node");
			expect(error.remedy).toBe("spec run --allow-run=node");
		});

		test("names the basename in the remedy for a full path", () => {
			let set = createPermissionSet(grants());
			let error = expectFailure(set.checkRun("/usr/local/bin/node"));
			expect(error.resource).toBe("/usr/local/bin/node");
			expect(error.remedy).toBe("spec run --allow-run=node");
		});

		test("grant-all admits any executable", () => {
			let set = createPermissionSet(grants({ run: { mode: "all" } }));
			expect(isSuccess(set.checkRun("anything"))).toBe(true);
		});

		test("a scoped grant matches on the executable basename", () => {
			let set = createPermissionSet(grants({ run: { mode: "scoped", scopes: ["node"] } }));
			expect(isSuccess(set.checkRun("node"))).toBe(true);
			expect(isSuccess(set.checkRun("/usr/bin/node"))).toBe(true);
			let error = expectFailure(set.checkRun("bun"));
			expect(error.remedy).toBe("spec run --allow-run=bun");
		});
	});

	describe("checkNet", () => {
		test("denies by default naming host and port", () => {
			let set = createPermissionSet(grants());
			let error = expectFailure(set.checkNet("example.com", 443));
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect(error.permission).toBe("net");
			expect(error.resource).toBe("example.com:443");
			expect(error.remedy).toBe("spec run --allow-net=example.com:443");
		});

		test("denies a portless attempt naming just the host", () => {
			let set = createPermissionSet(grants());
			let error = expectFailure(set.checkNet("example.com"));
			expect(error.resource).toBe("example.com");
			expect(error.remedy).toBe("spec run --allow-net=example.com");
		});

		test("grant-all admits any host", () => {
			let set = createPermissionSet(grants({ net: { mode: "all" } }));
			expect(isSuccess(set.checkNet("anywhere.test", 1234))).toBe(true);
		});

		test("a host scope without a port admits every port of that host", () => {
			let set = createPermissionSet(grants({ net: { mode: "scoped", scopes: ["example.com"] } }));
			expect(isSuccess(set.checkNet("example.com", 80))).toBe(true);
			expect(isSuccess(set.checkNet("example.com", 8080))).toBe(true);
			expect(isSuccess(set.checkNet("example.com"))).toBe(true);
			expect(isSuccess(set.checkNet("other.com", 80))).toBe(false);
		});

		test("a host:port scope pins the port exactly", () => {
			let set = createPermissionSet(
				grants({ net: { mode: "scoped", scopes: ["example.com:8080"] } }),
			);
			expect(isSuccess(set.checkNet("example.com", 8080))).toBe(true);
			expect(isSuccess(set.checkNet("example.com", 80))).toBe(false);
			expect(isSuccess(set.checkNet("example.com"))).toBe(false);
			expect(isSuccess(set.checkNet("other.com", 8080))).toBe(false);
		});
	});

	describe("checkEnv", () => {
		test("denies by default with the exact remedy flag", () => {
			let set = createPermissionSet(grants());
			let error = expectFailure(set.checkEnv("HOME"));
			expect(error.permission).toBe("env");
			expect(error.resource).toBe("HOME");
			expect(error.remedy).toBe("spec run --allow-env=HOME");
		});

		test("grant-all admits any variable", () => {
			let set = createPermissionSet(grants({ env: { mode: "all" } }));
			expect(isSuccess(set.checkEnv("ANYTHING"))).toBe(true);
		});

		test("a scoped grant matches exact names, case-sensitively", () => {
			let set = createPermissionSet(grants({ env: { mode: "scoped", scopes: ["CI"] } }));
			expect(isSuccess(set.checkEnv("CI"))).toBe(true);
			expect(isSuccess(set.checkEnv("ci"))).toBe(false);
			expect(isSuccess(set.checkEnv("CI_TOKEN"))).toBe(false);
		});
	});

	describe("grantedEnvNames", () => {
		test("returns nothing when env is denied", () => {
			let set = createPermissionSet(grants());
			expect(set.grantedEnvNames()).toEqual([]);
		});

		test("returns the scope list when env is scoped", () => {
			let set = createPermissionSet(grants({ env: { mode: "scoped", scopes: ["CI", "TOKEN"] } }));
			expect(set.grantedEnvNames()).toEqual(["CI", "TOKEN"]);
		});

		test("returns every host variable when env is granted whole", () => {
			let set = createPermissionSet(grants({ env: { mode: "all" } }));
			expect(set.grantedEnvNames()).toContain("PATH");
		});
	});

	describe("checkHostFs", () => {
		test("denies by default with a directory remedy", () => {
			let set = createPermissionSet(grants());
			let error = expectFailure(set.checkHostFs("/opt/data/file.txt"));
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect(error.permission).toBe("host-fs");
			expect(error.resource).toBe("/opt/data/file.txt");
			expect(error.remedy).toBe("spec run --allow-host-fs=/opt/data");
		});

		test("grant-all admits any path", () => {
			let set = createPermissionSet(grants({ hostFs: { mode: "all" } }));
			expect(isSuccess(set.checkHostFs("/etc/passwd"))).toBe(true);
		});

		test("a directory scope contains itself and descendants, segment-aware", () => {
			let set = createPermissionSet(grants({ hostFs: { mode: "scoped", scopes: ["/opt/data"] } }));
			expect(isSuccess(set.checkHostFs("/opt/data"))).toBe(true);
			expect(isSuccess(set.checkHostFs("/opt/data/deep/file.txt"))).toBe(true);
			expect(isSuccess(set.checkHostFs("/opt/database"))).toBe(false);
			expect(isSuccess(set.checkHostFs("/opt"))).toBe(false);
		});

		test("normalizes traversal before matching the scope", () => {
			let set = createPermissionSet(grants({ hostFs: { mode: "scoped", scopes: ["/opt/data"] } }));
			expect(isSuccess(set.checkHostFs("/opt/data/../data/file.txt"))).toBe(true);
			expect(isSuccess(set.checkHostFs("/opt/data/../secret"))).toBe(false);
		});

		test("a scope with a trailing slash behaves like one without", () => {
			let set = createPermissionSet(grants({ hostFs: { mode: "scoped", scopes: ["/opt/data/"] } }));
			expect(isSuccess(set.checkHostFs("/opt/data/file.txt"))).toBe(true);
			expect(isSuccess(set.checkHostFs("/opt/database"))).toBe(false);
		});

		test("a symlink inside a granted directory cannot reach outside it", () => {
			let granted = realpathSync(mkdtempSync(join(tmpdir(), "spec-grant-")));
			let outside = realpathSync(mkdtempSync(join(tmpdir(), "spec-outside-")));
			try {
				mkdirSync(join(granted, "real"));
				symlinkSync(outside, join(granted, "out"));
				let set = createPermissionSet(grants({ hostFs: { mode: "scoped", scopes: [granted] } }));
				expect(isSuccess(set.checkHostFs(join(granted, "real", "file.txt")))).toBe(true);
				let error = expectFailure(set.checkHostFs(join(granted, "out", "escape.txt")));
				expect(error).toBeInstanceOf(PermissionDeniedError);
				expect(error.permission).toBe("host-fs");
			} finally {
				rmSync(granted, { recursive: true, force: true });
				rmSync(outside, { recursive: true, force: true });
			}
		});

		/**
		 * os.tmpdir() is itself a symlink on macOS (/var -> /private/var); the
		 * grant and the checked path must match through real paths, not spellings.
		 */
		test("a grant spelled through a symlinked ancestor admits its real paths", () => {
			let spelled = mkdtempSync(join(tmpdir(), "spec-spelled-"));
			let real = realpathSync(spelled);
			try {
				let set = createPermissionSet(grants({ hostFs: { mode: "scoped", scopes: [spelled] } }));
				expect(isSuccess(set.checkHostFs(join(real, "file.txt")))).toBe(true);
				expect(isSuccess(set.checkHostFs(join(spelled, "file.txt")))).toBe(true);
			} finally {
				rmSync(real, { recursive: true, force: true });
			}
		});
	});
});

/** Build validated config allow entries tersely. */
function entry(
	family: ConfigPermissionEntry["family"],
	...scopes: string[]
): ConfigPermissionEntry {
	return { family, scopes };
}

describe("grantsFromConfig", () => {
	test("a bare family entry grants the whole family", () => {
		expect(grantsFromConfig([entry("run")])).toEqual(grants({ run: { mode: "all" } }));
	});

	test("a scoped entry grants exactly its scopes", () => {
		expect(grantsFromConfig([entry("env", "DATABASE_URL")])).toEqual(
			grants({ env: { mode: "scoped", scopes: ["DATABASE_URL"] } }),
		);
	});

	test("host-fs maps onto the hostFs key", () => {
		expect(grantsFromConfig([entry("host-fs", "/opt")])).toEqual(
			grants({ hostFs: { mode: "scoped", scopes: ["/opt"] } }),
		);
	});

	test("repeated scoped entries for a family union their scopes", () => {
		expect(grantsFromConfig([entry("run", "echo"), entry("run", "pwd", "echo")])).toEqual(
			grants({ run: { mode: "scoped", scopes: ["echo", "pwd"] } }),
		);
	});

	test("a plugins entry contributes no capability grant", () => {
		expect(grantsFromConfig([entry("plugins", "greet")])).toEqual(grants());
	});
});

describe("mergeGrants", () => {
	test("a config grant fills a family the CLI left denied", () => {
		let merged = mergeGrants(grants(), grants({ run: { mode: "all" } }));
		expect(merged).toEqual(grants({ run: { mode: "all" } }));
	});

	test("scoped CLI and scoped config grants union their scopes", () => {
		let merged = mergeGrants(
			grants({ run: { mode: "scoped", scopes: ["pwd"] } }),
			grants({ run: { mode: "scoped", scopes: ["echo"] } }),
		);
		expect(merged.run).toEqual({ mode: "scoped", scopes: ["pwd", "echo"] });
	});

	test("a grant-all on either side wins, and neither side ever subtracts", () => {
		expect(mergeGrants(grants({ net: { mode: "all" } }), grants()).net).toEqual({ mode: "all" });
		expect(
			mergeGrants(
				grants({ net: { mode: "scoped", scopes: ["a"] } }),
				grants({ net: { mode: "all" } }),
			).net,
		).toEqual({ mode: "all" });
	});
});

describe("grantsAdmit", () => {
	test("run matches by basename against the config's scopes", () => {
		let g = grants({ run: { mode: "scoped", scopes: ["echo"] } });
		expect(grantsAdmit(g, "run", "echo")).toBe(true);
		expect(grantsAdmit(g, "run", "node")).toBe(false);
	});

	test("a grant-all admits the coarse-gate tool resource", () => {
		expect(grantsAdmit(grants({ run: { mode: "all" } }), "run", "cli.run")).toBe(true);
	});

	test("net splits a host:port resource and honors a pinned port", () => {
		let g = grants({ net: { mode: "scoped", scopes: ["api.example.com:443"] } });
		expect(grantsAdmit(g, "net", "api.example.com:443")).toBe(true);
		expect(grantsAdmit(g, "net", "api.example.com:80")).toBe(false);
	});

	test("env admits the exact name only", () => {
		let g = grants({ env: { mode: "scoped", scopes: ["DATABASE_URL"] } });
		expect(grantsAdmit(g, "env", "DATABASE_URL")).toBe(true);
		expect(grantsAdmit(g, "env", "OTHER")).toBe(false);
	});
});

describe("configWouldAdmit", () => {
	/**
	 * The coarse gate's resource is a placeholder tool name, so a scoped
	 * config admits it exactly as a whole-family one does; the DX hint must
	 * fire for a scoped tuple too.
	 */
	test("a family-gate denial keys off the family being declared, scope or not", () => {
		let scoped = grants({ run: { mode: "scoped", scopes: ["echo"] } });
		expect(configWouldAdmit(scoped, "run", "cli.run", true)).toBe(true);
		expect(configWouldAdmit(grants({ run: { mode: "all" } }), "run", "cli.run", true)).toBe(true);
		expect(configWouldAdmit(grants(), "run", "cli.run", true)).toBe(false);
	});

	test("a scope-level denial still demands the config's own scope cover it", () => {
		let scoped = grants({ run: { mode: "scoped", scopes: ["echo"] } });
		expect(configWouldAdmit(scoped, "run", "echo", false)).toBe(true);
		expect(configWouldAdmit(scoped, "run", "node", false)).toBe(false);
	});

	test("host-fs is never family-gated, so its scope is honored precisely", () => {
		let scoped = grants({ hostFs: { mode: "scoped", scopes: ["/srv/data"] } });
		expect(configWouldAdmit(scoped, "host-fs", "/srv/data/file", false)).toBe(true);
		expect(configWouldAdmit(scoped, "host-fs", "/etc/passwd", false)).toBe(false);
	});
});
