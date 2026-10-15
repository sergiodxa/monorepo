/**
 * GitHub templates against an MSW stand-in for the tarball endpoint: the request `create`
 * sends, what extraction keeps and drops, the folder and ref a template names, and how each
 * refusal and exceeded limit is reported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, success, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { GitHubTemplate } from "./github.js";

import { downloadTemplate, extract, LIMITS } from "./github.js";

import { create } from "./index.js";

/** One archive entry: a file with its content, a directory, or a symbolic link. */
type Entry =
	| { name: string; type: "file"; content: string }
	| { name: string; type: "directory" }
	| { name: string; type: "symlink"; target: string };

/** The tar type flag of each entry kind. */
const TYPE_FLAGS = { file: "0", symlink: "2", directory: "5" };

/** The top-level folder GitHub wraps a tarball in: owner, repository and abbreviated commit. */
const TOP = "acme-starters-0a1b2c3";

/** Every request the stand-in received, for asserting what `create` sent. */
const REQUESTS: Request[] = [];

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

const SERVER = setupServer();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(async () => {
	SERVER.resetHandlers();
	REQUESTS.splice(0);
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});
afterAll(() => SERVER.close());

/** A ustar header block for `entry` whose body is `size` bytes. */
function header(entry: Entry, size: number): Uint8Array {
	let block = new Uint8Array(512);
	let encoder = new TextEncoder();
	let field = (offset: number, length: number, value: string) => {
		block.set(encoder.encode(value).slice(0, length), offset);
	};
	let octal = (offset: number, length: number, value: number) => {
		field(offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`);
	};
	field(0, 100, entry.name);
	octal(100, 8, entry.type === "directory" ? 0o755 : 0o644);
	octal(108, 8, 0);
	octal(116, 8, 0);
	octal(124, 12, size);
	octal(136, 12, 0);
	field(148, 8, "        ");
	field(156, 1, TYPE_FLAGS[entry.type]);
	if (entry.type === "symlink") field(157, 100, entry.target);
	field(257, 6, "ustar\0");
	field(263, 2, "00");
	let checksum = block.reduce((sum, byte) => sum + byte, 0);
	field(148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
	return block;
}

/** A tar archive of `entries`, unwrapped. */
function tar(entries: Entry[]): Uint8Array<ArrayBuffer> {
	let blocks: Uint8Array[] = [];
	for (let entry of entries) {
		let body = entry.type === "file" ? new TextEncoder().encode(entry.content) : new Uint8Array();
		blocks.push(header(entry, body.length));
		let padded = new Uint8Array(Math.ceil(body.length / 512) * 512);
		padded.set(body);
		blocks.push(padded);
	}
	blocks.push(new Uint8Array(1024));
	let archive = new Uint8Array(blocks.reduce((total, block) => total + block.length, 0));
	let offset = 0;
	for (let block of blocks) {
		archive.set(block, offset);
		offset += block.length;
	}
	return archive;
}

/** `entries` as GitHub serves them: a gzipped tar under the {@link TOP} folder. */
async function tarball(entries: Entry[]): Promise<ArrayBuffer> {
	let wrapped: Entry[] = [
		{ name: `${TOP}/`, type: "directory" },
		...entries.map((entry) => ({ ...entry, name: `${TOP}/${entry.name}` })),
	];
	let stream = new Blob([tar(wrapped)]).stream().pipeThrough(new CompressionStream("gzip"));
	return new Response(stream).arrayBuffer();
}

/** A stream of `bytes`, as a response body hands the parser. */
function stream(bytes: Uint8Array<ArrayBuffer>): ReadableStream<Uint8Array> {
	return new Blob([bytes]).stream();
}

/** Serves `entries` from the tarball endpoint for any ref of `acme/starters`. */
function serve(entries: Entry[]) {
	SERVER.use(
		http.get("https://api.github.com/repos/acme/starters/tarball*", async ({ request }) => {
			REQUESTS.push(request.clone());
			return new HttpResponse(await tarball(entries), {
				headers: { "content-type": "application/x-gzip" },
			});
		}),
	);
}

/** A starter repository with a root project and a nested one under `workers/api`. */
const STARTER: Entry[] = [
	{
		name: "package.json",
		type: "file",
		content: '{\n  "name": "starter",\n  "private": true\n}\n',
	},
	{ name: "src/", type: "directory" },
	{ name: "src/index.ts", type: "file", content: "export {};\n" },
	{ name: "empty/", type: "directory" },
	{ name: "link", type: "symlink", target: "src/index.ts" },
	{ name: "workers/api/package.json", type: "file", content: '{ "name": "api" }\n' },
	{ name: "workers/api/worker.ts", type: "file", content: "export default {};\n" },
];

/** The template `acme/starters` with no folder or ref. */
const ROOT: GitHubTemplate = {
	kind: "github",
	owner: "acme",
	repo: "starters",
	path: null,
	ref: null,
};

describe("downloadTemplate", () => {
	test("keeps files and empty directories, drops the top folder and skips links", async () => {
		serve(STARTER);

		let extracted = unwrap(await downloadTemplate(ROOT, {}));

		expect(extracted.commit).toBe("0a1b2c3");
		expect([...extracted.tree.files.keys()].sort()).toEqual([
			"package.json",
			"src/index.ts",
			"workers/api/package.json",
			"workers/api/worker.ts",
		]);
		expect([...extracted.tree.directories]).toEqual(["empty"]);
		expect(REQUESTS[0]?.url).toBe("https://api.github.com/repos/acme/starters/tarball");
		expect(REQUESTS[0]?.headers.get("authorization")).toBeNull();
	});

	test("keeps only the folder a path names, relative to it, and requests the ref", async () => {
		serve(STARTER);

		let extracted = unwrap(
			await downloadTemplate({ ...ROOT, path: "workers/api", ref: "release/v2" }, {}),
		);

		expect([...extracted.tree.files.keys()].sort()).toEqual(["package.json", "worker.ts"]);
		expect(REQUESTS[0]?.url).toBe("https://api.github.com/repos/acme/starters/tarball/release/v2");
	});

	test("sends GITHUB_TOKEN, else GH_TOKEN, as a bearer token", async () => {
		serve(STARTER);

		await downloadTemplate(ROOT, { GH_TOKEN: "gh-token" });
		await downloadTemplate(ROOT, { GITHUB_TOKEN: "github-token", GH_TOKEN: "gh-token" });

		expect(REQUESTS.map((request) => request.headers.get("authorization"))).toEqual([
			"Bearer gh-token",
			"Bearer github-token",
		]);
	});

	test("names a folder the archive does not hold", async () => {
		serve(STARTER);

		let result = await downloadTemplate({ ...ROOT, path: "workers/web" }, {});

		expect(isFailure(result) && result.error.message).toBe(
			"acme/starters has no folder workers/web, or it is empty",
		);
	});

	test("words a missing repository, a rejected token and the rate limit", async () => {
		let answers = [
			new HttpResponse(null, { status: 404 }),
			new HttpResponse(null, { status: 401 }),
			new HttpResponse(null, { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
		];
		SERVER.use(
			http.get("https://api.github.com/repos/acme/starters/tarball*", () => answers.shift()),
		);

		let messages = [];
		for (let index = 0; index < 3; index += 1) {
			let result = await downloadTemplate({ ...ROOT, ref: "main" }, {});
			messages.push(isFailure(result) ? result.error.message : null);
		}

		expect(messages).toEqual([
			"GitHub has no repository acme/starters or no ref main; for a private repository, set GITHUB_TOKEN or GH_TOKEN",
			"GitHub rejected the token sent for acme/starters#main; check GITHUB_TOKEN or GH_TOKEN",
			"GitHub's rate limit refused acme/starters#main; wait for it to reset or set GITHUB_TOKEN or GH_TOKEN",
		]);
	});
});

describe("extract", () => {
	test("names the limit an archive exceeds", async () => {
		let large = "x".repeat(LIMITS.maxEntrySize + 1);
		let archive = tar([
			{ name: `${TOP}/`, type: "directory" },
			{ name: `${TOP}/large.txt`, type: "file", content: large },
		]);

		let result = await extract(stream(archive), null);

		expect(isFailure(result) && result.error.message).toBe(
			"a file is larger than the 10 MiB limit per file",
		);
	});

	test("refuses an entry that climbs out of the archive", async () => {
		let archive = tar([{ name: `${TOP}/../escape.txt`, type: "file", content: "x" }]);

		let result = await extract(stream(archive), null);

		expect(isFailure(result)).toBe(true);
	});
});

describe("create --template org/repo", () => {
	test("writes the extracted project, names it and reports the commit", async () => {
		serve(STARTER);
		let cwd = await mkdtemp(join(tmpdir(), "sdxc-github-"));
		DIRECTORIES.push(cwd);
		let stdout = "";

		let code = await create(
			["blog", "--template", "acme/starters"],
			{
				cwd,
				stdout: (text) => {
					stdout += text;
				},
				stderr: (text) => {
					stdout += text;
				},
			},
			{
				userAgent: "pnpm/9.0.0",
				confirm: async () => null,
				git: { available: async () => true, init: async () => success(undefined) },
			},
		);

		expect(code).toBe(0);
		expect(stdout).toBe(
			[
				"Created blog from acme/starters at 0a1b2c3",
				"",
				"Next steps:",
				"  cd blog",
				"  pnpm install",
				"",
			].join("\n"),
		);
		expect(await readFile(join(cwd, "blog/package.json"), "utf8")).toBe(
			'{\n  "name": "blog",\n  "private": true\n}\n',
		);
		expect((await readdir(join(cwd, "blog"))).sort()).toEqual([
			"empty",
			"package.json",
			"src",
			"workers",
		]);
	});
});
