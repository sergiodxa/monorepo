export type ResolvedType<T extends (...args: any) => Promise<any>> = Awaited<ReturnType<T>>;
