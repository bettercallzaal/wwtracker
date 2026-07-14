/** Filename-safe slug: lowercase, ASCII-folded, hyphen-separated, capped length. */
export function slugify(input: string, maxLen = 40): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const truncated = slug.slice(0, maxLen).replace(/-+$/g, "");
  return truncated || "battle";
}
