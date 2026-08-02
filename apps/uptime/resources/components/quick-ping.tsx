/**
 * The dashboard's quick-check card: a URL box that probes one target once and shows what
 * came back, without creating a monitor. It is the tall card in the column beside the
 * dashboard's stat cards, dropping below them when there is no room for two columns.
 *
 * The card itself is server-rendered; only the column under its header is a client
 * island, so that a submit swaps this one frame instead of navigating the whole
 * dashboard. What a check came back as is still decided here, from what the fragment
 * route read out of the session — never assembled in the browser — and handed down as
 * finished strings, which is what keeps the scripted and unscripted paths showing the
 * same thing. The island only places them, between the field and the button where they
 * read in the order they happen.
 *
 * The card is a column that fills its grid cell so the button can sit on its bottom
 * edge: at the width where the grid gives the quick check a track of its own, this cell
 * is as tall as the two stat rows beside it, and a button floating in the middle of that
 * looked like the card had been cut short.
 *
 * Copy arrives as resolved strings rather than through `@pkg/i18n/ui`'s `intl(handle)`,
 * because this renders only on the server, inside a fragment that already holds the
 * request-scoped `ctx.i18next`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Card } from "@pkg/r3-ui";
import { flex, flexCol, grow } from "@pkg/u/layout";
import { fontSize } from "@pkg/u/typography";

import type {
	QuickPingErrorCode,
	QuickPingOutcome,
	QuickPingResult,
} from "~/app/http/controllers/actions/ping";

import QuickPingForm from "~/resources/components/quick-ping-form";

namespace QuickPing {
	export interface Props {
		/** Where the form posts; the team-scoped `run-ping` action. */
		action: string;
		/** This card's own fragment URL, which its frame reloads from after a check. */
		src: string;
		/** The previous submission's outcome, when the fragment renders right after one. */
		outcome?: QuickPingOutcome;
		/** Copy, already translated by the fragment that renders this. */
		labels: {
			title: string;
			description: string;
			field: string;
			placeholder: string;
			submit: string;
			noResponse: string;
			status: Record<QuickPingResult["status"], string>;
			error: Record<QuickPingErrorCode, string>;
		};
	}
}

/**
 * The one line under the badge: the code the target answered with and how long it took,
 * or the wording for a target that never answered at all rather than a code it never
 * sent. Assembled here so the island is handed a string it only has to draw.
 */
function resultDetail(result: QuickPingResult, noResponse: string): string {
	let code = result.responseStatus === null ? noResponse : `HTTP ${result.responseStatus}`;
	if (result.responseTimeMs === null) return code;

	return `${code} · ${Math.round(result.responseTimeMs)} ms`;
}

/**
 * Everything stacks, top to bottom, because the card is a narrow column rather than the
 * full-width strip it used to be. That vertical room is what buys back the description
 * as real copy under the heading: it is the only place a visitor is told a check saves
 * nothing and sends no alerts, and it spent a while surviving as the heading's `title`,
 * where a touch screen never showed it at all.
 *
 * The heading is a `Card.Title` stepped down from its own `2xl`, which is the size the
 * stat cards set their figures in: the one card in this grid holding no number should
 * not be the loudest thing in it, but at the caption size it started out as it did not
 * read as a title at all.
 */
export default function QuickPing(handle: Handle<QuickPing.Props>) {
	return () => {
		let { action, src, outcome, labels } = handle.props;
		let result = outcome?.kind === "result" ? outcome : undefined;

		return (
			<Card mix={[flex(), flexCol()]}>
				<Card.Header>
					<Card.Title mix={[fontSize("lg")]}>{labels.title}</Card.Title>
					<Card.Description>{labels.description}</Card.Description>
				</Card.Header>

				<Card.Content mix={[flex(), flexCol(), grow(1)]}>
					<QuickPingForm
						action={action}
						src={src}
						url={result?.url}
						label={labels.field}
						placeholder={labels.placeholder}
						submit={labels.submit}
						error={outcome?.kind === "error" ? labels.error[outcome.code] : undefined}
						result={
							result
								? {
										tone: result.status,
										status: labels.status[result.status],
										detail: resultDetail(result, labels.noResponse),
									}
								: undefined
						}
					/>
				</Card.Content>
			</Card>
		);
	};
}
