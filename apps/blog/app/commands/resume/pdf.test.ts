/**
 * The `resume pdf` command, which rewrites the résumé's LaTeX sources and hands each to
 * tectonic in the project's root.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test } from "vitest";

import { cli } from "~/app/initializers/cli";

const EN_SOURCE = "resources/content/resume/latex/sergio-xalambri-resume-en.tex";
const ES_SOURCE = "resources/content/resume/latex/sergio-xalambri-resume-es-AR.tex";

describe("resume pdf", () => {
	test("typesets each language's source into public/resume", async () => {
		let run = await invoke(cli, ["resume", "pdf"], {
			exec: {
				[`tectonic --outdir public/resume ${EN_SOURCE}`]: { code: 0 },
				[`tectonic --outdir public/resume ${ES_SOURCE}`]: { code: 0 },
			},
		});

		expect(run.code).toBe(0);
		expect(run.exec.map((call) => call.command)).toEqual([
			["tectonic", "--outdir", "public/resume", EN_SOURCE],
			["tectonic", "--outdir", "public/resume", ES_SOURCE],
		]);
	});

	test("uses the tectonic binary --tectonic names", async () => {
		let run = await invoke(cli, ["resume", "pdf", "--tectonic", "/opt/tectonic"], {
			exec: {
				[`/opt/tectonic --outdir public/resume ${EN_SOURCE}`]: { code: 0 },
				[`/opt/tectonic --outdir public/resume ${ES_SOURCE}`]: { code: 0 },
			},
		});

		expect(run.code).toBe(0);
		expect(run.exec[0]?.command[0]).toBe("/opt/tectonic");
	});

	test("writes only the sources with --tex-only", async () => {
		let run = await invoke(cli, ["resume", "pdf", "--tex-only"]);

		expect(run.code).toBe(0);
		expect(run.exec).toEqual([]);
		expect(run.stdout).toContain(EN_SOURCE);
	});

	test("fails when tectonic does", async () => {
		let run = await invoke(cli, ["resume", "pdf"], {
			exec: { [`tectonic --outdir public/resume ${EN_SOURCE}`]: { code: 1 } },
		});

		expect(run.code).not.toBe(0);
	});
});
