/**
 * Unit tests for {@link "./file-icon"}: known extensions, dotfiles, paths, names without an
 * extension, and the fallback for an extension the map does not know.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	FileBracesIcon,
	FileCodeIcon,
	FileCogIcon,
	FileIcon,
	FileLockIcon,
	FileTextIcon,
} from "@sdxc/icons";
import { describe, expect, test } from "vitest";

import { fileIcon } from "./file-icon.js";

describe(fileIcon.name, () => {
	test("picks an icon by extension, ignoring case", () => {
		expect(fileIcon("routes.ts")).toBe(FileCodeIcon);
		expect(fileIcon("package.JSON")).toBe(FileBracesIcon);
		expect(fileIcon("README.md")).toBe(FileTextIcon);
		expect(fileIcon("bun.lockb")).toBe(FileLockIcon);
	});

	test("reads a dotfile's name as its extension", () => {
		expect(fileIcon(".env")).toBe(FileCogIcon);
	});

	test("reads the extension from the last segment of a path", () => {
		expect(fileIcon("apps/site.v2/Makefile")).toBe(FileIcon);
		expect(fileIcon("apps/site/vite.config.ts")).toBe(FileCodeIcon);
	});

	test("draws a plain file for an unknown extension unless a fallback is given", () => {
		expect(fileIcon("main.zig")).toBe(FileIcon);
		expect(fileIcon("main.zig", { fallback: FileCodeIcon })).toBe(FileCodeIcon);
		expect(fileIcon("Dockerfile", { fallback: FileCodeIcon })).toBe(FileIcon);
	});
});
