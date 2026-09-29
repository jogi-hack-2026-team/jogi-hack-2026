export const ratings = ["LIKE", "NEUTRAL", "DISLIKE", "UNSURE"] as const;
export type Rating = (typeof ratings)[number];
export interface Track {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  features: number[];
}
// Synthetic catalogue percentiles, not real ReccoBeats raw features or recording IDs.
export const tracks: Track[] = Array.from({ length: 12 }, (_, i) => ({
  id: `fixture-${i}`,
  title: `Track ${i + 1}`,
  artist: `Artist ${(i % 3) + 1}`,
  artwork:
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#5965ad"/></svg>',
    ),
  features: Array.from({ length: 7 }, (_, j) => ((i * (j + 3) + j) % 13) / 12),
}));
export interface Session {
  id: string;
  token: string;
}
export interface Interaction {
  interactionId: string;
  trackId: string;
  anchorId: string;
  candidateType: "RELEVANT" | "PROBE";
  decisionTrace: {
    context: number[];
    theta: number[];
    score: number;
    preferenceVersion: number;
    policy: string;
    candidates: { trackId: string; score: number }[];
  };
}
export interface FeedbackResult {
  revision: number;
  preferenceVersion: number;
  evidenceCount: number;
}
