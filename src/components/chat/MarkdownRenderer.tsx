import React from "react";
import { cx } from "../../lib/cx";

type MarkdownRendererProps = {
  content: string;
  isOwn?: boolean;
  className?: string;
};

/** Parses inline markdown syntax (bold, italic, strikethrough, code, links) */
function parseInlineMarkdown(text: string, isOwn?: boolean): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let index = 0;

  // Regex matches: inline code, bold (** or __), strikethrough (~~), italic (* or _), links (http/https)
  const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(~~[^~]+~~)|(\*[^*]+\*|_[^_]+_)|(https?:\/\/[^\s<]+)/g;

  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const matchedStr = match[0];

    if (matchedStr.startsWith("`") && matchedStr.endsWith("`")) {
      // Inline code
      const code = matchedStr.slice(1, -1);
      elements.push(
        <code
          key={index++}
          className={cx(
            "rounded px-1.5 py-0.5 font-mono text-[0.85em]",
            isOwn ? "bg-black/30 text-white" : "bg-black/15 text-text-primary border border-border/40",
          )}
        >
          {code}
        </code>,
      );
    } else if (
      (matchedStr.startsWith("**") && matchedStr.endsWith("**")) ||
      (matchedStr.startsWith("__") && matchedStr.endsWith("__"))
    ) {
      // Bold
      const boldText = matchedStr.slice(2, -2);
      elements.push(
        <strong key={index++} className="font-bold">
          {boldText}
        </strong>,
      );
    } else if (matchedStr.startsWith("~~") && matchedStr.endsWith("~~")) {
      // Strikethrough
      const strikeText = matchedStr.slice(2, -2);
      elements.push(
        <del key={index++} className="line-through opacity-85">
          {strikeText}
        </del>,
      );
    } else if (
      (matchedStr.startsWith("*") && matchedStr.endsWith("*")) ||
      (matchedStr.startsWith("_") && matchedStr.endsWith("_"))
    ) {
      // Italic
      const italicText = matchedStr.slice(1, -1);
      elements.push(
        <em key={index++} className="italic">
          {italicText}
        </em>,
      );
    } else if (matchedStr.startsWith("http://") || matchedStr.startsWith("https://")) {
      // Link
      elements.push(
        <a
          key={index++}
          href={matchedStr}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(
            "underline underline-offset-2 transition-opacity hover:opacity-80",
            isOwn ? "text-white font-medium" : "text-accent font-medium",
          )}
        >
          {matchedStr}
        </a>,
      );
    } else {
      elements.push(matchedStr);
    }

    lastIndex = inlineRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

export function MarkdownRenderer({ content, isOwn, className }: MarkdownRendererProps) {
  if (!content) return null;

  // Split into code blocks vs standard text lines
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  let key = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      const textChunk = content.substring(lastIdx, match.index);
      blocks.push(renderTextParagraphs(textChunk, isOwn, key++));
    }

    const lang = match[1];
    const codeContent = match[2];

    blocks.push(
      <div
        key={key++}
        className={cx(
          "my-2 overflow-x-auto rounded-lg p-3 font-mono text-xs shadow-inner",
          isOwn ? "bg-black/40 text-white/95 border border-white/10" : "bg-bg-base text-text-primary border border-border/60",
        )}
      >
        {lang && <div className="mb-1 text-[10px] uppercase font-bold text-text-muted select-none">{lang}</div>}
        <pre className="whitespace-pre-wrap break-words">{codeContent}</pre>
      </div>,
    );

    lastIdx = codeBlockRegex.lastIndex;
  }

  if (lastIdx < content.length) {
    const remainingText = content.substring(lastIdx);
    blocks.push(renderTextParagraphs(remainingText, isOwn, key++));
  }

  return <div className={cx("space-y-1 select-text leading-relaxed", className)}>{blocks}</div>;
}

function renderTextParagraphs(text: string, isOwn?: boolean, blockKey?: number): React.ReactNode {
  const lines = text.split("\n");
  const parsedLines: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("> ")) {
      // Blockquote
      const quoteText = line.slice(2);
      parsedLines.push(
        <blockquote
          key={i}
          className={cx(
            "my-1 border-l-4 pl-3 italic",
            isOwn ? "border-white/40 text-white/90" : "border-accent/60 text-text-secondary",
          )}
        >
          {parseInlineMarkdown(quoteText, isOwn)}
        </blockquote>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      // List item
      const itemText = line.slice(2);
      parsedLines.push(
        <div key={i} className="flex items-start gap-2 pl-2">
          <span className="select-none text-accent">•</span>
          <span className="flex-1">{parseInlineMarkdown(itemText, isOwn)}</span>
        </div>,
      );
    } else {
      parsedLines.push(
        <React.Fragment key={i}>
          {parseInlineMarkdown(line, isOwn)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>,
      );
    }
  }

  return <div key={blockKey}>{parsedLines}</div>;
}
