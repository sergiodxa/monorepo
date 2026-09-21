/**
 * Parses source text into a TypeScript syntax tree without touching the file
 * system: the compiler host answers from memory and resolves nothing, so the
 * only input is the string the caller passed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import ts from "typescript";

import type { DocDiagnostic } from "./extract-error.js";

import { ExtractError } from "./extract-error.js";

/** Dialect each file extension is parsed as; anything else is read as TypeScript. */
const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
	".cjs": ts.ScriptKind.JS,
	".cts": ts.ScriptKind.TS,
	".js": ts.ScriptKind.JS,
	".jsx": ts.ScriptKind.JSX,
	".mjs": ts.ScriptKind.JS,
	".mts": ts.ScriptKind.TS,
	".ts": ts.ScriptKind.TS,
	".tsx": ts.ScriptKind.TSX,
};

/**
 * Parse source text, keeping parent pointers so every node can report the text
 * and position it was written at.
 *
 * @param source - Contents of a JavaScript or TypeScript file.
 * @param path - Path the text came from; its extension picks the dialect.
 * @returns The syntax tree, or an `ExtractError` listing the syntax errors.
 */
export function parseSource(source: string, path: string): Result<ts.SourceFile, ExtractError> {
	let file = ts.createSourceFile(
		path,
		source,
		{ languageVersion: ts.ScriptTarget.ESNext, jsDocParsingMode: ts.JSDocParsingMode.ParseNone },
		true,
		scriptKind(path),
	);

	let diagnostics = syntaxErrors(file, path);
	if (diagnostics.length > 0) return failure(new ExtractError(path, diagnostics));
	return success(file);
}

/** Pick the dialect from the extension, defaulting to TypeScript. */
function scriptKind(path: string): ts.ScriptKind {
	let extension = /\.[^./\\]+$/.exec(path)?.[0].toLowerCase() ?? "";
	return SCRIPT_KINDS[extension] ?? ts.ScriptKind.TS;
}

/**
 * Report the parser's own errors by building a program over the single file in
 * memory, which is the supported way to read syntactic diagnostics back out.
 */
function syntaxErrors(file: ts.SourceFile, path: string): DocDiagnostic[] {
	let host: ts.CompilerHost = {
		fileExists: (name) => name === path,
		getCanonicalFileName: (name) => name,
		getCurrentDirectory: () => "",
		getDefaultLibFileName: () => "lib.d.ts",
		getNewLine: () => "\n",
		getSourceFile: (name) => (name === path ? file : undefined),
		readFile: () => undefined,
		useCaseSensitiveFileNames: () => true,
		writeFile: () => {},
	};

	let program = ts.createProgram({
		host,
		options: { noLib: true, noResolve: true, target: ts.ScriptTarget.ESNext },
		rootNames: [path],
	});

	return program.getSyntacticDiagnostics(file).map((diagnostic) => {
		let position = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
		return {
			message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
			line: position.line + 1,
			column: position.character + 1,
		};
	});
}
