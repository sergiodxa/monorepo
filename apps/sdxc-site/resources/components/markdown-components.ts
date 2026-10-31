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
import { FrameTag } from "@sdxc/markdown/remix";
import { MathTag } from "@sdxc/math/ui";

import {
	AlertTag,
	Fence,
	FilesTag,
	FileTag,
	FolderTag,
} from "~/resources/components/markdown-blocks";
import { ProseHeading, ProseLink, ProseList, ProseParagraph } from "~/resources/components/prose";

export const DOCS_COMPONENTS: NonNullable<RemixOptions["components"]> = {
	files: FilesTag,
	folder: FolderTag,
	file: FileTag,
	code: Fence,
	diagram: DiagramTag,
	math: MathTag,
	frame: FrameTag,
	heading: ProseHeading,
	paragraph: ProseParagraph,
	list: ProseList,
	link: ProseLink,
	alert: AlertTag,
};
