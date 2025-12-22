"use client";

import { useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot (should remain empty)
  const [company, setCompany] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSending(true);
    try {
      await apiFetch("/contact", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          email,
          subject,
          message,
          company: company || undefined
        })
      });
      setStatus("Thanks — your message was sent. We’ll respond as soon as possible.");
      setFullName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setCompany("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <h1 className="text-xl font-semibold">Contact GoEducate</h1>
        <p className="mt-1 text-sm text-white/80">
          You can also email us directly at <span className="font-semibold text-white">info@goeducateinc.org</span>.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              placeholder="How can we help?"
            />
          </div>

          {/* Honeypot field (hidden). Bots often fill it. */}
          <div className="hidden">
            <Label htmlFor="company">Company</Label>
            <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send message"}
            </Button>
            {status ? <span className="text-sm text-white/80">{status}</span> : null}
          </div>
        </form>
      </Card>
    </div>
  );
}


