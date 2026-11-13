/**
 * The integrations band: where recordings come from, and the pricing call's notes fanning
 * out to the tools a team already works in, each target showing exactly what it received.
 * The fan-out is the one place on the page where the notes leave Margin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CalendarIcon,
	FileTextIcon,
	HashIcon,
	ListChecksIcon,
	MailIcon,
	SquareCheckIcon,
	WebhookIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { FanOutDiagram, LandingHeader, LandingSection, Split } from "@sdxc/ui/landing";

import { ACTION_ITEMS, MEETING_TITLE } from "~/resources/views/demos/ai/meeting";
import { MONO } from "~/resources/views/demos/ai/type";
import { renderNearView } from "~/resources/views/demos/near-view";

/** Where recordings come in from, in the order teams most often connect them. */
const SOURCES = [
	"Zoom",
	"Google Meet",
	"Microsoft Teams",
	"Any audio or video file up to 4 hours",
] as const;

/** Each place the notes go, and what that place receives from this one call. */
const TARGETS: readonly FanOutDiagram.Target[] = [
	{
		icon: <SquareCheckIcon size={14} aria-hidden="true" />,
		title: "Linear",
		detail: `${ACTION_ITEMS.length} issues, owners set`,
	},
	{
		icon: <HashIcon size={14} aria-hidden="true" />,
		title: "Slack",
		detail: "summary in #pricing",
	},
	{ icon: <FileTextIcon size={14} aria-hidden="true" />, title: "Notion", detail: "notes page" },
	{
		icon: <CalendarIcon size={14} aria-hidden="true" />,
		title: "Calendar",
		detail: "Friday: Ana’s draft",
	},
	{ icon: <MailIcon size={14} aria-hidden="true" />, title: "Email", detail: "recap to 3 people" },
	{
		icon: <WebhookIcon size={14} aria-hidden="true" />,
		title: "Webhook",
		detail: "POST notes.json",
	},
];

/**
 * Renders the copy and the recording sources beside the fan-out. The diagram's still
 * state is every target delivered, which is what reduced motion shows.
 *
 * @returns The render function producing the band.
 */
export default function MarginIntegrations() {
	return () => (
		<LandingSection id="integrations" mix={[renderNearView(560, 1100)]}>
			<Split>
				<Split.Copy>
					<LandingHeader
						eyebrow="Integrations"
						description={
							<>
								Margin joins the calls on your calendar or takes a file you drop in. When the notes
								are approved, <strong>each to-do lands where your team tracks work</strong>, still
								carrying its timestamp.
							</>
						}
					>
						The to-dos leave the meeting
					</LandingHeader>
					<div>
						<p
							mix={[
								raw({
									margin: "0 0 0.5rem",
									fontFamily: MONO,
									fontSize: "0.6875rem",
									textTransform: "uppercase",
									letterSpacing: "0.06em",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Records from
						</p>
						<ul
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									gap: "0.5rem",
									margin: "0",
									padding: "0",
									listStyle: "none",
								}),
							]}
						>
							{SOURCES.map((source) => (
								<li
									mix={[
										raw({
											paddingBlock: "0.25rem",
											paddingInline: "0.625rem",
											borderRadius: "0.375rem",
											boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
											fontSize: "0.875rem",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									{source}
								</li>
							))}
						</ul>
					</div>
				</Split.Copy>
				<Split.Media>
					<FanOutDiagram
						aria-label={`The notes from “${MEETING_TITLE}” sent to six tools`}
						pauseLabel="Pause the diagram"
						source={{
							icon: <ListChecksIcon size={14} aria-hidden="true" />,
							title: "Notes approved",
							detail: `${MEETING_TITLE} · ${ACTION_ITEMS.length} to-dos`,
						}}
						targets={TARGETS}
						outcome="Sent to 6 places"
						footnote="Each item links back to its line"
					/>
				</Split.Media>
			</Split>
		</LandingSection>
	);
}
