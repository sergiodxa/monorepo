/**
 * The SQL grammar, aimed at the SQLite dialect the schemas, migrations and
 * analytics queries in this repository are written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer.js";

/**
 * Reserved words. The `i` flag rides along with the sticky one because a
 * dialect accepts any casing and the migrations here mix `CREATE TABLE` with
 * `create table`, sometimes in the same file.
 */
const KEYWORDS =
	/\b(?:add|all|alter|analyze|and|as|asc|attach|autoincrement|begin|between|by|cascade|case|cast|check|collate|column|commit|conflict|constraint|create|cross|day|default|deferrable|delete|desc|detach|distinct|do|drop|else|end|escape|exists|explain|foreign|from|full|glob|group|having|hour|if|ignore|immediate|in|index|inner|insert|instead|intersect|interval|into|is|isnull|join|key|left|like|limit|natural|not|nothing|notnull|null|offset|on|or|order|outer|over|partition|pragma|primary|references|regexp|reindex|release|rename|replace|restrict|returning|right|rollback|rowid|savepoint|select|set|table|temp|temporary|then|to|transaction|trigger|union|unique|update|using|vacuum|values|view|virtual|when|where|with|without)\b/iy;

/**
 * Column types, across the dialects a fence in this repository can be quoting:
 * SQLite's four storage classes, the affinity names its migrations declare, and
 * the Postgres spellings the vendored docs use.
 */
const TYPES =
	/\b(?:bigint|bigserial|blob|boolean|bool|bytea|character|varchar|char|clob|datetime|date|decimal|double|float|integer|int|jsonb|json|numeric|real|serial|smallint|text|timestamptz|timestamp|time|tinyint|uuid)\b/iy;

/**
 * Highlights SQL, distinguishing a delimited identifier from a string so that
 * `"id"` and `'id'` do not read as the same thing.
 *
 * @example scan("select id from users", sql)
 */
export const sql: Grammar = {
	main: [
		{ type: "comment", match: /--[^\n]*/y },
		{ type: "comment", match: /\/\*(?:[^*]|\*(?!\/))*(?:\*\/)?/y },

		/** A doubled quote escapes itself, which is the only escape the dialect has. */
		{ type: "string", match: /'(?:''|[^'])*'/y },
		{ type: "string", match: /'/y },

		/**
		 * A delimited identifier names a table or a column, so it is painted as the
		 * thing it names rather than as the quotes around it.
		 */
		{ type: "class-name", match: /`[^`\n]*`/y },
		{ type: "class-name", match: /"[^"\n]*"/y },

		{
			type: "number",
			match: /\b(?:0[xX][\da-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\b/y,
		},
		{ type: "number", match: /\.\d+(?:[eE][+-]?\d+)?/y },

		{ type: "boolean", match: /\b(?:true|false)\b/iy },
		{ type: "constant", match: /\bcurrent_(?:timestamp|date|time)\b/iy },
		{ type: "keyword", match: KEYWORDS },
		{ type: "builtin", match: TYPES },

		/**
		 * A name is a call only when the paren touches it: `create table users (…)`
		 * names a table and its columns, and every function this dialect has is
		 * written without the space.
		 */
		{ type: "function", match: /\b[A-Za-z_][\w$]*(?=\()/y },

		/** The bind parameters a statement is prepared with, in every spelling D1 accepts. */
		{ type: "variable", match: /\?\d*|[:@$][A-Za-z_]\w*/y },

		{ type: "operator", match: /<=>|<>|!=|[<>]=|<<|>>|\|\||::|[-+*/%=<>&|~]/y },
		{ type: "punctuation", match: /[();,.[\]{}]/y },
	],
};
