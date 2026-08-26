export const reviewActions = ["field_verification", "dismissed", "resolved"] as const;
export type ReviewAction = (typeof reviewActions)[number];

export function statusForReviewAction(action: ReviewAction) {
  return action;
}

export function normaliseReviewNote(note: string) {
  return note.trim().replace(/\s+/g, " ");
}
