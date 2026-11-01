/**
 * Connecting an assistant over the Model Context Protocol: minting a token and choosing
 * its scope, configuring a client, what the tools can do, and the caps on tokens and calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { AgentsScene } from "~/resources/components/marketing/scenes";
import { Faq, H2, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "what", text: "What an assistant can do", level: 2 },
	{ id: "connect", text: "Connect one", level: 2 },
	{ id: "revoke", text: "Revoke a token", level: 2 },
	{ id: "questions", text: "Questions", level: 2 },
];

/** The agents guide's body. */
export default function Agents(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2 id="what">What an assistant can do</H2>
				<p>
					Reader answers the Model Context Protocol (MCP), so an assistant can read your feeds
					without you opening Reader. With {figures.toolCount} tools it can list what you follow,
					read your queue and search it, and, with a write token, mark posts read, save them, and
					follow or unfollow a feed.
				</p>
				<Scene caption="An assistant asked what is new, answering from your queue.">
					<AgentsScene t={t} />
				</Scene>

				<H2 id="connect">Connect one</H2>
				<Steps>
					<Steps.Item title="Mint a token">
						<p>
							In <UiPath items={["Settings", "Agents"]} />, fill in{" "}
							<UiLabel>What is this for?</UiLabel> so you recognise the token later, and choose{" "}
							<UiLabel>What it may do</UiLabel>: <UiLabel>Read only</UiLabel> or{" "}
							<UiLabel>Read and write</UiLabel>. Press <UiLabel>Mint a token</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Copy it now">
						<p>
							The token is shown once. Copy it before leaving the page; mint another if you lose it.
						</p>
					</Steps.Item>
					<Steps.Item title="Configure your client">
						<p>
							Give your assistant's client the address Settings shows, ending in <code>/mcp</code>,
							and the token as a bearer token.
						</p>
					</Steps.Item>
					<Steps.Item title="Ask">
						<p>Ask your assistant what is new. It reads your queue rather than a browser.</p>
					</Steps.Item>
				</Steps>
				<Callout kind="tip" label="Tip">
					<p>
						Choose Read only unless the assistant needs to act. A read token can never mark, save,
						follow or unfollow anything.
					</p>
				</Callout>

				<H2 id="revoke">Revoke a token</H2>
				<p>
					Settings lists every token with when it was last used and when it expires. Press{" "}
					<UiLabel>Revoke</UiLabel> and it stops answering from the next call.
				</p>

				<H2 id="questions">Questions</H2>
				<Faq
					items={[
						{
							question: "Which clients work?",
							answer: (
								<p>
									Any client that lets you set a bearer token in its configuration. A client that
									can only sign in through an authorization flow has nothing to sign in against
									here.
								</p>
							),
						},
						{
							question: "Is there a limit?",
							answer: (
								<p>
									You can hold {figures.tokenLimit} tokens. Each lasts {figures.tokenDays} days and
									has {figures.agentCalls} calls a day, and says so when they are spent.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
