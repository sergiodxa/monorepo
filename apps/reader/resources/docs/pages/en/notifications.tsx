/**
 * Notifications: picking the feeds worth an interruption, turning on push and email,
 * allowing a browser, quiet hours, and how often each plan's checks can reach you.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { NotifyScene } from "~/resources/components/marketing/scenes";
import { Faq, H2, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "how", text: "How notifications work", level: 2 },
	{ id: "set-up", text: "Set them up", level: 2 },
	{ id: "quiet", text: "Quiet hours", level: 2 },
	{ id: "browsers", text: "Your browsers", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The notifications guide's body. */
export default function Notifications(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2 id="how">How notifications work</H2>
				<p>
					Reader checks your feeds in the background, every {figures.paidCheck} on Paid and every{" "}
					{figures.premiumCheck} on Premium. When a check finds posts in a feed you picked, you get
					one notification about all of them. Nothing is ever sent about a feed you have not picked.
				</p>
				<Scene caption="One notification naming every picked feed a check found posts in.">
					<NotifyScene t={t} />
				</Scene>

				<H2 id="set-up">Set them up</H2>
				<Steps>
					<Steps.Item title="Pick a feed">
						<p>
							On the feed's page, choose{" "}
							<UiPath items={["More actions", "Notify me about this feed"]} />. Repeat for each feed
							worth hearing about.
						</p>
					</Steps.Item>
					<Steps.Item title="Choose how you are reached">
						<p>
							In <UiPath items={["Settings", "Notifications"]} />, under{" "}
							<UiLabel>How you are reached</UiLabel>, turn on{" "}
							<UiLabel>On the browsers you allow</UiLabel>, <UiLabel>By email</UiLabel>, or both,
							and press <UiLabel>Save</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Allow this browser">
						<p>
							For push, press <UiLabel>Allow notifications in this browser</UiLabel> and accept your
							browser's prompt. It asks once, and nothing is sent until you allow it.
						</p>
					</Steps.Item>
				</Steps>
				<Callout kind="note" label="Note">
					<p>
						Email comes with Premium and arrives at most once every {figures.emailGapHours} hours.
						Push arrives at most once every {figures.pushGapMinutes} minutes.
					</p>
				</Callout>

				<H2 id="quiet">Quiet hours</H2>
				<p>
					Under <UiLabel>Quiet hours</UiLabel>, turn on{" "}
					<UiLabel>Leave me alone between these hours</UiLabel>, choose <UiLabel>From</UiLabel> and{" "}
					<UiLabel>Until</UiLabel>, and save. The hours are in the time zone your browser reports. A
					notification held back is not lost: the next check outside the window carries it.
				</p>

				<H2 id="browsers">Your browsers</H2>
				<p>
					<UiLabel>Browsers</UiLabel> lists every browser you allowed, with when it last got a
					notification. Press <UiLabel>Forget</UiLabel> to stop notifying one.
				</p>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "Does it work on my phone?",
							answer: (
								<p>
									Yes, in a browser that supports web push, including an iPhone with Reader added to
									the home screen.
								</p>
							),
						},
						{
							question: "How do I stop the emails?",
							answer: <p>Every email has a link that stops them. Turn them back on in Settings.</p>,
						},
						{
							question: "Why don't I get notifications on Free?",
							answer: (
								<p>
									Notifications come from the background checks, which Paid and Premium run. On
									Free, new posts arrive when you open Reader.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
