export interface ReadWindow {
    page?: number;
    search?: string;
}
export const maxReadPage = 10000;
export function readWindow(input: ReadWindow = {}) {
    const page = input.page ?? 1, search = (input.search ?? '').trim();
    if (!Number.isSafeInteger(page) || page < 1 || page > maxReadPage)
        throw new Error('Choose a valid page between 1 and 10000.');
    if (search.length > 120 || (search && !/^[\p{L}\p{N}\p{M} ._/#@+\-]+$/u.test(search)))
        throw new Error('Use a shorter search with letters, numbers, spaces or basic code punctuation.');
    return { page, search };
}
