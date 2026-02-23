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
