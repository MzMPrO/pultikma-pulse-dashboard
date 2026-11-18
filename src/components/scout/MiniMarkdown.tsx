import type { ReactNode } from "react";

// Tiny, dependency-free markdown renderer for agent chat messages.
// Builds React elements only (no dangerouslySetInnerHTML), so any HTML-looking
// text from the LLM is rendered as plain text.

type Block =
  | { type: "p"; lines: string[] }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+\.\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] }); // paragraph separator marker
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      continue;
    }
    const ul = BULLET.exec(line);
    if (ul) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") last.items.push(ul[1]);
      else blocks.push({ type: "ul", items: [ul[1]] });
      continue;
    }
    const ol = NUMBERED.exec(line);
    if (ol) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "ol") last.items.push(ol[1]);
      else blocks.push({ type: "ol", items: [ol[1]] });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last?.type === "p") last.lines.push(line);
    else blocks.push({ type: "p", lines: [line] });
  }
  return blocks.filter((b) => b.type !== "p" || b.lines.length > 0);
}

function renderInline(text: string): ReactNode[] {
  const re = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(
        <code key={key++} className="rounded bg-ink-foreground/10 px-1 py-px font-mono text-[0.85em]">
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      out.push(<em key={key++}>{m[3]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MiniMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h": {
            const cls =
              b.level === 1
                ? "text-base font-bold"
                : b.level === 2
                  ? "text-[15px] font-semibold"
                  : "font-semibold";
            const Tag = `h${b.level}` as "h1" | "h2" | "h3";
            return (
              <Tag key={i} className={`${cls} leading-snug`}>
                {renderInline(b.text)}
              </Tag>
            );
          }
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-0.5 pl-4">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-0.5 pl-4">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            );
          case "p":
            return (
              <p key={i}>
                {b.lines.map((ln, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {renderInline(ln)}
                  </span>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
