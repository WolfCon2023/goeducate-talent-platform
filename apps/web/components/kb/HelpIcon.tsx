"use client";

import { useRouter } from "next/navigation";

import { useHelpDrawer } from "./HelpDrawerProvider";
import { KB_HELPKEY_TO_SLUG } from "@/lib/kbHelpRegistry";

export function HelpIcon(props: {
  helpKey: string;
  title?: string;
  initialQuery?: string;
  className?: string;
  behavior?: "route" | "drawer";
}) {
  const help = useHelpDrawer();
  const router = useRouter();
  const behavior = props.behavior ?? "route";
  return (
    <button
      type="button"
      onClick={() => {
        if (behavior === "drawer") {
          help.open({ helpKey: props.helpKey, title: props.title, initialQuery: props.initialQuery });
          return;
        }
        const slug = KB_HELPKEY_TO_SLUG[props.helpKey];
        if (slug) {
          router.push(`/kb/${encodeURIComponent(slug)}`);
        } else {
          router.push(`/kb?helpKey=${encodeURIComponent(props.helpKey)}`);
        }
      }}
      aria-label={props.title ? `Help: ${props.title}` : "Help"}
      title={props.title ? `Help: ${props.title}` : "Help"}
      className={
        props.className ??
        "inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
      }
    >
      ?
    </button>
  );
}


