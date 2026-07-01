import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Helper to parse inline formatting like bold (**text**) and code (`code`)
  const parseInlineStyles = (text: string): string => {
    let html = text;
    
    // Replace **bold** with <strong> tags
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white bg-purple-950/20 px-1 rounded">$1</strong>');
    
    // Replace *italic* with <em> tags
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-slate-200">$1</em>');
    
    // Replace `code` with styled <code> tags
    html = html.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-slate-950/80 border border-slate-800 rounded font-mono text-purple-350 text-xs">$1</code>');
    
    return html;
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  
  let listItems: string[] = [];
  let uniqueKeyCounter = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${uniqueKeyCounter++}`} className="list-disc pl-6 space-y-2 my-4 text-slate-300 text-sm">
          {listItems.map((item, idx) => (
            <li 
              key={`li-${idx}`}
              dangerouslySetInnerHTML={{ __html: parseInlineStyles(item) }}
            />
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 1. Horizontal Rule
    if (trimmedLine === "---") {
      flushList();
      elements.push(<hr key={`hr-${uniqueKeyCounter++}`} className="border-slate-800/80 my-6" />);
      continue;
    }

    // 2. Headings
    if (trimmedLine.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${uniqueKeyCounter++}`} className="text-2xl md:text-3xl font-extrabold text-white font-heading mt-6 mb-4 tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text">
          {trimmedLine.substring(2)}
        </h1>
      );
      continue;
    }
    
    if (trimmedLine.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${uniqueKeyCounter++}`} className="text-xl md:text-2xl font-bold text-white font-heading mt-6 mb-3 border-b border-slate-800/50 pb-1.5">
          {trimmedLine.substring(3)}
        </h2>
      );
      continue;
    }

    if (trimmedLine.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${uniqueKeyCounter++}`} className="text-lg font-bold text-purple-300 font-heading mt-5 mb-2.5">
          {trimmedLine.substring(4)}
        </h3>
      );
      continue;
    }

    if (trimmedLine.startsWith("#### ")) {
      flushList();
      elements.push(
        <h4 key={`h4-${uniqueKeyCounter++}`} className="text-sm font-bold text-slate-200 uppercase tracking-wider font-sans mt-4 mb-2">
          {trimmedLine.substring(5)}
        </h4>
      );
      continue;
    }

    // 3. Bullet points
    if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ") || trimmedLine.startsWith("• ")) {
      const contentOfItem = trimmedLine.substring(2);
      listItems.push(contentOfItem);
      continue;
    }

    // 4. Blockquotes or Alerts
    if (trimmedLine.startsWith("> ")) {
      flushList();
      elements.push(
        <div 
          key={`quote-${uniqueKeyCounter++}`} 
          className="border-l-4 border-purple-500 pl-4 py-2.5 my-4 bg-purple-950/10 rounded-r-xl text-xs text-slate-350 italic"
          dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmedLine.substring(2)) }}
        />
      );
      continue;
    }

    // 5. General Paragraphs
    if (trimmedLine !== "") {
      flushList();
      elements.push(
        <p 
          key={`p-${uniqueKeyCounter++}`} 
          className="text-slate-300 text-sm leading-relaxed mb-4"
          dangerouslySetInnerHTML={{ __html: parseInlineStyles(trimmedLine) }}
        />
      );
    } else {
      // Empty line closes any open list
      flushList();
    }
  }

  // Final list flush
  flushList();

  return <div className="markdown-body font-sans text-left space-y-1">{elements}</div>;
}
