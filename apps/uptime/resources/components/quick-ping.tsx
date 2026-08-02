/**
 * The dashboard's quick-check card: a URL box that probes one target once and shows what
 * came back, without creating a monitor. Rendered above the dashboard's stat cards,
 * since it is the one control on the page that answers a question about something the
 * team is *not* already monitoring.
 *
 * The card itself is server-rendered; only the form inside it is a client island, so
 * that a submit swaps this one frame instead of navigating the whole dashboard. The
 * result below the form is rendered here, from what the fragment route read out of the
 * session — never assembled in the browser — which is what keeps the scripted and
 * unscripted paths showing the same thing.
 *
 * Copy arrives as resolved strings rather than through `@pkg/i18n/ui`'s `intl(handle)`,
 * because this renders only on the server, inside a fragment that already holds the
 * request-scoped `ctx.i18next`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Badge, Card } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexWrap, gap, items } from "@pkg/u/layout";
import { mbe, mbs } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";

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

/** URL box plus, when there is one, the last check's status, code and timing. */
export default function QuickPing(handle: Handle<QuickPing.Props>) {
	return () => {
		let { action, src, outcome, labels } = handle.props;
		let result = outcome?.kind === "result" ? outcome : undefined;

		return (
			<Card mix={[mbe("16px")]}>
				<Card.Header>
					<Card.Title>{labels.title}</Card.Title>
					<Card.Description>{labels.description}</Card.Description>
				</Card.Header>

				<Card.Content>
					<QuickPingForm
						action={action}
						src={src}
						url={result?.url}
						label={labels.field}
						placeholder={labels.placeholder}
						submit={labels.submit}
					/>

					{outcome?.kind === "error" && (
						<p mix={[fontSize("sm"), fg("danger"), mbs("16px")]}>{labels.error[outcome.code]}</p>
					)}

					{result && (
						<div mix={[flex(), flexWrap(), gap("8px"), items("center"), mbs("16px")]}>
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
