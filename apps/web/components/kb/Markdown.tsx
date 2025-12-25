"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function Markdown(props: { markdown: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-a:text-indigo-300 hover:prose-a:text-indigo-200 prose-a:underline prose-hr:border-white/10">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {props.markdown}
      </ReactMarkdown>
    </div>
  );
}


