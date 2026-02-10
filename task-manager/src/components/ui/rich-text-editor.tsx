import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bold, Italic, Code, List, ListOrdered, CheckSquare, Link as LinkIcon, Eye, Edit3, AtSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  teamMembers?: Array<{ id: string; name: string; avatar?: string }>;
}

export function RichTextEditor({ value, onChange, placeholder = 'Write...', minHeight = '200px', teamMembers = [] }: RichTextEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const handleToolbarAction = (action: string) => {
    if (action === 'bold') insertFormatting('**', '**');
    else if (action === 'italic') insertFormatting('*', '*');
    else if (action === 'code') insertFormatting('`', '`');
    else if (action === 'list') insertFormatting('\n- ');
    else if (action === 'ordered-list') insertFormatting('\n1. ');
    else if (action === 'checklist') insertFormatting('\n- [ ] ');
    else if (action === 'link') insertFormatting('[', '](url)');
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);
    setCursorPosition(cursorPos);
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    if (lastAtSymbol !== -1 && cursorPos - lastAtSymbol <= 20) {
      const searchTerm = textBeforeCursor.substring(lastAtSymbol + 1);
      if (!searchTerm.includes(' ')) {
        setMentionSearch(searchTerm.toLowerCase());
        setShowMentions(true);
      } else setShowMentions(false);
    } else setShowMentions(false);
  };

  const insertMention = (memberName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    const beforeMention = value.substring(0, lastAtSymbol);
    const afterMention = value.substring(cursorPosition);
    const newText = beforeMention + `@${memberName} ` + afterMention;
    onChange(newText);
    setShowMentions(false);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = lastAtSymbol + memberName.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const filteredMembers = teamMembers.filter(m => m.name.toLowerCase().includes(mentionSearch));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-secondary/30 border border-border flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <button type="button" onClick={() => handleToolbarAction('bold')} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Bold"><Bold className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleToolbarAction('italic')} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Italic"><Italic className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleToolbarAction('code')} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Code"><Code className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-border mx-1" />
          <button type="button" onClick={() => handleToolbarAction('list')} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="List"><List className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleToolbarAction('ordered-list')} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Numbered"><ListOrdered className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleToolbarAction('checklist')} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Checklist"><CheckSquare className="w-4 h-4" /></button>
          <div className="w-px h-6 bg-border mx-1" />
          <button type="button" onClick={() => handleToolbarAction('link')} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Link"><LinkIcon className="w-4 h-4" /></button>
          <button type="button" onClick={() => setShowMentions(true)} className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Mention"><AtSign className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 shrink-0">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              mode === 'write'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              mode === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>
      </div>
      <div className="relative">
        {mode === 'write' ? (
          <div className="relative">
            <textarea ref={textareaRef} value={value} onChange={handleTextChange} placeholder={placeholder} className="w-full p-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono text-sm" style={{ minHeight }} />
            {showMentions && filteredMembers.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full left-0 mt-1 w-64 bg-secondary border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {filteredMembers.map((member) => (
                  <button key={member.id} type="button" onClick={() => insertMention(member.name)} className="w-full px-3 py-2 text-left hover:bg-primary/10 flex items-center gap-2 text-sm">
                    <AtSign className="w-3 h-3 text-primary" />
                    <span className="text-foreground">{member.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-secondary border border-border prose prose-invert max-w-none overflow-y-auto" style={{ minHeight }}>
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code({ node, inline, className, children, ...props }) { const match = /language-(\w+)/.exec(className || ''); return !inline && match ? (<SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>) : (<code className={className} {...props}>{children}</code>); } }}>{value}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">{placeholder}</p>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Markdown supported • @ mentions • Code blocks with ```</p>
    </div>
  );
}
