/**
 * The dashboard's quick-check card: a URL box that probes one target once and shows what
 * came back, without creating a monitor. It is the tall card in the column beside the
 * dashboard's stat cards, dropping below them when there is no room for two columns.
 *
 * The card itself is server-rendered; only the form inside it is a client island, so
 * that a submit swaps this one frame instead of navigating the whole dashboard. The
 * result is rendered here, from what the fragment route read out of the session — never
 * assembled in the browser — which is what keeps the scripted and unscripted paths
 * showing the same thing.
 *
 * Copy arrives as resolved strings rather than through `@pkg/i18n/ui`'s `intl(handle)`,
 * because this renders only on the server, inside a fragment that already holds the
 * request-scoped `ctx.i18next`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Badge, Card, Text } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { fontSize, weight } from "@pkg/u/typography";

import type {
	QuickPingErrorCode,
	QuickPingOutcome,
	QuickPingResult,
} from "~/app/http/controllers/actions/ping";

import { badgeVariant } from "~/resources/components/badge";
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
 * Everything stacks, top to bottom, because the card is a narrow column rather than the
 * full-width strip it used to be. That vertical room is what buys back the description
 * as real copy under the heading: it is the only place a visitor is told a check saves
 * nothing and sends no alerts, and it spent a while surviving as the heading's `title`,
 * where a touch screen never showed it at all.
 *
 * The heading is a `Text` rather than a `Card.Title`, whose 2xl step is the size the
 * stat cards use for their figures — the loudest thing in this column should not be the
 * one card that holds no number.
 */
export default function QuickPing(handle: Handle<QuickPing.Props>) {
	return () => {
		let { action, src, outcome, labels } = handle.props;
		let result = outcome?.kind === "result" ? outcome : undefined;

		return (
			<Card>
				<Card.Header>
					<Text mix={[fontSize("sm"), weight("medium"), fg("neutral.emphasis")]}>
						{labels.title}
					</Text>
					<Card.Description>{labels.description}</Card.Description>
				</Card.Header>

				<Card.Content mix={[flex(), flexCol(), gap("12px")]}>
					<QuickPingForm
						action={action}
						src={src}
						url={result?.url}
						label={labels.field}
						placeholder={labels.placeholder}
						submit={labels.submit}
					/>

					{outcome?.kind === "error" && (
						<span mix={[fontSize("sm"), fg("danger")]}>{labels.error[outcome.code]}</span>
					)}

					{result && (
						<div mix={[flex(), flexCol(), gap("8px"), items("start")]}>
							<Badge {...badgeVariant(result.status)}>{labels.status[result.status]}</Badge>
							<span mix={[fontSize("sm"), fg("neutral.muted")]}>
								{result.responseStatus === null
									? labels.noResponse
									: `HTTP ${result.responseStatus}`}
								{result.responseTimeMs !== null && ` · ${Math.round(result.responseTimeMs)} ms`}
							</span>
						</div>
					)}
				</Card.Content>
			</Card>
		);
	};
}
