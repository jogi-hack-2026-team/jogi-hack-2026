"use client";
import React, { useEffect, useMemo, useState } from "react";
import { createApi } from "./api";
import {
  tracks,
  ratings,
  type Session,
  type Interaction,
  type Rating,
} from "../../shared/contract";
import "./style.css";
type Guest = {
  seeds: string[];
  session?: Session;
  items: Interaction[];
  feedback: Record<string, { rating: Rating; revision: number }>;
  pendingId?: string;
};
const empty = (): Guest => ({ seeds: [], items: [], feedback: {} });
function read(key: string): Guest {
  try {
    const g = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      !g ||
      !Array.isArray(g.seeds) ||
      g.seeds.length > 5 ||
      !g.seeds.every((id: unknown) => tracks.some((t) => t.id === id)) ||
      !Array.isArray(g.items) ||
      g.items.length > 5 ||
      !g.feedback ||
      typeof g.feedback !== "object"
    )
      return empty();
    if (
      g.session &&
      (typeof g.session.id !== "string" || typeof g.session.token !== "string")
    )
      return empty();
    if (
      !g.items.every(
        (i: any) =>
          typeof i.interactionId === "string" &&
          tracks.some((t) => t.id === i.trackId),
      )
    )
      return empty();
    return g;
  } catch {
    return empty();
  }
}
export function Screens({
  screen,
  go,
}: {
  screen: "search" | "explore";
  go: (path: string) => void;
}) {
  const [ready, setReady] = useState(false),
    [guest, setGuest] = useState<Guest>(empty),
    [query, setQuery] = useState(""),
    [list, setList] = useState(tracks);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [playbackError, setPlaybackError] = useState(false),
    [crash, setCrash] = useState(false);
  const [live, setLive] = useState(false),
    [refresh, setRefresh] = useState(0);
  const api = useMemo(() => createApi(live), [live]);
  const key = live ? "bakeoff-live-v1" : "bakeoff-mock-v1";
  useEffect(() => {
    const enabled = new URLSearchParams(location.search).get("mode") === "live";
    setLive(enabled);
    setGuest(read(enabled ? "bakeoff-live-v1" : "bakeoff-mock-v1"));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setError("");
    api
      .search(query)
      .then((rows) => {
        if (active) setList(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, api, ready, refresh]);
  function save(g: Guest) {
    setGuest(g);
    try {
      localStorage.setItem(key, JSON.stringify(g));
    } catch {
      setStorageError(
        "Guest state could not be saved. Reload recovery is unavailable.",
      );
    }
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function next(g: Guest) {
    const id = g.pendingId ?? crypto.randomUUID();
    const pending = { ...g, pendingId: id };
    save(pending);
    const i = await api.next(g.session!, g.seeds, g.items, id);
    save({ ...pending, pendingId: undefined, items: [...g.items, i] });
    setPlaybackError(false);
  }
  const current = guest.items.at(-1),
    track = tracks.find((t) => t.id === current?.trackId),
    done =
      guest.items.length === 5 &&
      current &&
      guest.feedback[current.interactionId];
  if (crash) throw new Error("PoC render error");
  if (!ready) return <p role="status">Loading guest state…</p>;
  return (
    <main>
      <header>
        <small>
          STACK BAKE-OFF · {live ? "LIVE LOCAL API" : "SHARED MOCK"}
        </small>
        <h1>Music exploration</h1>
        <p>Supporting experiment. UI design is not a product decision.</p>
      </header>
      {storageError && <p role="alert">{storageError}</p>}
      {error && (
        <div role="alert" aria-label="Request error">
          {error}{" "}
          <button onClick={() => setRefresh((n) => n + 1)}>Retry search</button>
        </div>
      )}
      {busy && <p role="status">Saving…</p>}
      {screen === "search" ? (
        <section>
          <h2>Choose 3–5 seed tracks</h2>
          <label>
            Search tracks
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {loading ? (
            <p role="status">Loading tracks…</p>
          ) : (
            <ul>
              {list.map((t) => (
                <li key={t.id}>
                  <img src={t.artwork} alt="" width="48" height="48" />
                  <span>
                    {t.title}
                    <small>{t.artist}</small>
                  </span>
                  <button
                    aria-label={`Select ${t.title}`}
                    aria-pressed={guest.seeds.includes(t.id)}
                    disabled={
                      busy ||
                      Boolean(guest.session) ||
                      (!guest.seeds.includes(t.id) && guest.seeds.length >= 5)
                    }
                    onClick={() =>
                      save({
                        ...guest,
                        seeds: guest.seeds.includes(t.id)
                          ? guest.seeds.filter((id) => id !== t.id)
                          : [...guest.seeds, t.id],
                      })
                    }
                  >
                    {guest.seeds.includes(t.id) ? "Selected" : "Select"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p>{guest.seeds.length} / 5 selected</p>
          <button
            disabled={busy || guest.seeds.length < 3}
            onClick={() =>
              run(async () => {
                let g = guest;
                if (!g.session) {
                  g = { ...g, session: await api.session(g.seeds) };
                  save(g);
                }
                if (!g.items.length) await next(g);
                go("/explore" + (live ? "?mode=live" : ""));
              })
            }
          >
            {guest.session ? "Resume exploration" : "Start exploration"}
          </button>
        </section>
      ) : (
        <section>
          <h2>Exploration</h2>
          {!current ? (
            <p>Choose seeds first.</p>
          ) : (
            <>
              <p>Track {guest.items.length} / 5</p>
              <h3>{track?.title}</h3>
              <p>{track?.artist}</p>
              <div className="player" aria-label="Playback mock">
                {playbackError
                  ? "Playback unavailable. This is not a dislike."
                  : "Playback mock — no external video or audio"}
              </div>
              <button onClick={() => setPlaybackError(true)}>
                Simulate playback failure
              </button>
              <div className="ratings">
                {ratings.map((rating) => (
                  <button
                    key={rating}
                    disabled={busy}
                    aria-pressed={
                      guest.feedback[current.interactionId]?.rating === rating
                    }
                    onClick={() =>
                      run(async () => {
                        const revision =
                          guest.feedback[current.interactionId]?.revision ?? 0;
                        const result = await api.feedback(
                          guest.session!,
                          current,
                          rating,
                          revision,
                        );
                        save({
                          ...guest,
                          feedback: {
                            ...guest.feedback,
                            [current.interactionId]: {
                              rating,
                              revision: result.revision,
                            },
                          },
                        });
                      })
                    }
                  >
                    {rating}
                  </button>
                ))}
              </div>
              {guest.feedback[current.interactionId] && (
                <p role="status">
                  Saved: {guest.feedback[current.interactionId].rating}
                </p>
              )}
              {done ? (
                <section>
                  <h3>Preference summary</h3>
                  <p>
                    Five-track checkpoint reached. Evidence may be insufficient;
                    no causal preference claim.
                  </p>
                  <p>
                    {
                      Object.values(guest.feedback).filter(
                        (f) => f.rating !== "UNSURE",
                      ).length
                    }{" "}
                    explicit ratings available.
                  </p>
                </section>
              ) : (
                <button
                  disabled={busy || !guest.feedback[current.interactionId]}
                  onClick={() => run(() => next(guest))}
                >
                  Next recommendation
                </button>
              )}
            </>
          )}
          <p>
            <button onClick={() => go("/" + (live ? "?mode=live" : ""))}>
              Back to search
            </button>
          </p>
        </section>
      )}
      <footer>
        <button onClick={() => setCrash(true)}>Simulate render error</button>
      </footer>
    </main>
  );
}
export class Boundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main role="alert">
        <h1>Screen unavailable</h1>
        <button onClick={() => location.reload()}>
          Reload saved guest state
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
