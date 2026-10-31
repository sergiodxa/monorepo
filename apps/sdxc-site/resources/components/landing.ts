/**
 * The components the landing document renders through: one per tag in the vocabulary,
 * plus the two node types the page draws itself. A name missing from here still
 * renders its children, so the page loses chrome rather than content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";

import Actions from "~/resources/components/actions";
import Copyable from "~/resources/components/copyable";
import Feature from "~/resources/components/feature";
import FeatureGrid from "~/resources/components/feature-grid";
import FinePrint from "~/resources/components/fine-print";
import Hero from "~/resources/components/hero";
import {
	AlertTag,
	CodeTabsTag,
	CodeTabTag,
	Fence,
	FilesTag,
	FileTag,
	FolderTag,
	InstallCommandTag,
} from "~/resources/components/markdown-blocks";
import PackageGroups from "~/resources/components/package-groups";
import { ProseHeading, ProseLink, ProseParagraph } from "~/resources/components/prose";
import SectionBlock from "~/resources/components/section-block";
import Split, { SplitCopy, SplitMedia } from "~/resources/components/split";
import Stats, { Stat } from "~/resources/components/stats";

export const LANDING_COMPONENTS: NonNullable<RemixOptions["components"]> = {
	hero: Hero,
	split: Split,
	"split-copy": SplitCopy,
	"split-media": SplitMedia,
	actions: Actions,
	stats: Stats,
	stat: Stat,
	copyable: Copyable,
	"fine-print": FinePrint,
	"section-block": SectionBlock,
	"feature-grid": FeatureGrid,
	feature: Feature,
	"code-tabs": CodeTabsTag,
	"code-tab": CodeTabTag,
	"install-command": InstallCommandTag,
	"package-groups": PackageGroups,
	alert: AlertTag,
	files: FilesTag,
	folder: FolderTag,
	file: FileTag,
	code: Fence,
	heading: ProseHeading,
	paragraph: ProseParagraph,
	link: ProseLink,
};
