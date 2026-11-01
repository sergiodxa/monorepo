/**
 * The content blocks every docs demo writes its pages with: the kit's headings, code,
 * install lines, asides and field tables with their strings filled in once, so a page
 * reads as its prose and its examples rather than as repeated labels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HeadingLevel } from "@sdxc/ui";
import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { font, text, weight } from "@sdxc/u/typography";
import {
	AnchorHeading,
	Callout,
	CodeBlock,
	CodeTabs,
	InstallCommand,
	PropsTable,
} from "@sdxc/ui/docs";

/** The copy button's strings on every code block of every demo. */
export const CODE_LABELS: CodeBlock.Labels = { copy: "Copy code", copied: "Copied" };

/** The column headings and disclosure words of every field table. */
export const PROPS_LABELS: PropsTable.Labels = {
	name: "Name",
	type: "Type",
	default: "Default",
	required: "Required",
	description: "Description",
	yes: "Required",
	no: "Optional",
	showChildren: "Show child fields",
	hideChildren: "Hide child fields",
};

/** The visible name of each kind of aside. */
const CALLOUT_LABELS: Record<Callout.Kind, string> = {
	note: "Note",
	tip: "Tip",
	warning: "Warning",
	danger: "Danger",
};

namespace Heading {
	export interface Props {
		/** The fragment the heading answers to, which the page's `toc` lists. */
		id: string;
		/** @default 2 */
		level?: HeadingLevel;
		/** Sets the heading in the monospace face, for a name a reader types. */
		mono?: boolean;
		children: string;
	}
}

/** A section heading with its `#` link, named after its own text for a screen reader. */
export function Heading(handle: Handle<Heading.Props>) {
	return () => {
		let { children, id, level = 2, mono = false } = handle.props;
		return (
			<AnchorHeading
				id={id}
				level={level}
				linkLabel={`Link to ${children}`}
				mix={mono ? [font("mono"), raw({ letterSpacing: "-0.01em" })] : []}
			>
				{children}
			</AnchorHeading>
		);
	};
}

namespace Code {
	export interface Props {
		code: string;
		language?: string;
		/** The file the code belongs in, or "Terminal". */
		title?: string;
		highlight?: number[];
		add?: number[];
		remove?: number[];
	}
}

/** A titled code block with the demos' copy strings. */
export function Code(handle: Handle<Code.Props>) {
	return () => <CodeBlock {...handle.props} labels={CODE_LABELS} />;
}

namespace Install {
	export interface Props {
		packages: string[];
		dev?: boolean;
		/** The manager the reader picked on another page, read from their cookie. */
		selected?: string;
	}
}

/** An install line in every package manager, remembered across the demo's pages. */
export function Install(handle: Handle<Install.Props>) {
	return () => (
		<InstallCommand
			{...handle.props}
			persist="cookie"
			title="Terminal"
			labels={CODE_LABELS}
			aria-label="Package manager"
		/>
	);
}

namespace Aside {
	export interface Props {
		kind: Callout.Kind;
		/** A specific heading in place of the kind's name. */
		title?: string;
		/** One paragraph of inline content, set as a single paragraph so inline code stays in its line. */
		children: RemixNode;
	}
}

/** A note, tip, warning or danger, labelled with its kind. */
export function Aside(handle: Handle<Aside.Props>) {
	return () => {
		let { children, kind, title } = handle.props;
		return (
			<Callout kind={kind} label={CALLOUT_LABELS[kind]} title={title}>
				<p>{children}</p>
			</Callout>
		);
	};
}

namespace Fields {
	export interface Props {
		rows: readonly PropsTable.Row[];
		/** Names the table for a reader who reaches it without the heading above it. */
		label: string;
	}
}

/** A table of options or API fields whose nested fields fold under their parent. */
export function Fields(handle: Handle<Fields.Props>) {
	return () => (
		<PropsTable rows={handle.props.rows} labels={PROPS_LABELS} aria-label={handle.props.label} />
	);
}

namespace LanguageTabs {
	export interface Props {
		/** One snippet per language, keyed by the language's tab value. */
		tabs: Array<{ label: string; value: string; code: string; language: string; title?: string }>;
		/**
		 * Every set with this key switches together, and the browser remembers the choice for
		 * the demo's other pages once the page's script has loaded.
		 */
		syncKey: string;
		"aria-label": string;
	}
}

/** The same example in several languages, synced across the page and remembered locally. */
export function LanguageTabs(handle: Handle<LanguageTabs.Props>) {
	return () => {
		let { syncKey, tabs } = handle.props;
		return (
			<CodeTabs
				syncKey={syncKey}
				persist="local"
				aria-label={handle.props["aria-label"]}
				tabs={tabs.map((tab) => ({
					label: tab.label,
					value: tab.value,
					children: (
						<CodeBlock
							code={tab.code}
							language={tab.language}
							title={tab.title}
							labels={CODE_LABELS}
						/>
					),
				}))}
			/>
		);
	};
}

namespace Signature {
	export interface Props {
		/** The call as a reader types it, such as `addDays(date, amount)`. */
		code: string;
		/** What it returns, drawn after an arrow. */
		returns: string;
	}
}

/**
 * A function's signature on one line with what it returns, set in the monospace face, so a
 * reference reads as the calls a reader types.
 */
export function Signature(handle: Handle<Signature.Props>) {
	return () => (
		<p
			data-not-typeset=""
			mix={[
				raw({ marginBlock: "var(--ui-typeset-flow, 1rem) 0", marginInline: 0 }),
				hstack({ gap: 2, align: "baseline" }),
				raw({
					flexWrap: "wrap",
					padding: "0.625rem 0.875rem",
					borderRadius: "var(--ui-radius-md, 0.375rem)",
					backgroundColor: "var(--ui-neutral-bg-tint)",
					boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
					overflowWrap: "anywhere",
				}),
				font("mono"),
				text("sm"),
			]}
		>
			<code mix={[fg("neutral.emphasis"), weight("medium")]}>{handle.props.code}</code>
			<span aria-hidden="true" mix={[fg("neutral.muted")]}>
				→
			</span>
			<span mix={[visuallyHidden()]}>returns</span>
			<code mix={[fg("brand")]}>{handle.props.returns}</code>
		</p>
	);
}
