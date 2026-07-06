/**
 * Client hints utilities for the blog app. Builds an epic-web client-hints
 * helper for the user's time zone, exporting getHints for the loader, a
 * ClientHintCheck script component that seeds the hints on first load, and a
 * useHints hook that reads them from the root loader data. This lets the app
 * render time-zone-aware output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getHintUtils } from "@epic-web/client-hints";
import { clientHint as timeZoneHint } from "@epic-web/client-hints/time-zone";
import { useRouteLoaderData } from "react-router";

let hintsUtils = getHintUtils({ timeZone: timeZoneHint });

export let { getHints } = hintsUtils;

export type Hints = ReturnType<typeof getHints>;

export function ClientHintCheck({ nonce }: { nonce?: string }) {
	return (
		<script
			nonce={nonce}
			// eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
			dangerouslySetInnerHTML={{
				__html: hintsUtils.getClientHintCheckScript(),
			}}
		/>
	);
}

export function useHints(): Hints | undefined {
	let data = useRouteLoaderData("root") as { hints?: Hints } | undefined;
	return data?.hints;
}
