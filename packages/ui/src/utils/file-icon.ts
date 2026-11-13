/**
 * Picks the `@sdxc/icons` glyph for a file from its name, so every place that draws a file
 * (a docs tree, a code card's header, a repository browser) shows the same kind of file
 * with the same icon.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	FileBracesIcon,
	FileCodeIcon,
	FileCogIcon,
	FileIcon,
	FileImageIcon,
	FileLockIcon,
	FileTerminalIcon,
	FileTextIcon,
	FileTypeIcon,
} from "@sdxc/icons";

/** An icon component from `@sdxc/icons`, drawn as `<Glyph size={16} aria-hidden="true" />`. */
export type FileIconComponent = typeof FileIcon;

/** Icons for file extensions whose type a reader recognises at a glance. */
const ICON_BY_EXTENSION: Record<string, FileIconComponent> = {
	ts: FileCodeIcon,
	tsx: FileCodeIcon,
	js: FileCodeIcon,
	jsx: FileCodeIcon,
	mjs: FileCodeIcon,
	cjs: FileCodeIcon,
	mts: FileCodeIcon,
	cts: FileCodeIcon,
	html: FileCodeIcon,
	sql: FileCodeIcon,
	json: FileBracesIcon,
	jsonc: FileBracesIcon,
	md: FileTextIcon,
	mdx: FileTextIcon,
	txt: FileTextIcon,
	css: FileTypeIcon,
	png: FileImageIcon,
	jpg: FileImageIcon,
	jpeg: FileImageIcon,
	gif: FileImageIcon,
	svg: FileImageIcon,
	webp: FileImageIcon,
	avif: FileImageIcon,
	ico: FileImageIcon,
	sh: FileTerminalIcon,
	toml: FileCogIcon,
	yaml: FileCogIcon,
	yml: FileCogIcon,
	env: FileCogIcon,
	ini: FileCogIcon,
	lock: FileLockIcon,
	lockb: FileLockIcon,
};

/** Options for {@link fileIcon}. */
export interface FileIconOptions {
	/**
	 * The icon for an extension the map does not know, such as `FileCodeIcon` where every
	 * titled file is source code.
	 *
	 * @default FileIcon
	 */
	fallback?: FileIconComponent;
}

/**
 * Picks a file's icon from its extension, treating a dotfile's name as its extension
 * (`.env`). A name without an extension draws a plain file.
 *
 * @param name File name or path, such as `app/routes.ts`.
 * @param options The icon for an unrecognised extension.
 * @returns The icon component to render.
 * @example let Glyph = fileIcon("package.json"); <Glyph size={16} aria-hidden="true" />
 */
export function fileIcon(name: string, options: FileIconOptions = {}): FileIconComponent {
	let base = name.slice(name.lastIndexOf("/") + 1);
	let dot = base.lastIndexOf(".");
	if (dot === -1) return FileIcon;
	return ICON_BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? options.fallback ?? FileIcon;
}
