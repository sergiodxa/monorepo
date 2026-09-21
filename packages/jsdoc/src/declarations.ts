/**
 * Turns the declarations of a statement list into documentation nodes: what each
 * export is, the members it carries and the modifiers a reader sees as badges.
 * A statement list is also a namespace body, so the walk is reused for both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import ts from "typescript";

import type { DocComment, DocFlags, DocNode, DocReExport, DocSource } from "./types.js";

import { leadingComment } from "./jsdoc-text.js";
import { toSignature, toTypeParameters } from "./signatures.js";

/** What every node built from one file needs to know about that file. */
export interface NodeContext {
	/** Path recorded on each node's `source`. */
	path: string;
	/** End of the module's own comment, below which a block is not a node's. */
	after: number;
}

/** The documented exports of a statement list and the exports it forwards. */
export interface Collected {
	nodes: DocNode[];
	reExports: DocReExport[];
}

/** A declaration found in the statement list, ready to be published under a name. */
interface Local {
	name: string;
	declaration: ts.Node;
	/** Node the comment sits above, which for a variable is its statement. */
	commentHost: ts.Node;
}

/**
 * Document every export of a statement list.
 *
 * Declarations are indexed first, so `export { parse }` written below a function
 * still finds it, and overloads of one name arrive as a single node.
 *
 * @param ctx - The file the statements belong to.
 * @param statements - Statements of a source file or a namespace body.
 * @param scope - Prefix for the id of each node, such as `src/index#`.
 * @returns The exported nodes and the re-exports pointing at other modules.
 */
export function collect(
	ctx: NodeContext,
	statements: readonly ts.Statement[],
	scope: string,
): Collected {
	let locals = new Map<string, Local>();
	for (let statement of statements) {
		for (let local of declaredIn(statement)) locals.set(local.name, local);
	}

	let nodes: DocNode[] = [];
	let reExports: DocReExport[] = [];

	for (let statement of statements) {
		if (ts.isExportDeclaration(statement)) {
			if (statement.moduleSpecifier) reExports.push(...forwardedBy(statement));
			else nodes.push(...renamedBy(ctx, statement, locals, scope));
			continue;
		}

		if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
			let node = defaultedBy(ctx, statement, locals, scope);
			if (node) nodes.push(node);
			continue;
		}

		if (!isExported(statement)) continue;

		let isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
		for (let local of declaredIn(statement)) {
			let node = toNode(ctx, local, local.name, scope);
			if (node) nodes.push(isDefault ? { ...node, flags: { ...node.flags, default: true } } : node);
		}
	}

	let documented = mergeOverloads(nodes);
	attachStaticMembers(ctx, statements, documented, scope);

	return { nodes: documented, reExports };
}

/**
 * Attach every `Owner.part = …` assignment to the exported `Owner` it extends, which
 * is how a component publishes the parts it composes from. An assignment whose owner
 * is not exported documents nothing, so it is left where it sits.
 */
function attachStaticMembers(
	ctx: NodeContext,
	statements: readonly ts.Statement[],
	nodes: DocNode[],
	scope: string,
): void {
	for (let statement of statements) {
		if (!ts.isExpressionStatement(statement)) continue;

		let assignment = statement.expression;
		if (!ts.isBinaryExpression(assignment)) continue;
		if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) continue;

		let target = assignment.left;
		if (!ts.isPropertyAccessExpression(target)) continue;
		if (!ts.isIdentifier(target.expression)) continue;

		let ownerName = target.expression.text;
		let owner = nodes.find((candidate) => candidate.name === ownerName);
		if (!owner) continue;

		let name = target.name.getText();
		let comment = leadingComment(statement, ctx.after);
		let initializer = assignment.right;
		let callable =
			ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer) ? initializer : null;

		owner.children = [
			...owner.children,
			{
				id: `${scope}${ownerName}.${name}`,
				name,
				kind: callable ? "function" : "variable",
				comment,
				source: sourceOf(ctx, statement),
				type: null,
				signatures: callable ? [toSignature(callable, comment)] : [],
				typeParameters: [],
				extends: [],
				implements: [],
				children: [],
				flags: flagsOf(statement, comment),
			},
		];
	}
}

/** Build the node for one declaration, published under `name` inside `scope`. */
function toNode(ctx: NodeContext, local: Local, name: string, scope: string): DocNode | null {
	let { declaration } = local;
	let comment = leadingComment(local.commentHost, ctx.after);
	let node: DocNode = {
		id: `${scope}${name}`,
		name,
		kind: "variable",
		comment,
		source: sourceOf(ctx, declaration),
		type: null,
		signatures: [],
		typeParameters: [],
		extends: [],
		implements: [],
		children: [],
		flags: flagsOf(declaration, comment),
	};

	if (ts.isFunctionDeclaration(declaration)) {
		return { ...node, kind: "function", signatures: [toSignature(declaration, comment)] };
	}

	if (ts.isClassDeclaration(declaration)) {
		return {
			...node,
			kind: "class",
			typeParameters: toTypeParameters(declaration.typeParameters, comment),
			extends: heritage(declaration, ts.SyntaxKind.ExtendsKeyword),
			implements: heritage(declaration, ts.SyntaxKind.ImplementsKeyword),
			children: membersOf(ctx, declaration.members, `${scope}${name}.`),
		};
	}

	if (ts.isInterfaceDeclaration(declaration)) {
		return {
			...node,
			kind: "interface",
			typeParameters: toTypeParameters(declaration.typeParameters, comment),
			extends: heritage(declaration, ts.SyntaxKind.ExtendsKeyword),
			children: membersOf(ctx, declaration.members, `${scope}${name}.`),
		};
	}

	if (ts.isTypeAliasDeclaration(declaration)) {
		return {
			...node,
			kind: "type-alias",
			type: declaration.type.getText(),
			typeParameters: toTypeParameters(declaration.typeParameters, comment),
		};
	}

	if (ts.isEnumDeclaration(declaration)) {
		return {
			...node,
			kind: "enum",
			children: declaration.members.map((member) => {
				let memberComment = leadingComment(member, ctx.after);
				return {
					...node,
					id: `${scope}${name}.${member.name.getText()}`,
					name: member.name.getText(),
					kind: "enum-member" as const,
					comment: memberComment,
					source: sourceOf(ctx, member),
					type: member.initializer?.getText() ?? null,
					flags: flagsOf(member, memberComment),
				};
			}),
		};
	}

	if (ts.isModuleDeclaration(declaration)) {
		let body = declaration.body;
		let statements = body && ts.isModuleBlock(body) ? body.statements : [];
		return {
			...node,
			kind: "namespace",
			children: collect(ctx, statements, `${scope}${name}.`).nodes,
		};
	}

	if (ts.isVariableDeclaration(declaration)) {
		let initializer = declaration.initializer;
		if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
			return { ...node, kind: "function", signatures: [toSignature(initializer, comment)] };
		}
		return { ...node, type: declaration.type?.getText() ?? null };
	}

	return node;
}

/** List the declarations a statement introduces, with the node each comment sits above. */
function declaredIn(statement: ts.Statement): Local[] {
	if (ts.isVariableStatement(statement)) {
		return statement.declarationList.declarations
			.filter((declaration) => ts.isIdentifier(declaration.name))
			.map((declaration) => ({
				name: declaration.name.getText(),
				declaration,
				commentHost: statement,
			}));
	}

	if (
		ts.isFunctionDeclaration(statement) ||
		ts.isClassDeclaration(statement) ||
		ts.isInterfaceDeclaration(statement) ||
		ts.isTypeAliasDeclaration(statement) ||
		ts.isEnumDeclaration(statement) ||
		ts.isModuleDeclaration(statement)
	) {
		let name = statement.name?.getText() ?? "default";
		return [{ name, declaration: statement, commentHost: statement }];
	}

	return [];
}

/** Read `export { a as b } from "./m.js"` and its wildcard forms into pointers. */
function forwardedBy(statement: ts.ExportDeclaration): DocReExport[] {
	let specifier = statement.moduleSpecifier;
	let module =
		specifier && ts.isStringLiteral(specifier) ? specifier.text : (specifier?.getText() ?? "");
	let clause = statement.exportClause;

	if (!clause) {
		return [{ kind: "all", module, name: null, exported: null, typeOnly: statement.isTypeOnly }];
	}

	if (ts.isNamespaceExport(clause)) {
		return [
			{
				kind: "namespace",
				module,
				name: null,
				exported: clause.name.getText(),
				typeOnly: statement.isTypeOnly,
			},
		];
	}

	return clause.elements.map((element) => ({
		kind: "named" as const,
		module,
		name: (element.propertyName ?? element.name).getText(),
		exported: element.name.getText(),
		typeOnly: statement.isTypeOnly || element.isTypeOnly,
	}));
}

/** Document the local declarations an `export { … }` clause publishes. */
function renamedBy(
	ctx: NodeContext,
	statement: ts.ExportDeclaration,
	locals: Map<string, Local>,
	scope: string,
): DocNode[] {
	let clause = statement.exportClause;
	if (!clause || !ts.isNamedExports(clause)) return [];

	let nodes: DocNode[] = [];
	for (let element of clause.elements) {
		let local = locals.get((element.propertyName ?? element.name).getText());
		if (!local) continue;

		let exported = element.name.getText();
		let node = toNode(ctx, local, exported === "default" ? local.name : exported, scope);
		if (node) {
			nodes.push(
				exported === "default" ? { ...node, flags: { ...node.flags, default: true } } : node,
			);
		}
	}

	return nodes;
}

/**
 * Document `export default`. A default that names a local declaration keeps that
 * declaration's own name, since that is what readers of the source call it.
 */
function defaultedBy(
	ctx: NodeContext,
	statement: ts.ExportAssignment,
	locals: Map<string, Local>,
	scope: string,
): DocNode | null {
	let local = ts.isIdentifier(statement.expression)
		? locals.get(statement.expression.text)
		: undefined;

	if (local) {
		let node = toNode(ctx, local, local.name, scope);
		return node ? { ...node, flags: { ...node.flags, default: true } } : null;
	}

	let comment = leadingComment(statement, ctx.after);
	return {
		id: `${scope}default`,
		name: "default",
		kind: "variable",
		comment,
		source: sourceOf(ctx, statement),
		type: null,
		signatures: [],
		typeParameters: [],
		extends: [],
		implements: [],
		children: [],
		flags: { ...flagsOf(statement, comment), default: true },
	};
}

/**
 * Document the members a reader can reach. Members declared `private` or with a
 * `#name` are implementation, so they stay out of the model entirely.
 */
function membersOf(
	ctx: NodeContext,
	members: readonly ts.ClassElement[] | readonly ts.TypeElement[],
	scope: string,
): DocNode[] {
	let nodes: DocNode[] = [];

	for (let member of members) {
		if (!member.name || ts.isPrivateIdentifier(member.name)) continue;
		if (hasModifier(member, ts.SyntaxKind.PrivateKeyword)) continue;

		let name = member.name.getText();
		let comment = leadingComment(member, ctx.after);
		let node: DocNode = {
			id: `${scope}${name}`,
			name,
			kind: "property",
			comment,
			source: sourceOf(ctx, member),
			type: null,
			signatures: [],
			typeParameters: [],
			extends: [],
			implements: [],
			children: [],
			flags: flagsOf(member, comment),
		};

		if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
			nodes.push({
				...node,
				kind: "method",
				typeParameters: toTypeParameters(member.typeParameters, comment),
				signatures: [toSignature(member, comment)],
			});
			continue;
		}

		if (ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
			let existing = nodes.find((candidate) => candidate.name === name);
			if (existing) continue;
			nodes.push({ ...node, kind: "accessor", type: accessorType(member) });
			continue;
		}

		if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
			let initializer = ts.isPropertyDeclaration(member) ? member.initializer : undefined;
			if (
				initializer &&
				(ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
			) {
				nodes.push({ ...node, kind: "method", signatures: [toSignature(initializer, comment)] });
				continue;
			}
			nodes.push({ ...node, type: member.type?.getText() ?? null });
		}
	}

	let constructor = members.find((member) => ts.isConstructorDeclaration(member));
	if (constructor && ts.isConstructorDeclaration(constructor)) {
		let comment = leadingComment(constructor, ctx.after);
		nodes.unshift(
			{
				id: `${scope}constructor`,
				name: "constructor",
				kind: "constructor",
				comment,
				source: sourceOf(ctx, constructor),
				type: null,
				signatures: [toSignature(constructor, comment)],
				typeParameters: [],
				extends: [],
				implements: [],
				children: [],
				flags: flagsOf(constructor, comment),
			},
			...parameterProperties(ctx, constructor, scope),
		);
	}

	return mergeOverloads(nodes);
}

/**
 * Document the fields a constructor declares through parameter properties, which
 * are public members even though nothing inside the class body names them.
 */
function parameterProperties(
	ctx: NodeContext,
	constructor: ts.ConstructorDeclaration,
	scope: string,
): DocNode[] {
	return constructor.parameters
		.filter(
			(parameter) =>
				ts.isIdentifier(parameter.name) &&
				!hasModifier(parameter, ts.SyntaxKind.PrivateKeyword) &&
				(hasModifier(parameter, ts.SyntaxKind.PublicKeyword) ||
					hasModifier(parameter, ts.SyntaxKind.ProtectedKeyword) ||
					hasModifier(parameter, ts.SyntaxKind.ReadonlyKeyword)),
		)
		.map((parameter) => ({
			id: `${scope}${parameter.name.getText()}`,
			name: parameter.name.getText(),
			kind: "property" as const,
			comment: leadingComment(parameter, ctx.after),
			source: sourceOf(ctx, parameter),
			type: parameter.type?.getText() ?? null,
			signatures: [],
			typeParameters: [],
			extends: [],
			implements: [],
			children: [],
			flags: flagsOf(parameter, null),
		}));
}

/** Read an accessor's type from whichever half of the pair declares one. */
function accessorType(
	member: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
): string | null {
	if (ts.isGetAccessor(member)) return member.type?.getText() ?? null;
	return member.parameters.at(0)?.type?.getText() ?? null;
}

/**
 * Collapse the declarations of an overloaded name into one node of many
 * signatures. A symbol with a single signature documents itself, so only an
 * overloaded one keeps a comment per signature.
 */
function mergeOverloads(nodes: DocNode[]): DocNode[] {
	let merged: DocNode[] = [];

	for (let node of nodes) {
		let existing = merged.find((candidate) => candidate.id === node.id);
		if (!existing) {
			merged.push(node);
			continue;
		}

		existing.signatures = [...existing.signatures, ...node.signatures];
		existing.children = [...existing.children, ...node.children];

		/**
		 * A namespace merges with the value of the same name, and the two halves
		 * document different things: the namespace holds the types, the value is
		 * what a caller reaches for. The value names the merged symbol and supplies
		 * its comment, so the description and examples written above the function
		 * survive rather than losing to the types declared beside it.
		 */
		if (existing.kind === "namespace" && node.kind !== "namespace") {
			existing.kind = node.kind;
			existing.type = node.type;
			if (node.comment) existing.comment = node.comment;
			continue;
		}

		existing.comment ??= node.comment;
	}

	return merged.map((node) =>
		node.signatures.length === 1
			? {
					...node,
					signatures: node.signatures.map((signature) => ({ ...signature, comment: null })),
				}
			: node,
	);
}

/** Read the type text of each entry in one heritage clause. */
function heritage(
	declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
	keyword: ts.SyntaxKind.ExtendsKeyword | ts.SyntaxKind.ImplementsKeyword,
): string[] {
	return (declaration.heritageClauses ?? [])
		.filter((clause) => clause.token === keyword)
		.flatMap((clause) => clause.types.map((type) => type.getText()));
}

/** Read the modifiers and comment tags a renderer shows as badges. */
function flagsOf(node: ts.Node, comment: DocComment | null): DocFlags {
	return {
		default: hasModifier(node, ts.SyntaxKind.DefaultKeyword),
		optional: isOptional(node),
		readonly: hasModifier(node, ts.SyntaxKind.ReadonlyKeyword),
		static: hasModifier(node, ts.SyntaxKind.StaticKeyword),
		abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
		async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
		deprecated: Boolean(comment?.tags.some((tag) => tag.tag === "deprecated")),
		internal: Boolean(comment?.tags.some((tag) => tag.tag === "internal")),
		visibility: hasModifier(node, ts.SyntaxKind.ProtectedKeyword) ? "protected" : "public",
	};
}

/** Whether a member or parameter is written with the `?` marker. */
function isOptional(node: ts.Node): boolean {
	if (
		ts.isPropertySignature(node) ||
		ts.isPropertyDeclaration(node) ||
		ts.isMethodSignature(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isParameter(node)
	) {
		return Boolean(node.questionToken);
	}

	return false;
}

/** Whether a node carries one modifier keyword. */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
	if (!ts.canHaveModifiers(node)) return false;
	return Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === kind));
}

/** Whether a statement is published with the `export` keyword. */
function isExported(statement: ts.Statement): boolean {
	return hasModifier(statement, ts.SyntaxKind.ExportKeyword);
}

/** Locate a node in the file, counting lines and columns from one. */
function sourceOf(ctx: NodeContext, node: ts.Node): DocSource {
	let file = node.getSourceFile();
	let position = file.getLineAndCharacterOfPosition(node.getStart());
	return { path: ctx.path, line: position.line + 1, column: position.character + 1 };
}
