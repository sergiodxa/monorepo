/**
 * The café novel in a letterboxed 16:9 box, hydrated in the reader's browser. A novel holds
 * functions, so the island imports it rather than receiving it as props, and provides the
 * English translator the player reads its lines through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { NovelPlayer } from "@sdxc/novel/ui";
import { clientEntry, css } from "remix/component";

import { CAFE_MESSAGES, CAFE_NOVEL } from "~/resources/novel/cafe";

/** Plays the café from its first line each time the page loads, keeping no saves. */
export const CafeNovel = clientEntry(import.meta.url, function CafeNovel(_handle: Handle) {
	let i18n = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: CAFE_MESSAGES } });
	return () => (
		<div mix={css({ inlineSize: "100%", aspectRatio: "16 / 9" })}>
			<IntlProvider intl={i18n}>
				<NovelPlayer.Default novel={CAFE_NOVEL} />
			</IntlProvider>
		</div>
	);
});
