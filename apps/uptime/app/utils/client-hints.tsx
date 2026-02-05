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
