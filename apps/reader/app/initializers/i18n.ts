/**
 * The app's languages and dictionaries, in one place so the request middleware and the command
 * line reach the same copy. Add a language by adding its dictionary under `resources/locales/`
 * and listing it in {@link SUPPORTED_LANGUAGES}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import en from "~/resources/locales/en";
import es from "~/resources/locales/es";

/** Every language the app ships a full dictionary for, and the order a detector matches in. */
export const SUPPORTED_LANGUAGES = ["en", "es"];

/** The language that answers a request asking for none the app speaks, and any key Spanish lacks. */
export const FALLBACK_LANGUAGE = "en";

/** The dictionaries, one per supported language. */
export const RESOURCES = { en, es };
