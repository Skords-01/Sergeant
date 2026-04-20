import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";

interface AssistantMessageBodyProps {
  text: string;
}

export function AssistantMessageBody({ text }: AssistantMessageBodyProps) {
  return (
    <ReactMarkdown
      className="text-sm leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline"
      components={{
        a: ({ href, children }: { href?: string; children?: ReactNode }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
