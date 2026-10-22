/**
 * Covers the command-line i18n middleware run through a real CLI: the developer's language read
 * from the POSIX locale variables in priority order, the fallback for neutral or unsupported
 * locales, and the translator factory bound per recipient under the shared context keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, createCLI, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vite-plus/test";

import i18n, { CurrentIntl, CurrentLocale, Translators } from "./cli.js";

/** Bundles with a key shared across languages and one English-only key. */
const RESOURCES = {
	en: { hello: "Hello", invite: "Join us, {$name}", onlyEnglish: "English only" },
	es: { hello: "Hola", invite: "Únete, {$name}" },
};

/** A CLI whose `hello` prints in the developer's language and `invite` in the recipient's. */
function createApp() {
	let contract = commands({
		hello: command({}),
		invite: command({ arguments: { language: argument(s.string()) } }),
		keys: command({}),
	});
	let cli = createCLI({
		name: "app",
		commands: contract,
		middleware: [
			i18n({ resources: RESOURCES, supportedLanguages: ["en", "es"], fallbackLanguage: "en" }),
		],
	});
	cli.map(contract.hello, (ctx) => {
		ctx.stdout(`${ctx.locale} ${ctx.intl.t("hello")} ${ctx.intl.t("onlyEnglish")}\n`);
		return success();
	});
	cli.map(contract.invite, (ctx) => {
		let { locale, t } = ctx.translate(ctx.arguments.language);
		ctx.stdout(`${locale} ${t("invite", { name: "Ada" })}\n`);
		return success();
	});
	cli.map(contract.keys, (ctx) => {
		let same =
			ctx.get(CurrentLocale) === ctx.locale &&
			ctx.get(CurrentIntl) === ctx.intl &&
			ctx.get(Translators) === ctx.translate;
		ctx.stdout(`${same}\n`);
		return success();
	});
	return cli;
}

describe("i18n command middleware", () => {
	test("reads the developer's language from LANG", async () => {
		let run = await invoke(createApp(), ["hello"], { env: { LANG: "es_AR.UTF-8" } });

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("es Hola English only\n");
	});

	test("prefers LC_ALL, then LC_MESSAGES, over LANG", async () => {
		let all = await invoke(createApp(), ["hello"], {
			env: { LC_ALL: "es_ES.UTF-8", LC_MESSAGES: "en_US.UTF-8", LANG: "en_US.UTF-8" },
		});
		let messages = await invoke(createApp(), ["hello"], {
			env: { LC_ALL: "", LC_MESSAGES: "es_MX@euro", LANG: "en_US.UTF-8" },
		});

		expect(all.stdout).toBe("es Hola English only\n");
		expect(messages.stdout).toBe("es Hola English only\n");
	});

	test("falls back for C, POSIX, an unsupported language, or no locale at all", async () => {
		for (let env of [{ LC_ALL: "C" }, { LANG: "POSIX" }, { LANG: "fr_FR.UTF-8" }, {}]) {
			let run = await invoke(createApp(), ["hello"], { env: { ...env } });
			expect(run.stdout).toBe("en Hello English only\n");
		}
	});

	test("binds text for a recipient to their language, recording the one it bound", async () => {
		let spanish = await invoke(createApp(), ["invite", "es"], { env: { LANG: "en_US.UTF-8" } });
		let unsupported = await invoke(createApp(), ["invite", "de"], { env: { LANG: "es_AR" } });

		expect(spanish.stdout).toBe("es Únete, Ada\n");
		expect(unsupported.stdout).toBe("en Join us, Ada\n");
	});

	test("publishes under the keys the router entry shares", async () => {
		let run = await invoke(createApp(), ["keys"]);

		expect(run.stdout).toBe("true\n");
	});
});
