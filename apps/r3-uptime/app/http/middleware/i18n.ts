/**
 * Language-resolution middleware. Picks the request's UI language — signed-in user's
 * `user_preferences.preferred_language`, then the `language` cookie, then the
 * `Accept-Language` header, falling back to English — and exposes it as `ctx.t()` (see
 * `app/services/translator.ts` for why this app uses a typed dictionary lookup instead
 * of an i18next runtime) and `ctx.language`. Must run after `auth`, which resolves
 * `getViewer()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/fetch-router";

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { Translate } from "~/app/services/translator";
import type { SupportedLanguage } from "~/database/schema";

import { language as languageCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";
import { createTranslator } from "~/app/services/translator";
import { supportedLanguages, userPreferences } from "~/database/schema";

declare module "remix/fetch-router" {
	interface RequestContext {
		language: SupportedLanguage;
		t: Translate;
	}
}

const LOCALES: Record<SupportedLanguage, Record<string, unknown>> = { en, es, de, ja, fr, it };
const DEFAULT_LANGUAGE: SupportedLanguage = "en";

/** Resolves the request language and attaches `ctx.language`/`ctx.t`. */
export let i18n: Middleware = async (ctx, next) => {
	let language = await resolveLanguage(ctx.request);
	ctx.language = language;
	ctx.t = createTranslator(LOCALES[language]);
	return next();
};

export default i18n;

/** Type guard narrowing an arbitrary string to a `SupportedLanguage`. */
function isSupportedLanguage(value: string): value is SupportedLanguage {
	return (supportedLanguages as readonly string[]).includes(value);
}

async function resolveLanguage(request: Request): Promise<SupportedLanguage> {
	let viewer = getViewer();
	if (viewer) {
		let db = getServiceContainer().get(Database);
		let preferences = await db.findOne(userPreferences, { where: { subject_id: viewer.id } });
		if (preferences?.preferred_language) return preferences.preferred_language;
	}

	let cookieValue = await languageCookie.parse(request.headers.get("Cookie"));
	if (cookieValue && isSupportedLanguage(cookieValue)) return cookieValue;

	let acceptLanguage = request.headers.get("Accept-Language");
	if (acceptLanguage) {
		for (let tag of acceptLanguage.split(",")) {
			let primary = tag.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
			if (primary && isSupportedLanguage(primary)) return primary;
		}
	}

	return DEFAULT_LANGUAGE;
}
