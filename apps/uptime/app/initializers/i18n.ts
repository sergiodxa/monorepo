/**
 * The app's languages and message bundles, in one place so the page middleware, the email
 * translator and the command line reach the same copy. Add a language by adding its bundle under
 * `resources/locales/` and its code to `supportedLanguages` in `database/schema.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { supportedLanguages } from "~/database/schema";
import de from "~/resources/locales/de";
import en from "~/resources/locales/en";
import es from "~/resources/locales/es";
import fr from "~/resources/locales/fr";
import it from "~/resources/locales/it";
import ja from "~/resources/locales/ja";

/** The languages a page or an email renders in; the user preference column accepts the same set. */
export const SUPPORTED_LANGUAGES: string[] = [...supportedLanguages];

/** The language that answers a request asking for none the app speaks, and any key a bundle lacks. */
export const FALLBACK_LANGUAGE = "en";

/** The message bundles, one per supported language. */
export const RESOURCES = { en, es, de, ja, fr, it };
