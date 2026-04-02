import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";

import type * as schema from "~/app/models";

import { authState } from "~/app/http/middleware/auth-state";
import { db } from "~/app/http/middleware/db";

export interface CMSCrudModel<TEntity, TCreateInput, TUpdateInput> {
	findAll(database: Database): Promise<Array<TEntity>>;
	findById(database: Database, id: string): Promise<TEntity | null>;
	create(database: Database, input: TCreateInput): Promise<{ id: string } | null>;
	update(database: Database, id: string, input: TUpdateInput): Promise<TEntity | null>;
	destroy(database: Database, id: string): Promise<unknown>;
}

export interface CMSCrudPaths {
	indexHref: string;
	loginHref: string;
	editHref(id: string): string;
}

export interface CMSCrudIndexConfig<TEntity, TIndexItem> {
	mapItems(records: Array<TEntity>): Array<TIndexItem>;
	render(items: Array<TIndexItem>): Promise<string>;
}

export interface CMSCrudActionConfig<TEntity, TActionProps> {
	buildEditProps(record: TEntity): TActionProps;
	buildNotFoundProps(id: string | undefined): TActionProps;
	buildNewProps(): Promise<TActionProps> | TActionProps;
	render(props: TActionProps): Promise<string>;
}

export interface CMSCrudFormConfig<TFormData, TCreateInput, TUpdateInput> {
	parse(formData: FormData): Promise<TFormData>;
	toCreateInput(data: TFormData, user: schema.SelectUser): TCreateInput;
	toUpdateInput(data: TFormData, user: schema.SelectUser, id: string): TUpdateInput;
}

export interface CMSCrudConfig<
	TEntity,
	TFormData,
	TCreateInput,
	TUpdateInput,
	TIndexItem,
	TActionProps,
> {
	model: CMSCrudModel<TEntity, TCreateInput, TUpdateInput>;
	paths: CMSCrudPaths;
	index: CMSCrudIndexConfig<TEntity, TIndexItem>;
	action: CMSCrudActionConfig<TEntity, TActionProps>;
	form: CMSCrudFormConfig<TFormData, TCreateInput, TUpdateInput>;
	onUpdateMissing(id: string): Response | Promise<Response>;
}

export function createCMSCrudActions<
	TEntity,
	TFormData,
	TCreateInput,
	TUpdateInput,
	TIndexItem,
	TActionProps,
>(config: CMSCrudConfig<TEntity, TFormData, TCreateInput, TUpdateInput, TIndexItem, TActionProps>) {
	return {
		async index() {
			let records = await config.model.findAll(db());
			let items = config.index.mapItems(records);
			let body = await config.index.render(items);
			return ok(body);
		},

		async create(ctx: any) {
			let user = authState().user;
			if (!user) return redirect(config.paths.loginHref, { status: redirect.Status.SeeOther });

			let data = await config.form.parse(ctx.get(FormData));
			let created = await config.model.create(db(), config.form.toCreateInput(data, user));
			if (!created) return redirect(config.paths.indexHref, { status: redirect.Status.SeeOther });

			return redirect(config.paths.editHref(created.id), { status: redirect.Status.SeeOther });
		},

		async destroy(ctx: any) {
			let id = ctx.params.id;
			if (!id) return redirect(config.paths.indexHref, { status: redirect.Status.SeeOther });

			await config.model.destroy(db(), id);
			return redirect(config.paths.indexHref, { status: redirect.Status.SeeOther });
		},

		async edit(ctx: any) {
			let id = ctx.params.id;
			let record = id ? await config.model.findById(db(), id) : null;

			if (!record) {
				let view = await config.action.buildNotFoundProps(id);
				let body = await config.action.render(view);
				return notFound(body);
			}

			let view = await config.action.buildEditProps(record);
			let body = await config.action.render(view);
			return ok(body);
		},

		async new() {
			let view = await config.action.buildNewProps();
			let body = await config.action.render(view);
			return ok(body);
		},

		async update(ctx: any) {
			let user = authState().user;
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(config.paths.indexHref, { status: redirect.Status.SeeOther });

			let data = await config.form.parse(ctx.get(FormData));
			let updated = await config.model.update(db(), id, config.form.toUpdateInput(data, user, id));
			if (!updated) return config.onUpdateMissing(id);

			return redirect(config.paths.editHref(id), { status: redirect.Status.SeeOther });
		},
	};
}
