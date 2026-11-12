/**
 * The canvas: the document a conversation wrote, open beside the chat so it can be read and
 * copied while the conversation carries on. It is the split view's detail pane and streams in
 * as a frame, so the chat answers before the document is drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { XIcon } from "@sdxc/icons";
import { borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grow, hstack, vstack } from "@sdxc/u/layout";
import { m, p, pb, pi } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Badge, LinkButton, Typeset } from "@sdxc/ui";
import { CodeBlock } from "@sdxc/ui/docs/code-block";

import type { Conversation } from "~/resources/views/demo-apps/tern/data";

import { href } from "~/resources/views/demo-apps/tern/data";
import { Ghost, GhostBlock } from "~/resources/views/demo-apps/tern/ghost";

/** The code block's copy strings. */
const CODE_LABELS = { copy: "Copy code", copied: "Copied" };

namespace CanvasPane {
	export interface Props {
		conversation: Conversation;
		/** Draws the pane as its placeholder: the same lines as bars, with no controls. */
		ghost?: boolean;
	}
}

/** The canvas header: the document's title and version, and Close back to the chat. */
function CanvasHeader(handle: Handle<CanvasPane.Props>) {
	return () => {
		let { conversation, ghost = false } = handle.props;
		let canvas = conversation.canvas;
		if (!canvas) return null;
		let titleMix = [m(0), text("base"), weight("semibold"), truncate(), raw({ minInlineSize: 0 })];
		return (
			<header
				mix={[
					hstack({ gap: 2, align: "center" }),
					pi(4),
					pb(2.5),
					borderEdge("bottom", { width: 1, color: "neutral" }),
					raw({ minBlockSize: "3.25rem", boxSizing: "border-box" }),
				]}
			>
				{ghost ? (
					<div mix={titleMix}>
						<Ghost>{canvas.title}</Ghost>
					</div>
				) : (
					<h2 id="tern-canvas-title" mix={titleMix}>
						{canvas.title}
					</h2>
				)}
				<Badge variant="secondary" color="neutral">
					{ghost ? <Ghost>{`v${canvas.version}`}</Ghost> : `v${canvas.version}`}
				</Badge>
				<span mix={[grow()]} />
				{ghost ? (
					<span mix={[raw({ inlineSize: "2rem", blockSize: "2rem" })]} />
				) : (
					<LinkButton
						href={href(`c/${conversation.id}`)}
						variant="ghost"
						color="neutral"
						size="sm"
						aria-label="Close canvas"
						title="Close canvas"
						mix={[raw({ inlineSize: "2rem", paddingInline: 0, justifyContent: "center" })]}
					>
						<XIcon size={16} aria-hidden="true" />
					</LinkButton>
				)}
			</header>
		);
	};
}

/** The document itself: code with line numbers, or prose at a reading measure. */
function CanvasBody(handle: Handle<{ conversation: Conversation }>) {
	return () => {
		let canvas = handle.props.conversation.canvas;
		if (!canvas) return null;
		if (canvas.kind === "code") {
			return (
				<div mix={[p(4)]}>
					<CodeBlock
						code={canvas.content}
						language={canvas.language}
						title={canvas.title}
						labels={CODE_LABELS}
						codeId="tern-canvas-code"
						lineNumbers
					/>
				</div>
			);
		}
		return (
			<div mix={[p(6)]}>
				<Typeset preset="reading" mix={[raw({ maxInlineSize: "38rem", marginInline: "auto" })]}>
					{canvas.content.split("\n\n").map((paragraph) => (
						<p>{paragraph}</p>
					))}
				</Typeset>
			</div>
		);
	};
}

/** The note under the document, as text or, in the placeholder, as bars. */
function CanvasNote(handle: Handle<{ ghost?: boolean }>) {
	return () => {
		let note = "Edited by Tern from the conversation. Copy it out to keep your changes.";
		return (
			<p mix={[m(0), pi(4), pb(3), text("xs"), fg("neutral.muted")]}>
				{handle.props.ghost ? <Ghost>{note}</Ghost> : note}
			</p>
		);
	};
}

/** Renders the canvas, or its placeholder when `ghost`. */
export function CanvasPane(handle: Handle<CanvasPane.Props>) {
	return () => {
		let { conversation, ghost = false } = handle.props;
		if (ghost) {
			return (
				<div
					data-slot="tern-canvas"
					aria-hidden="true"
					mix={[vstack({ gap: 0, align: "stretch" })]}
				>
					<CanvasHeader conversation={conversation} ghost />
					<GhostBlock>
						<CanvasBody conversation={conversation} />
					</GhostBlock>
					<CanvasNote ghost />
				</div>
			);
		}
		return (
			<article
				data-slot="tern-canvas"
				aria-labelledby="tern-canvas-title"
				mix={[vstack({ gap: 0, align: "stretch" })]}
			>
				<CanvasHeader conversation={conversation} />
				<CanvasBody conversation={conversation} />
				<CanvasNote />
			</article>
		);
	};
}
