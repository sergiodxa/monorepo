/**
 * The `resume pdf` command, which typesets each language's résumé into a directory, run here
 * against a temporary one so the checked-in PDFs stay as the command last wrote them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

describe("resume pdf", () => {
	let out = "";
	beforeEach(async () => {
		out = await mkdtemp(join(tmpdir(), "resume-pdf-"));
	});
	afterEach(async () => {
		await rm(out, { recursive: true, force: true });
	});

	test("writes each language's PDF into the --out directory", async () => {
		let run = await invoke(cli, ["resume", "pdf", "--out", out]);

		expect(run.code).toBe(0);
		expect(run.exec).toEqual([]);
		expect((await readdir(out)).sort()).toEqual([
			"sergio-xalambri-resume-en.pdf",
			"sergio-xalambri-resume-es-AR.pdf",
		]);
		expect(run.stdout).toContain(join(out, "sergio-xalambri-resume-en.pdf"));
	});
});
