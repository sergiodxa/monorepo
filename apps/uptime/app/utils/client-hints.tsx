/**
 * Client hints wiring built on `@epic-web/client-hints`. It configures the time-zone hint,
 * exports `getHints` for server use, a `ClientHintCheck` script component that revalidates
 * on color-scheme changes, and a `useHints` hook to read hints from the root loader data.
 * It exists so the app can adapt rendering to the user's time zone and preferred theme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getHintUtils } from "@epic-web/client-hints";
import { subscribeToSchemeChange } from "@epic-web/client-hints/color-scheme";
import { clientHint as timeZoneHint } from "@epic-web/client-hints/time-zone";
import { useEffect } from "react";
import { useRevalidator, useRouteLoaderData } from "react-router";

import type { loader } from "~/root";

let hintsUtils = getHintUtils({ timeZone: timeZoneHint });

export const { getHints } = hintsUtils;

export function ClientHintCheck({ nonce }: { nonce: string }) {
	let { revalidate } = useRevalidator();
	useEffect(() => subscribeToSchemeChange(() => revalidate()), [revalidate]);

	return (
		<script
			nonce={nonce}
			dangerouslySetInnerHTML={{
				__html: hintsUtils.getClientHintCheckScript(),
			}}
		/>
	);
}

export function useHints() {
	return useRouteLoaderData<typeof loader>("root")?.hints;
}
