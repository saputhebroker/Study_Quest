// the same question text always gives the same key
export default function questionKey(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 200);
}