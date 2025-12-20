'use client';

import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+[^\s.,;!?)\]]?)/gi;

/**
 * Converte URLs em texto simples para links clicáveis e preserva quebras de linha.
 */
export function renderTextWithLinks(text: string): ReactNode[] {
  if (!text) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    let lastIndex = 0;
    const matches = [...line.matchAll(URL_PATTERN)];

    if (matches.length === 0) {
      nodes.push(line);
    } else {
      matches.forEach((match, matchIndex) => {
        const matchStart = match.index ?? 0;
        const matchEnd = matchStart + match[0].length;

        if (matchStart > lastIndex) {
          nodes.push(line.slice(lastIndex, matchStart));
        }

        const rawUrl = match[0];
        const href = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

        nodes.push(
          <a
            key={`link-${lineIndex}-${matchIndex}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dashed underline-offset-2 hover:text-deepGreen"
          >
            {rawUrl}
          </a>
        );

        lastIndex = matchEnd;
      });

      if (lastIndex < line.length) {
        nodes.push(line.slice(lastIndex));
      }
    }

    if (lineIndex < lines.length - 1) {
      nodes.push(<br key={`br-${lineIndex}`} />);
    }
  });

  return nodes;
}
