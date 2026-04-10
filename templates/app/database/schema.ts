import { table, column as c } from "remix/data-table";

export const users = table({
	name: "users",
	columns: {
		id: c.uuid().primaryKey(),
	},
});
