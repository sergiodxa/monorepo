/**
 * Encore's words in every language its pages are written in, keyed by locale, so a page
 * picks one object by the reader's language and every component prints from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EncoreLocale } from "~/config/encore";
import type { EncoreCopy, EncorePagesCopy } from "~/resources/content/encore/copy";

import { EN, EN_PAGES } from "~/resources/content/encore/en";
import { ES, ES_PAGES } from "~/resources/content/encore/es-AR";
import { JA, JA_PAGES } from "~/resources/content/encore/ja";

/** The landing, header and footer in each language. */
export const ENCORE_COPY: Record<EncoreLocale, EncoreCopy> = { en: EN, "es-AR": ES, ja: JA };

/** The privacy and support pages in each language. */
export const ENCORE_PAGES_COPY: Record<EncoreLocale, EncorePagesCopy> = {
	en: EN_PAGES,
	"es-AR": ES_PAGES,
	ja: JA_PAGES,
};
