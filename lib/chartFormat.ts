/**
 * What recharts hands a Tooltip formatter, and a safe way to read it.
 *
 * **recharts 3 widened these types and every chart in this repo annotated them
 * as `number` or `number | string`.** Both are now too narrow to satisfy
 * `Formatter`, because a value can be an array (a stacked or range series hands
 * the formatter both ends) and can be `undefined` (a tooltip can render before
 * its payload resolves). 24 call sites across 8 components failed to typecheck
 * on exactly this.
 *
 * The annotations were not wrong in recharts 2 and they are not wrong at
 * runtime now - every chart here plots a single numeric series, so the value
 * really is a number in practice. They are wrong as a CONTRACT: they promised
 * recharts something narrower than recharts agreed to.
 *
 * `toNum` is the narrowing, in one place, so the assumption is stated once
 * instead of implied 24 times. It takes the first element of an array, which is
 * the value for the series the tooltip row belongs to, and yields NaN for
 * `undefined` - which renders as "NaN" rather than throwing, and a visible NaN
 * in a tooltip is a better failure than a blank chart from a thrown TypeError.
 */
// Mirrors recharts' own `ValueType` and `NameType`
// (recharts/types/component/DefaultTooltipContent), plus the `undefined` that
// `Formatter` adds. The array is READONLY there - declaring a mutable one here
// is narrower, and a narrower parameter is exactly what recharts refuses.
export type TooltipValue = string | number | ReadonlyArray<string | number> | undefined;
export type TooltipName = string | number | undefined;

export const toNum = (v: TooltipValue): number =>
  Number(Array.isArray(v) ? (v as ReadonlyArray<string | number>)[0] : v);

/** The name of the series a tooltip row belongs to, as a string. */
export const toName = (n: TooltipName): string => (n == null ? "" : String(n));

/**
 * What a `LabelList` formatter receives, which is NOT what a Tooltip formatter
 * receives - recharts calls it `RenderableText` and it admits booleans and
 * null but no arrays.
 *
 * Kept as its own name because the one site using it was mis-typed as a
 * tooltip value while fixing the other 23, and the compiler caught it. Two
 * similar-looking props with different types is exactly the pair worth naming
 * separately.
 */
export type LabelValue = string | number | boolean | null | undefined;

export const labelNum = (v: LabelValue): number => Number(v);
