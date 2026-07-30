/**
 * Splits a SQL script into individual statements while ignoring semicolons that live
 * inside string literals, quoted identifiers, or comments. The D1 mock needs it both to
 * run scripts and to reject multi-statement prepares the way the real binding does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/**
 * Splits a SQL script on statement boundaries.
 *
 * Only unquoted, uncommented semicolons split, so `INSERT INTO t VALUES ('a;b')` stays
 * one statement. Blank fragments and trailing separators are dropped, so a script ending
 * in `;` yields no empty final statement.
 * @param sql One or more `;`-separated SQL statements.
 * @returns The trimmed, non-empty statements in source order.
 * @example splitSqlStatements("SELECT 1; SELECT 2") // ["SELECT 1", "SELECT 2"]
 */
export function splitSqlStatements(sql: string): string[] {
	let statements: string[] = [];
	let current = "";
	let index = 0;

	while (index < sql.length) {
		let character = sql[index] as string;

		if (character === "'" || character === '"' || character === "`") {
			let closing = sql.indexOf(character, index + 1);
			let end = closing === -1 ? sql.length : closing + 1;
			current += sql.slice(index, end);
			index = end;
			continue;
		}

		if (character === "[") {
			let closing = sql.indexOf("]", index + 1);
			let end = closing === -1 ? sql.length : closing + 1;
			current += sql.slice(index, end);
			index = end;
			continue;
		}

		if (character === "-" && sql[index + 1] === "-") {
			let newline = sql.indexOf("\n", index);
			let end = newline === -1 ? sql.length : newline + 1;
			current += sql.slice(index, end);
			index = end;
			continue;
		}

		if (character === "/" && sql[index + 1] === "*") {
			let closing = sql.indexOf("*/", index + 2);
			let end = closing === -1 ? sql.length : closing + 2;
			current += sql.slice(index, end);
			index = end;
			continue;
		}

		if (character === ";") {
			statements.push(current);
			current = "";
			index += 1;
			continue;
		}

		current += character;
		index += 1;
	}

	statements.push(current);

	return statements.map((statement) => statement.trim()).filter((statement) => statement !== "");
}
