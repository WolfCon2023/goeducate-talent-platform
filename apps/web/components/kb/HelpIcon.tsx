"use client";

import { useHelpDrawer } from "./HelpDrawerProvider";

export function HelpIcon(props: { helpKey: string; title?: string; initialQuery?: string; className?: string }) {
  const help = useHelpDrawer();
  return (
    <button
      type="button"
      onClick={() => help.open({ helpKey: props.helpKey, title: props.title, initialQuery: props.initialQuery })}
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


