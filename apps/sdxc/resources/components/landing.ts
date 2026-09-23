/**
 * The components the landing document renders through: one per tag in the vocabulary,
 * plus the two node types the page draws itself. A name missing from here still
 * renders its children, so the page loses chrome rather than content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";

import CodeBlock from "~/resources/components/code-block";
import CodeTabs, { CodeTab } from "~/resources/components/code-tabs";
import Copyable from "~/resources/components/copyable";
import Feature from "~/resources/components/feature";
import FeatureGrid from "~/resources/components/feature-grid";
import Files, { File, Folder } from "~/resources/components/files";
import Hero from "~/resources/components/hero";
import InstallCommand from "~/resources/components/install-command";
import Note from "~/resources/components/note";
import PackageGroups from "~/resources/components/package-groups";
import { ProseHeading, ProseLink, ProseParagraph } from "~/resources/components/prose";
import SectionBlock from "~/resources/components/section-block";

export const LANDING_COMPONENTS: NonNullable<RemixOptions["components"]> = {
	hero: Hero,
	copyable: Copyable,
	"section-block": SectionBlock,
	"feature-grid": FeatureGrid,
	feature: Feature,
	"code-tabs": CodeTabs,
	"code-tab": CodeTab,
	"install-command": InstallCommand,
	"package-groups": PackageGroups,
	note: Note,
	files: Files,
	folder: Folder,
	file: File,
	code: CodeBlock,
	heading: ProseHeading,
	paragraph: ProseParagraph,
	link: ProseLink,
};
