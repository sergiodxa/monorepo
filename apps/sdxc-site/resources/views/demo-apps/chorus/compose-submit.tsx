/**
 * Client island: sends a new post from any composer and opens the post's own page in the main
 * frame, as a step in history, so Back returns to where it was written. A post the server
 * refuses, or one sent while offline, falls back to the form's own whole-page submit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { clientEntry, navigate, ref } from "remix/component";

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type ComposeSubmitProps = {
	/** The frame a new post's page opens in. */
	frame: string;
};

/**
 * Takes over its form's submit: posts it in the background, closes the dialog it sits in, and
 * once the server answers with the new post's address, empties the form and opens that page; a
 * navigation the visitor starts meanwhile replaces that one.
 */
export const ComposeSubmit: EntryComponent<ComposeSubmitProps> = clientEntry(
	import.meta.url,
	function ComposeSubmit(handle) {
		return () => (
			<span
				hidden
				mix={[
					ref((node: HTMLElement, signal) => {
						let form = node.closest("form");
						if (!form) return;
						form.addEventListener(
							"submit",
							async (event) => {
								if (event.defaultPrevented) return;
								event.preventDefault();
								let body = new URLSearchParams(
									Array.from(new FormData(form), ([name, value]) => [
										name,
										typeof value === "string" ? value : value.name,
									]),
								);
								form.closest("dialog")?.close();
								let response = await fetch(form.action, {
									method: "POST",
									body,
									headers: {
										accept: "text/html",
										"x-remix-frame": "true",
										"x-remix-target": handle.props.frame,
									},
								}).catch(() => null);
								if (!response?.ok || !response.redirected) return form.submit();
								form.reset();
								await navigate(response.url, { target: handle.props.frame }).catch(() => undefined);
							},
							{ signal },
						);
					}),
				]}
			/>
		);
	},
);
