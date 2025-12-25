"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { toast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

export function FeedbackButtons(props: { slug: string; initialYes: number; initialNo: number }) {
  const [sending, setSending] = useState(false);
  const [yes, setYes] = useState(props.initialYes);
  const [no, setNo] = useState(props.initialNo);

  async function send(helpful: boolean) {
    setSending(true);
    try {
      const token = getAccessToken();
      if (!token) {
        toast({ kind: "info", title: "Sign in required", message: "Please sign in to leave feedback." });
        return;
      }
      const res = await apiFetch<{ ok: boolean; helpfulYesCount: number; helpfulNoCount: number }>(
        `/kb/articles/${encodeURIComponent(props.slug)}/feedback`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ helpful }),
          retries: 2,
          retryOn404: true
        }
      );
      setYes(res.helpfulYesCount);
      setNo(res.helpfulNoCount);
      toast({ kind: "success", title: "Thanks!", message: "Feedback recorded." });
    } catch (e) {
      toast({ kind: "error", title: "Failed", message: e instanceof Error ? e.message : "Failed to send feedback" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void send(true)} disabled={sending}>
        Yes
      </Button>
      <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void send(false)} disabled={sending}>
        No
      </Button>
      <div className="text-xs text-[color:var(--muted)]">
        {yes} yes · {no} no
      </div>
    </div>
  );
}


