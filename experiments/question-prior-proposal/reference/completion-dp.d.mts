export function drawsFromPosterior(post: { a: readonly [number, number]; b: readonly [number, number] }, K: number, seed?: number): number[][];
export function completionPmf(need: number, draws: readonly (readonly number[])[], H: number, start?: 'D' | 'S', prune?: boolean): Float64Array;
export function quantileDays(mix: Float64Array, q: number, H: number): number | null;
export function cdfAt(mix: Float64Array, d: number): number;
