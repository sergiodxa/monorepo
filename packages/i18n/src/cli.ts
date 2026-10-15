/**
 * `@sdxc/cli` middleware that publishes translators to a command: `ctx.translate` binds copy to
 * each recipient's language, and `ctx.intl` and `ctx.locale` carry the command's own output in
 * the language of whoever runs it, read from the POSIX locale variables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandMiddleware } from "@sdxc/cli";

import type { I18n } from "./lib/i18n.js";
import type { Translator, TranslatorOptions } from "./lib/translator.js";

import { CurrentIntl, CurrentLocale, logError, Translators } from "./context.js";
import { pick } from "./lib/parser.js";
import { createTranslator } from "./lib/translator.js";

export { CurrentIntl, CurrentLocale, Translators } from "./context.js";

/**
 * Declared in an imported module, not an ambient .d.ts, so the augmentation applies in
 * consuming projects that import the middleware. A middleware's declared effect names one
 * property, so the two that describe the developer's own language are typed here.
 */
declare module "@sdxc/cli" {
	interface CommandContext<Arguments, Flags> {
		/** The supported language of whoever runs the command, from their locale variables. */
		readonly locale: string;
		/** Translator fixed to {@link locale}, for the command's own output. */
		readonly intl: I18n;
	}
}

/** The variables a POSIX system names a process's message language in, highest priority first. */
const LOCALE_VARIABLES = ["LC_ALL", "LC_MESSAGES", "LANG"] as const;

/** The locales that name no language, which a system sets when none was chosen. */
const NEUTRAL_LOCALES = new Set(["C", "POSIX"]);

/**
 * Publishes `ctx.translate`, the factory for text a command writes to someone else, and
 * `ctx.intl` and `ctx.locale` for the command's own output. The developer's language is the
 * first of `LC_ALL`, `LC_MESSAGES` and `LANG` that is set, matched to a supported language
 * exactly and then by primary subtag; `C`, `POSIX` or no match falls back. Message errors go to
 * the run's log unless `options.onError` takes them.
 *
 * @param options - The bundles and languages the router entry detects among.
 * @returns A middleware that installs `ctx.translate`, `ctx.intl` and `ctx.locale`.
 * @example createCLI({ name: "app", commands, middleware: [i18n({ resources, supportedLanguages, fallbackLanguage: "en" })] });
 * @example let { locale, t } = ctx.translate(user.language);
 */
export default function i18n(
	options: TranslatorOptions,
): CommandMiddleware<{ key: typeof Translators; value: Translator; property: "translate" }> {
	let translate = createTranslator({ ...options, onError: options.onError ?? logError });

	return async (ctx, next) => {
		let tag = systemLanguage(ctx.env);
		let language =
			tag === undefined
				? undefined
				: (pick(options.supportedLanguages, tag, { loose: false }) ??
					pick(options.supportedLanguages, tag, { loose: true }) ??
					undefined);
		let own = translate(language);

		ctx.set(Translators, translate, { property: "translate" });
		ctx.set(CurrentLocale, own.locale, { property: "locale" });
		ctx.set(CurrentIntl, own.intl, { property: "intl" });

		await next();
	};
}

/**
 * The BCP 47 tag of the process's message language: `es_AR.UTF-8` is `es-AR`, and the codeset
 * and `@modifier` are dropped. An empty variable counts as unset, as POSIX specifies.
 *
 * @param env - The environment the command runs in.
 * @returns The tag, or `undefined` when no variable is set or the locale is `C` or `POSIX`.
 */
function systemLanguage(env: Readonly<Record<string, string | undefined>>): string | undefined {
	for (let name of LOCALE_VARIABLES) {
		let value = env[name];
		if (value === undefined || value === "") continue;
		let tag = value.split(/[.@]/)[0] ?? "";
		if (tag === "" || NEUTRAL_LOCALES.has(tag)) return undefined;
		return tag.replaceAll("_", "-");
	}
	return undefined;
}
