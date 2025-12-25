"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Card, Button, Input, Label } from "@/components/ui";
import { toast } from "@/components/ToastProvider";

type ConversationRow = {
  id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
  other: { id: string | null; email?: string | null; role?: string | null; displayName?: string | null };
};

type MessageRow = {
  id: string;
  senderUserId: string;
  sender?: { id: string; email?: string | null; role?: string | null; displayName?: string | null } | null;
  body: string;
  createdAt: string;
};

type RecipientOption = {
  userId: string;
  role: string;
  email: string;
  displayName: string;
  extra?: string | null;
};

type RecipientRole = "player" | "coach" | "evaluator";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function MessagesClient() {
  const sp = useSearchParams();
  const selectedId = sp.get("c") || "";

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<ConversationRow[]>([]);

  const [convLoading, setConvLoading] = React.useState(false);
  const [convError, setConvError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [status, setStatus] = React.useState<ConversationRow["status"] | null>(null);
  const [composer, setComposer] = React.useState("");

  const [playerQuery, setPlayerQuery] = React.useState("");
  const [playerLoading, setPlayerLoading] = React.useState(false);
  const [playerOptions, setPlayerOptions] = React.useState<RecipientOption[]>([]);
  const [playerOpen, setPlayerOpen] = React.useState(false);

  const [coachQuery, setCoachQuery] = React.useState("");
  const [coachLoading, setCoachLoading] = React.useState(false);
  const [coachOptions, setCoachOptions] = React.useState<RecipientOption[]>([]);
  const [coachOpen, setCoachOpen] = React.useState(false);

  const [evaluatorQuery, setEvaluatorQuery] = React.useState("");
  const [evaluatorLoading, setEvaluatorLoading] = React.useState(false);
  const [evaluatorOptions, setEvaluatorOptions] = React.useState<RecipientOption[]>([]);
  const [evaluatorOpen, setEvaluatorOpen] = React.useState(false);

  const [selectedRecipient, setSelectedRecipient] = React.useState<RecipientOption | null>(null);
  const [newBody, setNewBody] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  async function loadInbox() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<{ conversations: ConversationRow[] }>("/messages/conversations?limit=100", { token, retries: 2 });
      setConversations(res.conversations ?? []);
      window.dispatchEvent(new CustomEvent("goeducate:messages-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(id: string) {
    if (!id) return;
    setConvError(null);
    setConvLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<{ conversation: { id: string; status: ConversationRow["status"] }; messages: MessageRow[] }>(
        `/messages/conversations/${encodeURIComponent(id)}?limit=200`,
        { token, retries: 2 }
      );
      setMessages(res.messages ?? []);
      setStatus(res.conversation?.status ?? null);
    } catch (e) {
      setConvError(e instanceof Error ? e.message : "Failed to load conversation");
    } finally {
      setConvLoading(false);
    }
  }

  React.useEffect(() => {
    void loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadConversation(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function fetchRecipients(input: { role: RecipientRole; q?: string; prefill?: boolean }) {
    const token = getAccessToken();
    if (!token) return [];
    const qs = new URLSearchParams();
    qs.set("role", input.role);
    qs.set("limit", "10");
    if (input.prefill) qs.set("prefill", "1");
    if (input.q) qs.set("q", input.q);
    const res = await apiFetch<{ results: RecipientOption[] }>(`/messages/recipients?${qs.toString()}`, { token, retries: 2, retryOn404: true });
    return res.results ?? [];
  }

  React.useEffect(() => {
    const q = playerQuery.trim();
    if (selectedRecipient) {
      setPlayerOptions([]);
      return;
    }
    if (!q || q.length < 2) {
      setPlayerOptions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setPlayerLoading(true);
      try {
        const results = await fetchRecipients({ role: "player", q });
        if (!cancelled) {
          setPlayerOptions(results);
          setPlayerOpen(true);
        }
      } catch {
        if (!cancelled) setPlayerOptions([]);
      } finally {
        if (!cancelled) setPlayerLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [playerQuery, selectedRecipient]);

  React.useEffect(() => {
    const q = coachQuery.trim();
    if (selectedRecipient) {
      setCoachOptions([]);
      return;
    }
    if (!q || q.length < 2) {
      setCoachOptions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setCoachLoading(true);
      try {
        const results = await fetchRecipients({ role: "coach", q });
        if (!cancelled) {
          setCoachOptions(results);
          setCoachOpen(true);
        }
      } catch {
        if (!cancelled) setCoachOptions([]);
      } finally {
        if (!cancelled) setCoachLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [coachQuery, selectedRecipient]);

  React.useEffect(() => {
    const q = evaluatorQuery.trim();
    if (selectedRecipient) {
      setEvaluatorOptions([]);
      return;
    }
    if (!q || q.length < 2) {
      setEvaluatorOptions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setEvaluatorLoading(true);
      try {
        const results = await fetchRecipients({ role: "evaluator", q });
        if (!cancelled) {
          setEvaluatorOptions(results);
          setEvaluatorOpen(true);
        }
      } catch {
        if (!cancelled) setEvaluatorOptions([]);
      } finally {
        if (!cancelled) setEvaluatorLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [evaluatorQuery, selectedRecipient]);

  async function accept() {
    if (!selectedId) return;
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch(`/messages/conversations/${encodeURIComponent(selectedId)}/accept`, { method: "POST", token });
      toast({ kind: "success", title: "Accepted", message: "You can now message in this thread." });
      await Promise.all([loadInbox(), loadConversation(selectedId)]);
      window.dispatchEvent(new CustomEvent("goeducate:messages-changed"));
    } catch (e) {
      toast({ kind: "error", title: "Failed", message: e instanceof Error ? e.message : "Failed to accept" });
    }
  }

  async function decline() {
    if (!selectedId) return;
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch(`/messages/conversations/${encodeURIComponent(selectedId)}/decline`, { method: "POST", token });
      toast({ kind: "success", title: "Declined", message: "Conversation request declined." });
      await Promise.all([loadInbox(), loadConversation(selectedId)]);
      window.dispatchEvent(new CustomEvent("goeducate:messages-changed"));
    } catch (e) {
      toast({ kind: "error", title: "Failed", message: e instanceof Error ? e.message : "Failed to decline" });
    }
  }

  async function send() {
    if (!selectedId) return;
    const body = composer.trim();
    if (!body) return;
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      setComposer("");
      await apiFetch(`/messages/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ body })
      });
      await Promise.all([loadInbox(), loadConversation(selectedId)]);
      window.dispatchEvent(new CustomEvent("goeducate:messages-changed"));
    } catch (e) {
      setComposer(body);
      toast({ kind: "error", title: "Failed to send", message: e instanceof Error ? e.message : "Failed to send" });
    }
  }

  async function createConversation() {
    const recipientUserId = selectedRecipient?.userId ?? "";
    const message = newBody.trim();
    if (!recipientUserId) {
      toast({ kind: "error", title: "Pick a recipient", message: "Select a player, coach, or evaluator first." });
      return;
    }
    if (!message) return;
    setCreating(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<{ ok: boolean; conversationId: string }>("/messages/conversations", {
        method: "POST",
        token,
        body: JSON.stringify({ recipientUserId, message })
      });
      setSelectedRecipient(null);
      setPlayerQuery("");
      setCoachQuery("");
      setEvaluatorQuery("");
      setPlayerOptions([]);
      setCoachOptions([]);
      setEvaluatorOptions([]);
      setPlayerOpen(false);
      setCoachOpen(false);
      setEvaluatorOpen(false);
      setNewBody("");
      toast({ kind: "success", title: "Sent", message: "Message request sent." });
      await loadInbox();
      window.dispatchEvent(new CustomEvent("goeducate:messages-changed"));
      window.location.href = `/messages?c=${encodeURIComponent(res.conversationId)}`;
    } catch (e) {
      toast({ kind: "error", title: "Failed", message: e instanceof Error ? e.message : "Failed to start conversation" });
    } finally {
      setCreating(false);
    }
  }

  const selected = selectedId ? conversations.find((c) => c.id === selectedId) : null;
  const empty = !loading && !error && conversations.length === 0;

  return (
    <div className="grid gap-6">
      <Card>
        <h1 className="text-xl font-semibold">Messages</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Start a conversation request, then chat once it’s accepted.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Inbox</div>
            <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={loadInbox} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>

          {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
          {empty ? <div className="mt-3 text-sm text-[color:var(--muted)]">No conversations yet.</div> : null}

          <div className="mt-4 grid gap-2">
            {conversations.map((c) => {
              const active = c.id === selectedId;
              const name = c.other.displayName || c.other.email || c.other.id || "Unknown";
              return (
                <Link
                  key={c.id}
                  href={`/messages?c=${encodeURIComponent(c.id)}`}
                  className={`rounded-lg border px-3 py-2 ${active ? "border-indigo-500/60 bg-indigo-500/10" : "border-white/10 hover:bg-white/5"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-[color:var(--foreground)]">{name}</div>
                    {c.unread > 0 ? <div className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">{c.unread}</div> : null}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs text-[color:var(--muted)]">{c.lastMessagePreview || (c.status === "pending" ? "Conversation request pending…" : "—")}</div>
                  <div className="mt-1 text-[10px] text-[color:var(--muted-2)]">{fmtDate(c.lastMessageAt || undefined)}</div>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6">
          <Card>
            <div className="text-sm font-semibold">Start a new conversation</div>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-2">
                <Label>Recipient</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <div className="text-xs font-semibold text-[color:var(--muted)]">Player</div>
                    <div className="relative">
                      <Input
                        value={selectedRecipient?.role === "player" ? selectedRecipient.displayName || selectedRecipient.email : playerQuery}
                        onChange={(e) => {
                          setSelectedRecipient(null);
                          setCoachQuery("");
                          setEvaluatorQuery("");
                          setPlayerQuery(e.target.value);
                          setPlayerOpen(true);
                        }}
                        onFocus={async () => {
                          setPlayerOpen(true);
                          if (selectedRecipient) return;
                          if (!playerQuery.trim()) {
                            try {
                              setPlayerLoading(true);
                              setPlayerOptions(await fetchRecipients({ role: "player", prefill: true }));
                            } finally {
                              setPlayerLoading(false);
                            }
                          }
                        }}
                        placeholder="Search players…"
                        disabled={!!selectedRecipient && selectedRecipient.role !== "player"}
                      />
                      {playerLoading && !selectedRecipient ? (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted)]">…</div>
                      ) : null}
                      {playerOpen && !selectedRecipient && playerOptions.length ? (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
                          {playerOptions.map((opt) => {
                            const sub = [opt.email, opt.role, opt.extra].filter(Boolean).join(" · ");
                            return (
                              <button
                                key={opt.userId}
                                type="button"
                                className="block w-full px-4 py-2.5 text-left hover:bg-white/5"
                                onClick={() => {
                                  setSelectedRecipient(opt);
                                  setPlayerOpen(false);
                                  setCoachOpen(false);
                                  setEvaluatorOpen(false);
                                  setPlayerQuery("");
                                  setCoachQuery("");
                                  setEvaluatorQuery("");
                                }}
                              >
                                <div className="text-sm font-semibold text-white/90">{opt.displayName || opt.email}</div>
                                <div className="mt-0.5 text-xs text-[color:var(--muted)]">{sub}</div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <div className="text-xs font-semibold text-[color:var(--muted)]">Coach</div>
                    <div className="relative">
                      <Input
                        value={selectedRecipient?.role === "coach" ? selectedRecipient.displayName || selectedRecipient.email : coachQuery}
                        onChange={(e) => {
                          setSelectedRecipient(null);
                          setPlayerQuery("");
                          setEvaluatorQuery("");
                          setCoachQuery(e.target.value);
                          setCoachOpen(true);
                        }}
                        onFocus={async () => {
                          setCoachOpen(true);
                          if (selectedRecipient) return;
                          if (!coachQuery.trim()) {
                            try {
                              setCoachLoading(true);
                              setCoachOptions(await fetchRecipients({ role: "coach", prefill: true }));
                            } finally {
                              setCoachLoading(false);
                            }
                          }
                        }}
                        placeholder="Search coaches…"
                        disabled={!!selectedRecipient && selectedRecipient.role !== "coach"}
                      />
                      {coachLoading && !selectedRecipient ? (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted)]">…</div>
                      ) : null}
                      {coachOpen && !selectedRecipient && coachOptions.length ? (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
                          {coachOptions.map((opt) => {
                            const sub = [opt.email, opt.role, opt.extra].filter(Boolean).join(" · ");
                            return (
                              <button
                                key={opt.userId}
                                type="button"
                                className="block w-full px-4 py-2.5 text-left hover:bg-white/5"
                                onClick={() => {
                                  setSelectedRecipient(opt);
                                  setPlayerOpen(false);
                                  setCoachOpen(false);
                                  setEvaluatorOpen(false);
                                  setPlayerQuery("");
                                  setCoachQuery("");
                                  setEvaluatorQuery("");
                                }}
                              >
                                <div className="text-sm font-semibold text-white/90">{opt.displayName || opt.email}</div>
                                <div className="mt-0.5 text-xs text-[color:var(--muted)]">{sub}</div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <div className="text-xs font-semibold text-[color:var(--muted)]">Evaluator</div>
                    <div className="relative">
                      <Input
                        value={selectedRecipient?.role === "evaluator" ? selectedRecipient.displayName || selectedRecipient.email : evaluatorQuery}
                        onChange={(e) => {
                          setSelectedRecipient(null);
                          setPlayerQuery("");
                          setCoachQuery("");
                          setEvaluatorQuery(e.target.value);
                          setEvaluatorOpen(true);
                        }}
                        onFocus={async () => {
                          setEvaluatorOpen(true);
                          if (selectedRecipient) return;
                          if (!evaluatorQuery.trim()) {
                            try {
                              setEvaluatorLoading(true);
                              setEvaluatorOptions(await fetchRecipients({ role: "evaluator", prefill: true }));
                            } finally {
                              setEvaluatorLoading(false);
                            }
                          }
                        }}
                        placeholder="Search evaluators…"
                        disabled={!!selectedRecipient && selectedRecipient.role !== "evaluator"}
                      />
                      {evaluatorLoading && !selectedRecipient ? (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--muted)]">…</div>
                      ) : null}
                      {evaluatorOpen && !selectedRecipient && evaluatorOptions.length ? (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
                          {evaluatorOptions.map((opt) => {
                            const sub = [opt.email, opt.role, opt.extra].filter(Boolean).join(" · ");
                            return (
                              <button
                                key={opt.userId}
                                type="button"
                                className="block w-full px-4 py-2.5 text-left hover:bg-white/5"
                                onClick={() => {
                                  setSelectedRecipient(opt);
                                  setPlayerOpen(false);
                                  setCoachOpen(false);
                                  setEvaluatorOpen(false);
                                  setPlayerQuery("");
                                  setCoachQuery("");
                                  setEvaluatorQuery("");
                                }}
                              >
                                <div className="text-sm font-semibold text-white/90">{opt.displayName || opt.email}</div>
                                <div className="mt-0.5 text-xs text-[color:var(--muted)]">{sub}</div>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {selectedRecipient ? (
                  <div className="flex items-center justify-between gap-2 text-xs text-[color:var(--muted)]">
                    <div>
                      Selected: <span className="text-white/90 font-semibold">{selectedRecipient.displayName || selectedRecipient.email}</span>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                      onClick={() => {
                        setSelectedRecipient(null);
                        setPlayerQuery("");
                        setCoachQuery("");
                        setEvaluatorQuery("");
                        setPlayerOptions([]);
                        setCoachOptions([]);
                        setEvaluatorOptions([]);
                        setPlayerOpen(false);
                        setCoachOpen(false);
                        setEvaluatorOpen(false);
                      }}
                      aria-label="Clear recipient"
                      title="Clear"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-[color:var(--muted)]">Pick a user from one of the three dropdowns.</div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="msgBody">First message</Label>
                <textarea
                  id="msgBody"
                  className="min-h-24 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Write a short intro…"
                />
              </div>
              <div>
                <Button type="button" onClick={createConversation} disabled={creating || !selectedRecipient || !newBody.trim()}>
                  {creating ? "Sending…" : "Send request"}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Conversation</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">{selected ? `Status: ${selected.status}` : "Select a thread from the inbox."}</div>
              </div>
              {selected && selected.status === "pending" ? (
                <div className="flex gap-2">
                  <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={decline}>
                    Decline
                  </Button>
                  <Button type="button" onClick={accept}>
                    Accept
                  </Button>
                </div>
              ) : null}
            </div>

            {convError ? <div className="mt-3 text-sm text-red-300">{convError}</div> : null}
            {convLoading ? <div className="mt-3 text-sm text-[color:var(--muted)]">Loading…</div> : null}

            <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/10 p-3">
              {messages.length ? (
                <div className="grid gap-3">
                  {messages.map((m) => (
                    <div key={m.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="text-[10px] text-[color:var(--muted-2)]">
                        {fmtDate(m.createdAt)} · sender {m.sender?.displayName || m.sender?.email || m.senderUserId}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--foreground)]">{m.body}</div>
                    </div>
                  ))}
                </div>
              ) : selected ? (
                <div className="text-sm text-[color:var(--muted)]">No messages yet.</div>
              ) : (
                <div className="text-sm text-[color:var(--muted)]">—</div>
              )}
            </div>

            <div className="mt-4 grid gap-2">
              <Label htmlFor="composer">Message</Label>
              <textarea
                id="composer"
                className="min-h-20 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)] disabled:opacity-60"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder={selected ? (selected.status === "accepted" ? "Type a message…" : "This thread must be accepted before you can reply.") : "Select a conversation first."}
                disabled={!selected || selected.status !== "accepted"}
              />
              <div className="flex items-center gap-2">
                <Button type="button" onClick={send} disabled={!selected || selected.status !== "accepted" || !composer.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


