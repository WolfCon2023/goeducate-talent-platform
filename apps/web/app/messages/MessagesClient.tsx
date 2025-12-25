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
  body: string;
  createdAt: string;
};

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

  const [newTo, setNewTo] = React.useState("");
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

  async function accept() {
    if (!selectedId) return;
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch(`/messages/conversations/${encodeURIComponent(selectedId)}/accept`, { method: "POST", token });
      toast({ kind: "success", title: "Accepted", message: "You can now message in this thread." });
      await Promise.all([loadInbox(), loadConversation(selectedId)]);
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
    } catch (e) {
      setComposer(body);
      toast({ kind: "error", title: "Failed to send", message: e instanceof Error ? e.message : "Failed to send" });
    }
  }

  async function createConversation() {
    const recipientUserId = newTo.trim();
    const message = newBody.trim();
    if (!recipientUserId || !message) return;
    setCreating(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<{ ok: boolean; conversationId: string }>("/messages/conversations", {
        method: "POST",
        token,
        body: JSON.stringify({ recipientUserId, message })
      });
      setNewTo("");
      setNewBody("");
      toast({ kind: "success", title: "Sent", message: "Message request sent." });
      await loadInbox();
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
                <Label htmlFor="msgTo">Recipient user ID</Label>
                <Input id="msgTo" value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="Paste userId (Mongo ObjectId)" />
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
                <Button type="button" onClick={createConversation} disabled={creating}>
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
                        {fmtDate(m.createdAt)} · sender {m.senderUserId}
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


