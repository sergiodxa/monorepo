/**
 * The Foundations page each `@sdxc/ui` namespace opens its sidebar group with: what the
 * namespace solves, the ideas its components share, and every CSS variable it reads or
 * declares. One record per namespace feeds the page, its Markdown twin and the sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ComponentModule } from "~/app/services/components";

import APP from "~/resources/content/foundations/app";
import CHAT from "~/resources/content/foundations/chat";
import COLOR from "~/resources/content/foundations/color";
import COMPONENTS from "~/resources/content/foundations/components";
import DOCS from "~/resources/content/foundations/docs";
import LANDING from "~/resources/content/foundations/landing";
import VIDEO from "~/resources/content/foundations/video";

/** One CSS custom property as the variables table lists it. */
export interface FoundationsVariable {
	/** The property, with its leading dashes; a family writes its varying part as `<n>`. */
	name: string;
	/** The value it takes when nothing sets it, or who writes it. */
	default: string;
	controls: string;
}

/** A titled run of variables, so a long table splits by what the variables shape. */
export interface FoundationsVariableGroup {
	title: string;
	/** One or two sentences on how the group is set or read. */
	lead?: string;
	variables: FoundationsVariable[];
}

/** One idea every component of the namespace holds to. */
export interface FoundationsIdea {
	title: string;
	body: string;
}

/** Everything one namespace's Foundations page says. */
export interface Foundations {
	module: ComponentModule;
	/** The segment under `/api/ui/` the page answers on. */
	slug: string;
	/** The page heading, naming the namespace ("Landing foundations"). */
	title: string;
	/** The one line a listing and the meta description show. */
	summary: string;
	/** The specifier the namespace is imported from. */
	importPath: string;
	/** The source file the page's "Open" menu links, relative to `packages/`. */
	source: string;
	/** What the components are for, one paragraph each. */
	intro: string[];
	/** The situations that call for the namespace. */
	reachFor: string[];
	ideas: FoundationsIdea[];
	/** Which theme color roles the namespace reads; the Theming page documents them. */
	roles: string;
	variables: FoundationsVariableGroup[];
}

/** Each namespace's Foundations; the record's type holds every namespace to having one. */
const FOUNDATIONS_BY_MODULE: Record<ComponentModule, Foundations> = {
	components: COMPONENTS,
	landing: LANDING,
	docs: DOCS,
	chat: CHAT,
	color: COLOR,
	app: APP,
	video: VIDEO,
};

/** Every namespace's Foundations, in the order the sidebar lists the namespaces. */
export const FOUNDATIONS: Foundations[] = Object.values(FOUNDATIONS_BY_MODULE);

/**
 * The Foundations page a catalogue segment names.
 *
 * @param slug The `:component` segment of the request.
 * @returns The namespace's Foundations, or `null` when the segment names another page.
 */
export function findFoundations(slug: string): Foundations | null {
	return FOUNDATIONS.find((foundations) => foundations.slug === slug) ?? null;
}

/**
 * The Foundations page of one namespace.
 *
 * @param module The namespace's folder, as the component list files it.
 */
export function foundationsFor(module: ComponentModule): Foundations {
	return FOUNDATIONS_BY_MODULE[module];
}
