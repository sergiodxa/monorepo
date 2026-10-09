/**
 * The components documentation renders markdown through: the guides and the package
 * READMEs share one map, so a fence, a heading and a link look the same wherever the
 * prose came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";

import { DiagramTag } from "@sdxc/diagram/ui";

import CodeBlock from "~/resources/components/code-block";
import Files, { File, Folder } from "~/resources/components/files";
import Note from "~/resources/components/note";
import { ProseHeading, ProseLink, ProseList, ProseParagraph } from "~/resources/components/prose";

export const DOCS_COMPONENTS: NonNullable<RemixOptions["components"]> = {
	files: Files,
	folder: Folder,
	file: File,
	code: CodeBlock,
	diagram: DiagramTag,
	heading: ProseHeading,
	paragraph: ProseParagraph,
	list: ProseList,
	link: ProseLink,
};

/**
 * What a root-level policy page renders through: the documentation map plus the one tag
 * those pages reach for, so a caution about pinning reads as an aside rather than as a
 * paragraph among the paragraphs it qualifies.
 */
export const POLICY_COMPONENTS: NonNullable<RemixOptions["components"]> = {
	...DOCS_COMPONENTS,
	note: Note,
};
