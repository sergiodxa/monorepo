/**
 * The components a documentation page renders its markdown through: fenced code as a
 * titled block with a copy button, alerts as callouts, and the docs' own tags (steps,
 * control chips, keys, product mockups, questions). Built per request so every label is translated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { RemixOptions } from "@sdxc/markdown/remix";
import type { Handle, RemixNode } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Accordion, Keyboard } from "@sdxc/ui";
import { Callout, CodeBlock, Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { MockupArea } from "~/resources/components/marketing/product-mockups";

import ProductMockup from "~/resources/components/marketing/product-mockups";

/** Languages a reader types into a shell, whose untitled blocks read as "Terminal". */
const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console"]);

/** Every area a `mockup` tag may name, so a typo draws nothing rather than the wrong screen. */
const MOCKUP_AREAS = new Set<string>([
	"dashboard",
	"monitor",
	"alerts",
	"status-page",
	"dns",
	"tcp",
	"ssl",
	"cron",
	"flow",
	"maintenance",
	"reports",
	"team",
	"api-keys",
]);

/** The five kinds GitHub's alert syntax names, from adding a fact to warning of a loss. */
type AlertKind = "note" | "tip" | "important" | "warning" | "caution";

/** Every translated string the markdown components draw. */
export interface DocsMarkdownLabels {
	copy: string;
	copied: string;
	alerts: Record<AlertKind, string>;
	/** The translator the product mockups label their own UI with. */
	t: Translate;
}

/**
 * The callout each alert kind draws as. `important` reads as a note under its own label,
 * and `caution`, which warns of a loss, draws as danger.
 */
const CALLOUT_KINDS: Record<AlertKind, Callout.Kind> = {
	note: "note",
	tip: "tip",
	important: "note",
	warning: "warning",
	caution: "danger",
};

/** The props a fenced code node arrives with: its fields plus the annotation's attributes. */
interface CodeProps {
	content: string;
	language?: string;
	tokens?: unknown;
	/** What the header reads as; the path wins when the fence wrote both. */
	title?: string;
	path?: string;
	children?: RemixNode;
}

/** Guards each painted run, so a malformed field falls back to highlighting here. */
function isToken(value: unknown): value is CodeBlock.Token {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as { type?: unknown; value?: unknown };
	return typeof candidate.type === "string" && typeof candidate.value === "string";
}

/** Narrows the parsed kind, so a kind the table lacks still draws as a note. */
function isAlertKind(kind: unknown): kind is AlertKind {
	return typeof kind === "string" && kind in CALLOUT_KINDS;
}

/** Narrows a `mockup` tag's area to one the product draws. */
function isMockupArea(area: unknown): area is MockupArea {
	return typeof area === "string" && MOCKUP_AREAS.has(area);
}

/**
 * Builds the component map for `toRemix` with the reader's labels baked in.
 *
 * @param labels - The copy button's and the alerts' translated labels, and the translator
 * @returns Components keyed by the markdown node or tag they draw
 * @example toRemix(document, { components: docsMarkdownComponents(labels) })
 */
export function docsMarkdownComponents(
	labels: DocsMarkdownLabels,
): NonNullable<RemixOptions["components"]> {
	/**
	 * Draws one fence as a titled block: the path or title the fence names, "Terminal" for
	 * an untitled shell session, or the language. Painted runs pass through unchanged.
	 */
	function DocsCode(handle: Handle<CodeProps>) {
		return () => {
			let { content, language, path, title, tokens } = handle.props;
			let runs = Array.isArray(tokens) && tokens.every(isToken) ? tokens : undefined;
			let shell = language !== undefined && SHELL_LANGUAGES.has(language);
			return (
				<CodeBlock
					code={content}
					language={language}
					tokens={runs}
					title={path ?? title ?? (shell ? "Terminal" : undefined)}
					labels={{ copy: labels.copy, copied: labels.copied }}
				/>
			);
		};
	}

	/** Draws a `> [!KIND]` alert as a callout named by its kind's translated label. */
	function DocsAlert(handle: Handle<{ kind?: unknown; children?: RemixNode }>) {
		return () => {
			let { children, kind } = handle.props;
			let resolved = isAlertKind(kind) ? kind : "note";
			return (
				<Callout kind={CALLOUT_KINDS[resolved]} label={labels.alerts[resolved]}>
					{children}
				</Callout>
			);
		};
	}

	/** Numbers the `step` tags inside it. */
	function DocsSteps(handle: Handle<{ children?: RemixNode }>) {
		return () => <Steps>{handle.props.children}</Steps>;
	}

	/** One step, titled by a heading whose `id` the "On this page" rail links. */
	function DocsStep(handle: Handle<{ id: string; title: string; children?: RemixNode }>) {
		return () => {
			let { id, title, children } = handle.props;
			return (
				<Steps.Item id={id} title={title}>
					{children}
				</Steps.Item>
			);
		};
	}

	/** A product control the reader must find, named as a chip. */
	function DocsUi(handle: Handle<{ children?: RemixNode }>) {
		return () => <UiLabel>{handle.props.children}</UiLabel>;
	}

	/** A click path through the product, one chip per control. */
	function DocsUiPath(handle: Handle<{ items: string[]; children?: RemixNode }>) {
		return () => <UiPath items={handle.props.items} />;
	}

	/** One key a reader presses. */
	function DocsKbd(handle: Handle<{ children?: RemixNode }>) {
		return () => <Keyboard>{handle.props.children}</Keyboard>;
	}

	/**
	 * The product's own screen for the task, redrawn with example data so it follows the
	 * page's theme. An area the product lacks draws nothing.
	 */
	function DocsMockup(handle: Handle<{ area: string; caption?: string; children?: RemixNode }>) {
		return () => {
			let { area, caption } = handle.props;
			if (!isMockupArea(area)) return null;
			return (
				<figure data-slot="docs-mockup" mix={[m("2rem", 0)]}>
					<ProductMockup area={area} t={labels.t} />
					{caption ? (
						<figcaption mix={[m("0.75rem", 0, 0, 0), text("sm"), fg("neutral.muted")]}>
							{caption}
						</figcaption>
					) : null}
				</figure>
			);
		};
	}

	/** A list of a reader's questions, each opening on its own. */
	function DocsFaq(handle: Handle<{ children?: RemixNode }>) {
		return () => <Accordion mix={[m("1.5rem", 0)]}>{handle.props.children}</Accordion>;
	}

	/** One question, whose answer opens under it. */
	function DocsQuestion(handle: Handle<{ title: string; children?: RemixNode }>) {
		return () => (
			<Accordion.Item>
				<Accordion.Trigger>
					{handle.props.title}
					<ChevronDownIcon data-slot="icon" aria-hidden="true" />
				</Accordion.Trigger>
				<Accordion.Content>{handle.props.children}</Accordion.Content>
			</Accordion.Item>
		);
	}

	return {
		code: DocsCode,
		alert: DocsAlert,
		steps: DocsSteps,
		step: DocsStep,
		ui: DocsUi,
		uipath: DocsUiPath,
		kbd: DocsKbd,
		mockup: DocsMockup,
		faq: DocsFaq,
		question: DocsQuestion,
	};
}
