import type {
	FileKey,
	FileMetadata,
	FileStorage,
	ListOptions,
	ListResult,
} from "@mjackson/file-storage";

import { JWK, JWT } from "@edgefirst-dev/jwt";
import { R2FileStorage } from "@edgefirst-dev/r2-file-storage";
import { env } from "cloudflare:workers";

class _KVFileStorage implements FileStorage {
	constructor(private kv: KVNamespace) {}

	async has(key: string): Promise<boolean> {
		return (await this.kv.get(key)) !== null;
	}

	async set(key: string, file: File): Promise<void> {
		await this.kv.put(key, await file.text(), {
			metadata: {
				lastModified: file.lastModified,
				name: file.name,
				size: file.size,
				type: file.type,
			} satisfies Omit<FileMetadata, "key">,
		});
	}

	async get(key: string): Promise<File | null> {
		let data = await this.kv.get(key, "text");
		let file = data ? new File([this.toArrayBuffer(data)], key) : null;
		return file;
	}

	async remove(key: string): Promise<void> {
		await this.kv.delete(key);
	}

	async put(key: string, file: File): Promise<File> {
		await this.kv.put(key, await file.text());
		return file;
	}

	async list<T extends ListOptions>(options?: T): Promise<ListResult<T>> {
		let pages = await this.kv.list({
			prefix: options?.prefix,
			limit: options?.limit,
			cursor: options?.cursor,
		});

		if (options?.includeMetadata) {
			let files = await Promise.all(
				pages.keys.map(async (key) => {
					let result = await this.kv.getWithMetadata<Omit<FileMetadata, "key">>(key.name, "text");

					return {
						lastModified: result.metadata?.lastModified ?? Date.now(),
						name: result.metadata?.name ?? key.name,
						size: result.metadata?.size ?? 0,
						type: result.metadata?.type ?? "application/json",
						key: key.name,
					} satisfies FileMetadata;
				}),
			);

			return { files, cursor: pages.list_complete ? undefined : pages.cursor };
		}

		let files: FileKey[] = pages.keys.map((key) => {
			return { key: key.name } satisfies FileKey;
		});

		return {
			files,
			cursor: pages.list_complete ? undefined : pages.cursor,
		} as ListResult<T>;
	}

	toArrayBuffer(value: string): ArrayBuffer {
		return new TextEncoder().encode(value).slice().buffer;
	}
}

export async function sign(jwt: JWT) {
	return await jwt.sign(JWK.Algoritm.ES256, await getSigningKey());
}

export async function getSigningKey() {
	// @ts-expect-error
	return await JWK.signingKeys(new R2FileStorage(env.R2));
}
