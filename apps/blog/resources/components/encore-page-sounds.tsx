/**
 * The sounds of Encore's landing outside the playable card: a deck card chirps as it turns
 * face up and falls as it turns back, and picking a tour step or a question ticks. Only the
 * reader's own clicks make a sound, never the tour advancing by itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry } from "remix/component";

import { play } from "~/resources/components/encore-sound";

/** Props of the island, which has none. */
type EncorePageSoundsProps = Record<never, never>;

/**
 * The island: a hidden span that listens, once mounted, for the page's own controls changing
 * through the reader's input. Setting a radio from script fires no `change`, so the tour's
 * autoplay stays silent. Without it the page works the same, without sound.
 */
export const EncorePageSounds = clientEntry(
	import.meta.url,
	function EncorePageSounds(handle: Handle<EncorePageSoundsProps>) {
		handle.queueTask((signal) => {
			document.addEventListener(
				"change",
				(event) => {
					let input = event.target;
					if (!(input instanceof HTMLInputElement)) return;
					if (input.closest("#deck") && input.type === "checkbox") {
						play(input.checked ? "reveal" : "conceal");
					} else if (input.closest("[data-tour]") && input.type === "radio") {
						play("tick");
					}
				},
				{ signal },
			);
			document.addEventListener(
				"click",
				(event) => {
					if (event.target instanceof Element && event.target.closest("#faq summary")) {
						play("tick");
					}
				},
				{ signal },
			);
		});

		return () => <span mix={[hidden()]} />;
	},
);
