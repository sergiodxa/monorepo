/**
 * Tern's new chat: a greeting, four suggested prompts that send themselves when pressed, and
 * the composer. A suggestion is a submit button, so it starts a chat without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CodeIcon, MapIcon, PenLineIcon, SparklesIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

import type { Thread } from "~/resources/views/demo-apps/tern/thread";

import {
	ChatComposer,
	ModelPicker,
	screenHeight,
} from "~/resources/views/demo-apps/tern/conversation";
import { PERSON, actionHref } from "~/resources/views/demo-apps/tern/data";
import { TernMark, TernShell } from "~/resources/views/demo-apps/tern/shell";
import { THREAD_FIELD, writeThread } from "~/resources/views/demo-apps/tern/thread";

/** The prompts the empty chat suggests, one per kind of help Tern's canned replies cover. */
const SUGGESTIONS: Array<{ title: string; detail: string; prompt: string; icon: RemixNode }> = [
	{
		title: "Fix a bug",
		detail: "in a TypeScript function",
		prompt: "Help me fix a bug: my TypeScript function returns NaN for “5 s”.",
		icon: <CodeIcon size={16} aria-hidden="true" />,
	},
	{
		title: "Rewrite an email",
		detail: "so it is shorter and clearer",
		prompt: "Rewrite this shipping update email so it is shorter and clearer.",
		icon: <PenLineIcon size={16} aria-hidden="true" />,
	},
	{
		title: "Compare options",
		detail: "in a table with costs",
		prompt: "Compare building our site ourselves, a freelancer or an agency, as a table.",
		icon: <MapIcon size={16} aria-hidden="true" />,
	},
	{
		title: "Get unstuck",
		detail: "on where to start",
		prompt: "I want to start running but keep putting it off. Where do I start?",
		icon: <SparklesIcon size={16} aria-hidden="true" />,
	},
];

namespace HomeScreen {
	export interface Props {
		thread: Thread;
		collapsed: boolean;
	}
}

/** Renders the new chat. */
export function HomeScreen(handle: Handle<HomeScreen.Props>) {
	return () => {
		let { thread, collapsed } = handle.props;
		let firstName = PERSON.name.split(" ")[0];
		return (
			<TernShell
				current="new"
				collapsed={collapsed}
				crumb="New chat"
				flush
				actions={<ModelPicker thread={thread} linkPage="" />}
			>
				<section
					aria-labelledby="tern-home-title"
					mix={[
						screenHeight(),
						raw({
							display: "grid",
							gridTemplateRows: "minmax(0, 1fr) auto",
							gridTemplateColumns: "minmax(0, 1fr)",
							overflowY: "auto",
						}),
					]}
				>
					<div
						mix={[
							vstack({ gap: 6, align: "center", justify: "center" }),
							raw({ padding: "2rem 1rem", minBlockSize: 0 }),
						]}
					>
						<div mix={[vstack({ gap: 3, align: "center" }), raw({ textAlign: "center" })]}>
							<TernMark size={40} />
							<h1
								id="tern-home-title"
								mix={[
									m(0),
									raw({
										fontSize: "clamp(1.5rem, 1.2rem + 1.5vw, 2rem)",
										letterSpacing: "-0.02em",
									}),
									weight("semibold"),
									fg("neutral.emphasis"),
								]}
							>
								Good afternoon, {firstName}
							</h1>
							<p mix={[m(0), text("base"), fg("neutral.muted")]}>What are we working on today?</p>
						</div>
						<form
							method="post"
							data-rmx-document
							action={actionHref("chat")}
							aria-label="Suggested prompts"
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
									gap: "0.5rem",
									inlineSize: "100%",
									maxInlineSize: "46rem",
								}),
								media(
									"(min-width: 64rem)",
									raw({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }),
								),
							]}
						>
							<input type="hidden" name="intent" value="send" />
							<input type="hidden" name={THREAD_FIELD} value={writeThread(thread)} />
							<input type="hidden" name="model" value={thread.model} />
							{SUGGESTIONS.map((suggestion) => (
								<button
									type="submit"
									name="prompt"
									value={suggestion.prompt}
									mix={[
										vstack({ gap: 1, align: "start" }),
										raw({
											padding: "0.75rem 0.875rem",
											borderRadius: "var(--ui-radius-lg)",
											border: "1px solid var(--ui-neutral-border)",
											background: "var(--ui-bg)",
											color: "inherit",
											font: "inherit",
											textAlign: "start",
											cursor: "pointer",
											"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
											"&:focus-visible": {
												outline: "2px solid var(--ui-brand-ring)",
												outlineOffset: "2px",
											},
										}),
									]}
								>
									<span mix={[raw({ color: "var(--ui-brand-fg)" })]}>{suggestion.icon}</span>
									<span mix={[text("sm"), weight("semibold")]}>{suggestion.title}</span>
									<span mix={[text("xs"), fg("neutral.muted")]}>{suggestion.detail}</span>
								</button>
							))}
						</form>
					</div>
					<ChatComposer thread={thread} />
				</section>
			</TernShell>
		);
	};
}
