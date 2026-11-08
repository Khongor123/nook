export const EFFORT_VERSION = "nook-effort-v1";
export function effortInputSignature(source: { title: string; descriptionText: string }) {
  return JSON.stringify([source.title.trim(), source.descriptionText.trim(), EFFORT_VERSION]);
}
