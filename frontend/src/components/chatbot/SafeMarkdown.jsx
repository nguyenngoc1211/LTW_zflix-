import { Fragment } from "react";
import { Link } from "react-router-dom";

const safeLink = (raw) => {
  const href = raw.trim();
  if (!href || /[\s<>]/.test(href)) return null;
  if (/^\/movies\/[1-9]\d*(?:[?#][^\s<>\\]*)?$/.test(href)) return { href, internal: true };
  try {
    const url = new URL(href);
    if (["http:", "https:"].includes(url.protocol)) return { href: url.href, internal: false };
  } catch {
    // Unsupported and malformed destinations are rendered as text.
  }
  return null;
};

const inlinePattern = /(!?\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;

const inline = (text, prefix) => {
  const parts = [];
  let position = 0;
  for (const match of text.matchAll(inlinePattern)) {
    if (match.index > position) parts.push(text.slice(position, match.index));
    const key = `${prefix}-${match.index}`;
    if (match[2] !== undefined) {
      const target = match[1].startsWith("!") ? null : safeLink(match[3]);
      parts.push(!target ? match[2] : target.internal
        ? <Link key={key} to={target.href}>{match[2]}</Link>
        : <a key={key} href={target.href} target="_blank" rel="noopener noreferrer nofollow">{match[2]}</a>);
    } else if (match[4] !== undefined) {
      parts.push(<strong key={key}>{match[4]}</strong>);
    } else if (match[5] !== undefined) {
      parts.push(<code key={key}>{match[5]}</code>);
    } else {
      parts.push(<em key={key}>{match[6]}</em>);
    }
    position = match.index + match[0].length;
  }
  if (position < text.length) parts.push(text.slice(position));
  return parts;
};

const listItem = (line) => {
  const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
  if (unordered) return { ordered: false, content: unordered[1] };
  const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
  return ordered ? { ordered: true, content: ordered[1] } : null;
};

const paragraph = (lines, key) => <p key={key}>{lines.map((line, index) => <Fragment key={index}>
  {index > 0 && <br />}{inline(line, `${key}-${index}`)}
</Fragment>)}</p>;

export default function SafeMarkdown({ text }) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let pending = [];
  let index = 0;

  const flush = () => {
    if (pending.length) blocks.push(paragraph(pending, `p-${blocks.length}`));
    pending = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { flush(); index += 1; continue; }
    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
    if (heading) {
      flush();
      const Heading = `h${Math.min(heading[1].length + 2, 5)}`;
      blocks.push(<Heading key={`h-${index}`}>{inline(heading[2], `h-${index}`)}</Heading>);
      index += 1;
      continue;
    }
    const first = listItem(line);
    if (first) {
      flush();
      const items = [];
      while (index < lines.length) {
        const next = listItem(lines[index]);
        if (!next || next.ordered !== first.ordered) break;
        items.push(<li key={index}>{inline(next.content, `li-${index}`)}</li>);
        index += 1;
      }
      blocks.push(first.ordered
        ? <ol key={`list-${index}`}>{items}</ol>
        : <ul key={`list-${index}`}>{items}</ul>);
      continue;
    }
    pending.push(line);
    index += 1;
  }
  flush();
  return <div className="zflix-chat-markdown">{blocks}</div>;
}
