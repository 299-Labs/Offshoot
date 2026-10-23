'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DBMessage } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';
import { GitBranch, Loader2, Copy, Check } from 'lucide-react';

interface Props {
  message: DBMessage;
  isStreaming?: boolean;
}

// Recursively extracts raw text from ReactMarkdown AST nodes inside <pre>
function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && node.props && node.props.children) {
    return extractText(node.props.children);
  }
  return '';
}

// Custom Pre element with copy button
function PreBlock({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) {
  const [copied, setCopied] = useState(false);
  const rawCode = extractText(children).replace(/\n$/, '');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rawCode) return;
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  return (
    <div className="relative group/code my-3.5 min-w-0 max-w-full">
      <div className="absolute right-2 top-2 z-10">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#181c1b]/90 backdrop-blur-sm border border-[#242b28] text-[#8e948f] hover:text-[#ecebe6] hover:border-[#506c64] transition opacity-0 group-hover/code:opacity-100 cursor-pointer text-[11px]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#506c64]" />
              <span className="text-[#506c64] text-[10px] font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px] font-medium">Copy</span>
            </>
          )}
        </button>
      </div>

      <pre
        {...props}
        className="bg-[#0d0f0e] border border-[#242b28] p-3.5 rounded-xl max-w-full overflow-x-auto whitespace-pre text-[12px] font-mono text-[#ecebe6] [&>code]:bg-transparent [&>code]:p-0 [&>code]:border-0 [&>code]:text-inherit"
      >
        {children}
      </pre>
    </div>
  );
}

export function MessageItem({ message, isStreaming = false }: Props) {
  const { messages, setActiveNode } = useTreeStore();
  const [responseCopied, setResponseCopied] = useState(false);
  const isUser = message.role === 'user';

  const tangentChildren = (message.childrenIds || [])
    .map((id) => messages[id])
    .filter((m) => m && m.isTangentRoot);

  const handleCopyResponse = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setResponseCopied(true);
      setTimeout(() => setResponseCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy response: ', err);
    }
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full min-w-0`}>
      <div
        data-message-id={message.id}
        data-role={message.role}
        className={`max-w-[85%] min-w-0 rounded-2xl px-5 py-3.5 text-sm leading-relaxed select-text transition-colors duration-400 ease-out ${
          isUser
            ? 'bg-[#111313] text-[#ecebe6] border border-[#f7b2bd]/50'
            : isStreaming
            ? 'bg-[#111313] text-[#ecebe6] border border-transparent'
            : 'bg-[#111313] text-[#ecebe6] border border-[#506c64]/60'
        }`}
      >
        {/* Tangent Root Anchor Badge */}
        {message.isTangentRoot && message.anchorSnippet && (
          <div className="mb-2.5 pb-2 border-b border-[#242b28] text-xs text-[#dfd0b8] flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-[#f7b2bd] shrink-0" />
            <span className="italic line-clamp-1">Anchor: "{message.anchorSnippet}"</span>
          </div>
        )}

        {/* Bubble Content */}
        {message.content ? (
          isUser ? (
            <div className="whitespace-pre-wrap font-normal">{message.content}</div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none break-words min-w-0
              /* Body text: soft alabaster, comfortable vertical cadence */
              text-[#d6dad7] leading-[1.7] text-[13.5px]

              /* Headers: Warm Sand (#dfd0b8) proximity-anchored */
              [&>h1]:text-[#dfd0b8] [&>h1]:text-base [&>h1]:font-semibold [&>h1]:mt-5 [&>h1]:mb-1.5 [&>h1:first-child]:mt-0
              [&>h2]:text-[#dfd0b8] [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-4 [&>h2]:mb-1.5 [&>h2:first-child]:mt-0
              [&>h3]:text-[#dfd0b8] [&>h3]:text-xs [&>h3]:font-medium [&>h3]:uppercase [&>h3]:tracking-wider [&>h3]:mt-3.5 [&>h3]:mb-1 [&>h3:first-child]:mt-0

              /* Bold emphasis: Softened warm chalk */
              [&_strong]:text-[#f4f3ef] [&_strong]:font-semibold

              /* 1st Level Lists: Sage markers */
              [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2.5 [&>ul>li]:my-1
              [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2.5 [&>ol>li]:my-1
              [&>ul>li::marker]:text-[#506c64]
              [&>ol>li::marker]:text-[#8e948f]

              /* Nested 2nd Level Lists */
              [&_ul_ul]:list-[circle] [&_ul_ul]:pl-5 [&_ul_ul]:my-1
              [&_ol_ol]:list-[lower-alpha] [&_ol_ol]:pl-5 [&_ol_ol]:my-1
              [&_ul_ul>li::marker]:text-[#f7b2bd]/70
              [&_ol_ol>li::marker]:text-[#f7b2bd]/70

              /* Blockquotes / Callouts */
              [&>blockquote]:border-l-2
              [&>blockquote]:border-[#506c64]
              [&>blockquote]:bg-[#141716]/50
              [&>blockquote]:pl-3.5
              [&>blockquote]:pr-3
              [&>blockquote]:py-1.5
              [&>blockquote]:my-3
              [&>blockquote]:rounded-r-lg
              [&>blockquote]:text-[#ecebe6]/90
              [&>blockquote]:italic
              [&>blockquote>p]:mb-0

              /* Paragraph spacing */
              [&>p]:mb-3 [&>p:last-child]:mb-0

              /* Inline code pill matching warm sand */
              [&_:not(pre)>code]:text-[#dfd0b8]
              [&_:not(pre)>code]:bg-[#181c1b]
              [&_:not(pre)>code]:border
              [&_:not(pre)>code]:border-[#242b28]
              [&_:not(pre)>code]:px-1.5
              [&_:not(pre)>code]:py-0.5
              [&_:not(pre)>code]:rounded-md
              [&_:not(pre)>code]:text-[12px]
              [&_:not(pre)>code]:font-mono

              /* Markdown Tables */
              [&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_table]:text-xs
              [&_th]:border-b [&_th]:border-[#242b28] [&_th]:text-[#dfd0b8] [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold
              [&_td]:border-b [&_td]:border-[#242b28]/60 [&_td]:p-2 [&_td]:text-[#ecebe6]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: PreBlock,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )
        ) : (
          <span className="flex items-center gap-2 text-[#8e948f] italic text-xs py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#506c64]" />
            Generating response...
          </span>
        )}

        {/* Assistant Message Actions & Branch Badges Footer */}
        {!isUser && !isStreaming && message.content && (
          <div className="mt-3 pt-2 border-t border-[#242b28]/60 flex items-center justify-between gap-2">
            {/* Inline Branch Navigation Pills */}
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {tangentChildren.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => setActiveNode(branch.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1c1416] hover:bg-[#281b1e] border border-[#f7b2bd]/30 text-[11px] text-[#f7b2bd] transition cursor-pointer"
                >
                  <GitBranch className="w-3 h-3 text-[#f7b2bd]" />
                  <span className="truncate max-w-[180px]">
                    {branch.anchorSnippet || 'Offshoot'}
                  </span>
                </button>
              ))}
            </div>

            {/* Whole Response Copy Button */}
            <button
              type="button"
              onClick={handleCopyResponse}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-[#8e948f] hover:text-[#ecebe6] hover:bg-[#171a19] border border-transparent hover:border-[#242b28] transition cursor-pointer shrink-0 ml-auto"
              title="Copy entire response"
            >
              {responseCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#506c64]" />
                  <span className="text-[#506c64]">Copied response</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy response</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}