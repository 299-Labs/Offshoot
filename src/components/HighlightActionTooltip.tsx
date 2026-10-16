'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch } from 'lucide-react';
import { useTreeStore } from '@/store/useTreeStore';

interface HighlightActionTooltipProps {
  onCreateTangent: (parentMessageId: string, anchorSnippet: string) => void;
}

export function HighlightActionTooltip({ onCreateTangent }: HighlightActionTooltipProps) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setCoords(null);
      setTargetMessageId(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 3) {
      setCoords(null);
      setTargetMessageId(null);
      return;
    }

    // Find if selection is inside an assistant message element.
    let node: Node | null = selection.anchorNode;
    let msgContainer: HTMLElement | null = null;
    while (node) {
      if (node instanceof HTMLElement && node.dataset.messageId) {
        msgContainer = node;
        break;
      }
      node = node.parentNode;
    }

    if (!msgContainer || msgContainer.dataset.role !== 'assistant') {
      setCoords(null);
      setTargetMessageId(null);
      return;
    }

    const msgId = msgContainer.dataset.messageId;
    if (!msgId) {
      setCoords(null);
      setTargetMessageId(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setTargetMessageId(msgId);
    setCoords({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  if (!coords || !targetMessageId) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        transform: 'translate(-50%, -100%)',
      }}
      className="z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
    >
      <div className="pointer-events-auto">
        <button
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent text deselection on click
            onCreateTangent(targetMessageId, selectedText);
            setCoords(null);
            setTargetMessageId(null);
            window.getSelection()?.removeAllRanges();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-emerald-500/50 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 text-xs font-medium rounded-full shadow-lg shadow-black/40 backdrop-blur transition-all active:scale-95"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Ask Tangent</span>
        </button>
      </div>
    </div>
  );
}