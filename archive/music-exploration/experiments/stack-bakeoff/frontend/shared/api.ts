import {
  tracks,
  type Session,
  type Interaction,
  type Rating,
  type FeedbackResult,
} from "../../shared/contract";
const delay = () => new Promise((resolve) => setTimeout(resolve, 120));
export function createApi(live: boolean) {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<T> {
    const r = await fetch("http://127.0.0.1:4310" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Guest-Token": token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Request failed (${r.status}). Retry safely.`);
    return r.json();
  }
  return {
    async search(query: string) {
      await delay();
      if (query === "error") throw new Error("Mock search failure");
      const rows = live
        ? await request<typeof tracks>("GET", "/tracks")
        : tracks;
      return rows.filter((t) =>
        (t.title + " " + t.artist).toLowerCase().includes(query.toLowerCase()),
      );
    },
    async session(seeds: string[]): Promise<Session> {
      await delay();
      return live
        ? request("POST", "/sessions", { seeds })
        : { id: crypto.randomUUID(), token: crypto.randomUUID() };
    },
    async next(
      s: Session,
      seeds: string[],
      completed: Interaction[],
      interactionId: string,
    ): Promise<Interaction> {
      await delay();
      if (live)
        return request(
          "POST",
          `/sessions/${s.id}/next`,
          { interactionId },
          s.token,
        );
      const track = tracks.find(
        (t) =>
          !seeds.includes(t.id) && !completed.some((i) => i.trackId === t.id),
      )!;
      return {
        interactionId,
        trackId: track.id,
        anchorId: seeds[0],
        candidateType: "RELEVANT",
        decisionTrace: {
          context: [],
          theta: [],
          score: 0,
          preferenceVersion: 0,
          policy: "frontend-mock-no-algorithm",
          candidates: [],
        },
      };
    },
    async feedback(
      s: Session,
      i: Interaction,
      rating: Rating,
      expectedRevision: number,
    ): Promise<FeedbackResult> {
      await delay();
      return live
        ? request(
            "PUT",
            `/interactions/${i.interactionId}/feedback`,
            { rating, expectedRevision },
            s.token,
          )
        : {
            revision: expectedRevision + 1,
            preferenceVersion: 1,
            evidenceCount: rating === "UNSURE" ? 0 : 1,
          };
    },
  };
}
