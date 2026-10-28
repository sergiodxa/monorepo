/**
 * A titled mono panel for install samples, CLI output, or code snippets on a
 * landing. The optional actions slot holds a copy control the page supplies;
 * the library never invents a clipboard button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { m, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";

/** Panel chrome {@link CodeStage} applies when `variant` is omitted. */
const DEFAULT_VARIANT: CodeStage.Variant = "code";

/**
 * Prop types for {@link CodeStage}.
 */
export namespace CodeStage {
	/**
	 * Surface treatment: a light code card, or a darker terminal panel.
	 */
	export type Variant = "code" | "terminal";

	/**
	 * Per-part styling for chrome the stage renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the optional title bar. */
		header?: TagProps<"div">["mix"];
		/** Styling for the mono body that wraps children. */
		body?: TagProps<"pre">["mix"];
	}

	/**
	 * Props accepted by {@link CodeStage}.
	 */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Surface treatment. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Optional title or path shown in the header. */
		title?: RemixNode;
		/** Optional trailing control in the header — typically a copy button. */
		actions?: RemixNode;
		/** Per-part styling for header and body. */
		parts?: PartsProps;
		/** Mono body content — a command, snippet, or terminal output. */
		children: RemixNode;
	}
}

/**
 * Renders an optional titled header and a mono body. Prefer
 * `variant="terminal"` when the sample should read as a shell session.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the stage's markup.
 * @example
 * <CodeStage title="install.sh" actions={copyControl}>
 * 	{t("install.command")}
 * </CodeStage>
 * @example
 * <CodeStage variant="terminal" title={t("cli.prompt")}>
 * 	{t("cli.output")}
 * </CodeStage>
 */
export function CodeStage(handle: Handle<CodeStage.Props>) {
	return () => {
		let { actions, children, mix, parts, title, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let isTerminal = resolvedVariant === "terminal";
		let showHeader = title !== undefined || actions !== undefined;

		return (
			<div
				{...rest}
				data-slot="code-stage"
				data-variant={resolvedVariant}
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					rounded("lg"),
					border({ color: "neutral", width: 1, style: "solid" }),
					isTerminal
						? [
								raw({
									backgroundColor: "color-mix(in oklab, CanvasText 92%, Canvas)",
									color: "Canvas",
								}),
							]
						: bg(),
					mix,
				]}
			>
				{showHeader ? (
					<div
						mix={[
							hstack({ gap: 2, align: "center", justify: "between" }),
							p(2, 2, 2, 3),
							raw({
								borderBlockEndWidth: "1px",
								borderBlockEndStyle: "solid",
								borderBlockEndColor: isTerminal
									? "color-mix(in oklab, Canvas 18%, transparent)"
									: "var(--ui-neutral-border)",
							}),
							parts?.header,
						]}
					>
						{title ? (
							<span
								mix={[
									font("mono"),
									text("sm"),
									weight("medium"),
									isTerminal ? fg("neutral.muted") : fg("neutral"),
									isTerminal ? raw({ color: "color-mix(in oklab, Canvas 70%, transparent)" }) : [],
								]}
							>
								{title}
							</span>
						) : (
							<span />
						)}
						{actions}
					</div>
				) : null}

				<pre
					mix={[
						m(0),
						p(4),
						font("mono"),
						text("sm"),
						overflowX("auto"),
						raw({
							overscrollBehaviorInline: "contain",
							whiteSpace: "pre-wrap",
							overflowWrap: "anywhere",
						}),
						isTerminal ? raw({ color: "Canvas" }) : fg("neutral.emphasis"),
						parts?.body,
					]}
				>
					{children}
				</pre>
			</div>
		);
	};
}

/**
 * Alias for {@link CodeStage} with terminal chrome — same props, same host.
 * Prefer this name when the sample is a shell session rather than a file.
 */
export const TerminalPanel = CodeStage;
