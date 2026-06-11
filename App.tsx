import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sender, type Message, type ChatSession, type Session } from './types';
import { COMMANDS } from './constants';
import { createChatSession, sendMessageStream } from './services/geminiService';
import { UserIcon, SendIcon, LoadingIcon, CopyIcon, CheckIcon, BookOpenIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, ChatBubbleLeftRightIcon } from './components/icons';
import { Content } from '@google/genai';

const markdownComponents = {
    p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-[13px] md:text-[13.5px] leading-relaxed text-brand-text-primary" {...props} />,
    h1: ({node, ...props}) => <h1 className="text-[15px] font-bold mt-4 mb-2 border-b border-brand-border/60 pb-1 text-brand-text-primary font-sans" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-[13.5px] font-bold mt-3 mb-1.5 text-brand-text-primary font-sans" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-xs font-semibold mt-2 mb-1 text-brand-text-secondary font-sans" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 pl-3 space-y-1 text-[13px] md:text-[13.5px] leading-relaxed text-brand-text-primary" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 pl-3 space-y-1 text-[13px] md:text-[13.5px] leading-relaxed text-brand-text-primary" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-brand-border pl-4 italic my-2 text-brand-text-secondary text-[13px]" {...props} />,
    code: ({node, inline, className, children, ...props}) => {
      return !inline ? (
        <pre className="bg-[#f6f8fa] text-brand-text-primary p-3 rounded-xl my-2 overflow-x-auto text-[11.5px] font-mono border border-brand-border/60">
          <code {...props}>
            {String(children).replace(/\n$/, '')}
          </code>
        </pre>
      ) : (
        <code className="bg-brand-secondary/80 text-brand-accent font-mono px-1.5 py-0.5 rounded text-[11px]" {...props}>
          {children}
        </code>
      )
    },
    a: ({node, ...props}) => <a className="text-brand-accent hover:underline text-[13px]" target="_blank" rel="noopener noreferrer" {...props} />,
    table: ({node, ...props}) => <div className="overflow-x-auto my-2.5"><table className="w-full text-xs border-collapse border border-brand-border/50 shadow-xs" {...props} /></div>,
    thead: ({node, ...props}) => <thead className="bg-brand-secondary/50 text-[11px] uppercase tracking-wider" {...props} />,
    th: ({node, ...props}) => <th className="border border-brand-border/50 px-2.5 py-1.5 text-left font-bold text-brand-text-primary" {...props} />,
    td: ({node, ...props}) => <td className="border border-brand-border/50 px-2.5 py-1.5 text-[11.5px] leading-normal text-brand-text-primary" {...props} />,
};

const cleanTitle = (text: string): string => {
    let clean = text.trim();
    if (clean.startsWith('/')) {
        const parts = clean.split(' ');
        const cmd = parts[0].replace('/', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const args = parts.slice(1).join(' ');
        clean = args ? `${cmd}: ${args}` : cmd;
    }
    return clean.substring(0, 40);
};

const examplePrompts = [
  {
    title: 'Start a patient case',
    prompt: '78M with hx of CAD, HFpEF presents with 3 days of worsening SOB and LE edema.',
    icon: '🏥',
  },
  {
    title: 'Ask a clinical question',
    prompt: '/ask_the_expert What is the evidence for using steroids in community-acquired pneumonia?',
    icon: '🎓',
  },
  {
    title: 'Run a clinical simulation',
    prompt: '/run_simulation A 55-year-old patient presents with chest pain. Go.',
    icon: '🚨',
  }
];

const ExamplePrompts: React.FC<{ onPromptClick: (prompt: string) => void }> = ({ onPromptClick }) => (
    <div className="w-full mt-12">
      <h3 className="text-sm font-medium text-brand-text-secondary/80 mb-5 text-center">Or try one of these examples:</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full px-4">
        {examplePrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onPromptClick(p.prompt)}
            className="p-5 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-2xl shadow-xs hover:shadow transition-all duration-200 text-left h-full flex flex-col justify-between hover:border-brand-accent/50 hover:-translate-y-0.5 active:scale-[0.98] group"
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl p-2 bg-brand-secondary/80 rounded-xl group-hover:bg-brand-accent/10 transition-colors">{p.icon}</span>
                <span className="text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </div>
              <div>
                <p className="font-bold text-brand-text-primary mb-1.5 text-sm">{p.title}</p>
                <p className="text-xs text-brand-text-secondary/90 leading-relaxed">{p.prompt}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

const convertMessagesToHistory = (messages: Message[]): Content[] => {
    return messages
        .filter(msg => msg.status === 'complete' && msg.content && !msg.isChoicePrompt) // Only use completed, non-empty messages (exclude choice prompts)
        .map(msg => ({
            role: msg.sender === Sender.User ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));
};

const MessageBubble: React.FC<{
  message: Message;
  onRetry: () => void;
  onSelectChoice?: (choiceId: string, originalCaseText: string) => void;
}> = ({ message, onRetry, onSelectChoice }) => {
  const isUser = message.sender === Sender.User;
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (message.content) {
      navigator.clipboard.writeText(message.content).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }).catch(err => {
        console.error("Failed to copy text:", err);
      });
    }
  }, [message.content]);

  if (isUser) {
    return (
      <div className="flex justify-end my-4 select-text">
        <div className="bg-brand-secondary text-brand-text-primary px-5 py-3 rounded-2xl max-w-[70%] shadow-xs border border-brand-border/10">
          <p className="whitespace-pre-wrap text-[13px] md:text-[13.5px] leading-relaxed font-sans">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-4 my-6 select-text">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-surface border border-brand-border/30 shadow-xs flex items-center justify-center">
        <img src="/logo.svg" className="h-6 w-auto" alt="AI Avatar" />
      </div>
      <div className="flex-1 min-w-0 text-brand-text-primary text-[13px] md:text-[13.5px] leading-relaxed space-y-3 pt-0.5">
        {(message.status === 'streaming' && message.content === '') ? (
          <div className="flex items-center text-brand-text-secondary text-[13px] md:text-[13.5px]">
            <LoadingIcon className="w-4 h-4 mr-2.5 text-brand-accent animate-pulse" />
            {message.loadingMessage ? (
              <ReactMarkdown
                children={message.loadingMessage}
                components={{ p: React.Fragment }} 
              />
            ) : (
              <span className="animate-pulse">EvidenceFlowAI is thinking...</span>
            )}
          </div>
        ) : message.isHtml ? (
          <div className="prose prose-sm max-w-none text-brand-text-primary text-[13px] md:text-[13.5px] font-serif" dangerouslySetInnerHTML={{ __html: message.content }} />
        ) : (
          <div className="prose prose-sm max-w-none text-brand-text-primary text-[13px] md:text-[13.5px] font-serif">
            <ReactMarkdown
              children={message.content}
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            />
          </div>
        )}
        
        {message.isChoicePrompt && (
          <div className="mt-4 pt-3 border-t border-brand-border/20">
            {!message.choiceSelected && (
              <p className="text-xs font-semibold text-brand-text-secondary mb-3">Please choose how you would like to proceed with this patient case:</p>
            )}
            {message.choiceSelected ? (
              <p className="text-xs text-brand-text-secondary italic">
                Selected: <span className="font-semibold text-brand-accent">{
                  message.choiceSelected === 'socratic' ? '🎓 Socratic Mentorship' :
                  message.choiceSelected === '/assessment_and_plan' ? '📝 Daily Progress Plan' :
                  message.choiceSelected === '/short_presentation' ? '📢 Rounds Presentation' :
                  message.choiceSelected === '/handoff' ? '🔄 IPASS/SBAR Handoff' :
                  message.choiceSelected === '/sticky_note' ? '📌 Quick Sticky Note' :
                  message.choiceSelected === '/clinicalalgorithm' ? '🧠 Clinical Algorithm' :
                  message.choiceSelected === '/run_simulation' ? '🚨 Clinical Simulation' :
                  message.choiceSelected
                }</span>
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => onSelectChoice?.('socratic', message.originalCaseText || '')}
                  className="px-4 py-3 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-xl text-sm font-semibold hover:border-brand-accent/50 transition-all text-left flex items-center gap-3 shadow-xs hover:shadow active:scale-[0.99] duration-150"
                >
                  <span className="text-xl">🎓</span>
                  <div>
                    <p className="font-bold text-brand-text-primary text-xs">Socratic Mentorship</p>
                    <p className="text-[10px] text-brand-text-secondary font-normal leading-tight mt-0.5">Socratically discuss the case.</p>
                  </div>
                </button>
                <button
                  onClick={() => onSelectChoice?.('/assessment_and_plan', message.originalCaseText || '')}
                  className="px-4 py-3 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-xl text-sm font-semibold hover:border-brand-accent/50 transition-all text-left flex items-center gap-3 shadow-xs hover:shadow active:scale-[0.99] duration-150"
                >
                  <span className="text-xl">📝</span>
                  <div>
                    <p className="font-bold text-brand-text-primary text-xs">Daily Progress Plan</p>
                    <p className="text-[10px] text-brand-text-secondary font-normal leading-tight mt-0.5">Generate daily progress A&P.</p>
                  </div>
                </button>
                <button
                  onClick={() => onSelectChoice?.('/short_presentation', message.originalCaseText || '')}
                  className="px-4 py-3 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-xl text-sm font-semibold hover:border-brand-accent/50 transition-all text-left flex items-center gap-3 shadow-xs hover:shadow active:scale-[0.99] duration-150"
                >
                  <span className="text-xl">📢</span>
                  <div>
                    <p className="font-bold text-brand-text-primary text-xs">Rounds Presentation</p>
                    <p className="text-[10px] text-brand-text-secondary font-normal leading-tight mt-0.5">Prepare oral presentation notes.</p>
                  </div>
                </button>
                <button
                  onClick={() => onSelectChoice?.('/handoff', message.originalCaseText || '')}
                  className="px-4 py-3 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-xl text-sm font-semibold hover:border-brand-accent/50 transition-all text-left flex items-center gap-3 shadow-xs hover:shadow active:scale-[0.99] duration-150"
                >
                  <span className="text-xl">🔄</span>
                  <div>
                    <p className="font-bold text-brand-text-primary text-xs">IPASS/SBAR Handoff</p>
                    <p className="text-[10px] text-brand-text-secondary font-normal leading-tight mt-0.5">Generate handoff for covering team.</p>
                  </div>
                </button>
                <button
                  onClick={() => onSelectChoice?.('/sticky_note', message.originalCaseText || '')}
                  className="px-4 py-3 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-xl text-sm font-semibold hover:border-brand-accent/50 transition-all text-left flex items-center gap-3 shadow-xs hover:shadow active:scale-[0.99] duration-150"
                >
                  <span className="text-xl">📌</span>
                  <div>
                    <p className="font-bold text-brand-text-primary text-xs">Quick Sticky Note</p>
                    <p className="text-[10px] text-brand-text-secondary font-normal leading-tight mt-0.5">Create summary note card.</p>
                  </div>
                </button>
                <button
                  onClick={() => onSelectChoice?.('/clinicalalgorithm', message.originalCaseText || '')}
                  className="px-4 py-3 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-xl text-sm font-semibold hover:border-brand-accent/50 transition-all text-left flex items-center gap-3 shadow-xs hover:shadow active:scale-[0.99] duration-150"
                >
                  <span className="text-xl">🧠</span>
                  <div>
                    <p className="font-bold text-brand-text-primary text-xs">Clinical Algorithm</p>
                    <p className="text-[10px] text-brand-text-secondary font-normal leading-tight mt-0.5">Generate board-style clinical algorithm.</p>
                  </div>
                </button>
                <button
                  onClick={() => onSelectChoice?.('/run_simulation', message.originalCaseText || '')}
                  className="px-4 py-3 bg-brand-surface hover:bg-brand-secondary border border-brand-border/40 rounded-xl text-sm font-semibold hover:border-brand-accent/50 transition-all text-left flex items-center gap-3 shadow-xs hover:shadow active:scale-[0.99] duration-150"
                >
                  <span className="text-xl">🚨</span>
                  <div>
                    <p className="font-bold text-brand-text-primary text-xs">Clinical Simulation</p>
                    <p className="text-[10px] text-brand-text-secondary font-normal leading-tight mt-0.5">Run interactive medical scenario.</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
        
        {message.status === 'error' && (
           <div className="mt-3 pt-3 border-t border-brand-border/20">
            <p className="text-red-400 text-sm mb-2">Error: {message.content.split('Error: ')[1]}</p>
            <button
              onClick={onRetry}
              className="px-3 py-1 text-xs font-semibold bg-brand-secondary text-brand-text-primary rounded-md hover:bg-brand-border transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201-4.42 5.5 5.5 0 0110.89 2.024l-.135.539a.75.75 0 01-1.423-.356l.135-.54a4 4 0 00-7.94-1.464.75.75 0 01-1.061-1.06 5.5 5.5 0 019.201 4.42zM4.688 8.576a.75.75 0 01.356-1.423l.539-.135a4 4 0 00-1.464-7.94.75.75 0 01-1.06-1.06 5.5 5.5 0 014.42 9.201l.54.135a.75.75 0 01-.356 1.423l-.539-.135a4 4 0 00-1.464 7.94.75.75 0 011.06 1.06 5.5 5.5 0 01-4.42-9.201l-.54-.135z" clipRule="evenodd" />
              </svg>
              Retry
            </button>
          </div>
        )}

        {!isUser && message.content && message.status !== 'streaming' && !message.isChoicePrompt && (
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg text-brand-text-secondary hover:bg-brand-secondary hover:text-brand-text-primary transition-colors flex items-center gap-1 text-[11px]"
              aria-label="Copy to clipboard"
            >
              {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};




const Sidebar: React.FC<{
    sessions: Session[];
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onRenameSession: (id: string, newTitle: string) => void;
    onNewSession: () => void;
    width: number;
}> = ({ sessions, activeSessionId, onSelectSession, onDeleteSession, onRenameSession, onNewSession, width }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const handleSaveRename = (id: string) => {
        if (editTitle.trim()) {
            onRenameSession(id, editTitle.trim());
        }
        setEditingId(null);
    };

    const handleStartRename = (e: React.MouseEvent, id: string, title: string) => {
        e.stopPropagation();
        e.preventDefault();
        setEditingId(id);
        setEditTitle(title);
    };

    // Filter out empty consultations from display, matching the modern Gemini sidebar history
    const populatedSessions = sessions.filter(s => s.messages.length > 0);

    const groupSessionsByTime = (sessionList: Session[]) => {
      const groups: { [key: string]: Session[] } = {
        'Today': [],
        'Yesterday': [],
        'Previous 7 Days': [],
        'Older': [],
      };

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
      const sevenDaysAgoStart = todayStart - 7 * 24 * 60 * 60 * 1000;

      sessionList.forEach(session => {
        const time = session.createdAt || Date.now();
        if (time >= todayStart) {
          groups['Today'].push(session);
        } else if (time >= yesterdayStart) {
          groups['Yesterday'].push(session);
        } else if (time >= sevenDaysAgoStart) {
          groups['Previous 7 Days'].push(session);
        } else {
          groups['Older'].push(session);
        }
      });

      return groups;
    };

    const grouped = groupSessionsByTime(populatedSessions);

    return (
        <aside className="bg-brand-surface flex flex-col border-r border-brand-border/30 h-full overflow-hidden" style={{ width: `${width}px` }}>
            <div className="p-4 border-b border-brand-border/20 flex-shrink-0">
                <button
                    onClick={onNewSession}
                    className="w-full py-2.5 px-4 bg-brand-secondary hover:bg-brand-border/80 text-brand-text-primary text-xs font-semibold rounded-xl border border-brand-border/40 shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] duration-150"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-brand-accent">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New Patient
                </button>
            </div>
            <nav className="flex-grow overflow-y-auto py-3">
                {populatedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-4 text-center text-brand-text-secondary/40 py-12 select-none">
                    <ChatBubbleLeftRightIcon className="w-7 h-7 mb-2.5 opacity-40 text-brand-text-secondary" />
                    <p className="text-[11px] font-semibold tracking-wide">Patients will appear here</p>
                  </div>
                ) : (
                  Object.entries(grouped).map(([label, list]) => {
                    if (list.length === 0) return null;
                    return (
                      <div key={label} className="mb-4">
                        <h3 className="text-[10px] font-bold text-brand-text-secondary/70 uppercase tracking-wider px-5 mb-1.5">{label}</h3>
                        <ul>
                          {list.map(session => {
                            const isActive = activeSessionId === session.id;
                            return (
                              <li key={session.id}>
                                <a
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); onSelectSession(session.id); }}
                                  className={`group flex items-center justify-between py-2 px-4.5 my-0.5 mx-3 rounded-full text-xs md:text-sm transition-all duration-150 ${
                                    isActive 
                                      ? 'bg-brand-secondary text-brand-accent font-semibold shadow-xs' 
                                      : 'text-brand-text-secondary hover:bg-brand-secondary/60 hover:text-brand-text-primary'
                                  }`}
                                >
                                  <div className="flex items-center min-w-0 flex-1 mr-2">
                                    <ChatBubbleLeftRightIcon className={`w-4 h-4 mr-2.5 flex-shrink-0 ${isActive ? 'text-brand-accent' : 'text-brand-text-secondary/60 group-hover:text-brand-text-primary transition-colors'}`} />
                                    {editingId === session.id ? (
                                      <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onBlur={() => handleSaveRename(session.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveRename(session.id);
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-transparent border-b border-brand-accent/50 text-xs px-0.5 py-0.5 focus:outline-none text-brand-text-primary font-normal"
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="truncate">{session.title}</span>
                                    )}
                                  </div>
                                  {editingId !== session.id && (
                                    <div className="flex items-center flex-shrink-0 gap-0.5">
                                      <button
                                        onClick={(e) => handleStartRename(e, session.id, session.title)}
                                        className="p-1 rounded-full text-brand-text-secondary hover:bg-black/5 hover:text-brand-text-primary transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 duration-150"
                                        aria-label="Rename session"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                        className="p-1 rounded-full text-brand-text-secondary hover:bg-red-50 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 duration-150"
                                        aria-label="Delete session"
                                      >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })
                )}
            </nav>
        </aside>
    );
};

const defaultSessionId = crypto.randomUUID();

const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const savedSessions = localStorage.getItem('EvidenceFlowAI-sessions');
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        if (parsedSessions.length > 0) {
          return parsedSessions;
        }
      }
    } catch (e) {
      console.error("Failed to load sessions from localStorage", e);
    }
    return [{
      id: defaultSessionId,
      title: "New Patient",
      messages: [],
      createdAt: Date.now(),
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedSessions = localStorage.getItem('EvidenceFlowAI-sessions');
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        if (parsedSessions.length > 0) {
          return parsedSessions[0].id;
        }
      }
    } catch (e) {
      console.error("Failed to load active session ID from localStorage", e);
    }
    return defaultSessionId;
  });

  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isResizing = useRef(false);

  const chatSessionRef = useRef<ChatSession>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    const sessionsToSave = sessions.filter(s => s.messages.length > 0);
    if (sessionsToSave.length > 0) {
      localStorage.setItem('EvidenceFlowAI-sessions', JSON.stringify(sessionsToSave));
    } else {
      localStorage.removeItem('EvidenceFlowAI-sessions');
    }
  }, [sessions]);

  useEffect(() => {
    if (activeSession) {
      const history = convertMessagesToHistory(activeSession.messages);
      chatSessionRef.current = createChatSession(history);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const handleResizeMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
  }, []);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current && !isSidebarCollapsed) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);

  const handleNewSession = useCallback(() => {
    // Prevent duplicate empty consultations from building up
    const emptySession = sessions.find(s => s.messages.length === 0);
    if (emptySession) {
      setActiveSessionId(emptySession.id);
      setUserInput('');
      setIsLoading(false);
      setError(null);
      return;
    }

    const newSession: Session = {
      id: crypto.randomUUID(),
      title: "New Patient",
      messages: [],
      createdAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setUserInput('');
    setIsLoading(false);
    setError(null);
  }, [sessions]);

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  }, []);

  const handleSelectSession = (id: string) => {
    if (id !== activeSessionId) {
        setActiveSessionId(id);
        setIsLoading(false);
        setError(null);
    }
  };

  const handleDeleteSession = (idToDelete: string) => {
    setSessions(prev => {
      const remainingSessions = prev.filter(s => s.id !== idToDelete);
      if (remainingSessions.length === 0) {
        const newSessionId = crypto.randomUUID();
        const newSession: Session = {
          id: newSessionId,
          title: "New Patient",
          messages: [],
          createdAt: Date.now(),
        };
        setActiveSessionId(newSessionId);
        localStorage.removeItem('EvidenceFlowAI-sessions');
        return [newSession];
      }

      if (activeSessionId === idToDelete) {
        setActiveSessionId(remainingSessions[0].id);
      }
      return remainingSessions;
    });
  };

  const updateMessageInSession = (sessionId: string, messageUpdater: (messages: Message[]) => Message[]) => {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: messageUpdater(s.messages) } : s));
  };

  const handleUpdateSession = (updatedSession: Session) => {
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
  };
  
  const processStream = useCallback(async (prompt: string) => {
    if (!chatSessionRef.current || !activeSessionId) return;

    const currentSessionId = activeSessionId;
    const conversationHistory = messages
        .map(m => `${m.sender === Sender.User ? 'User' : 'EvidenceFlowAI'}: ${m.content}`)
        .join('\n\n');



    try {
      const stream = await sendMessageStream(chatSessionRef.current, prompt, conversationHistory);
      let responseText = '';
      for await (const chunk of stream) {
        responseText += chunk.text;
        updateMessageInSession(currentSessionId, prevMsgs => {
            const newMessages = [...prevMsgs];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.sender === Sender.EvidenceFlowAI) {
              newMessages[newMessages.length - 1] = { ...lastMessage, content: responseText };
            }
            return newMessages;
        });
      }
      updateMessageInSession(currentSessionId, prevMsgs => {
          const newMessages = [...prevMsgs];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.sender === Sender.EvidenceFlowAI) {
            newMessages[newMessages.length - 1] = { ...lastMessage, status: 'complete' };
          }
          return newMessages;
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
       updateMessageInSession(currentSessionId, prevMsgs => {
          const newMessages = [...prevMsgs];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.sender === Sender.EvidenceFlowAI) {
            newMessages[newMessages.length - 1] = { 
               ...lastMessage, 
               status: 'error', 
               content: `*(EvidenceFlowAI apologizes. An error occurred. Please try again.)*\n\n**Error:** ${errorMessage}` 
            };
          }
          return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, messages]);
  
  const sendMessage = useCallback(async (messageContent: string) => {
    const content = messageContent.trim();
    if (!content || isLoading || !activeSessionId) return;
  
    let currentSession = sessions.find(s => s.id === activeSessionId);
    
    if (!currentSession) {
        if (sessions.length > 0) {
            currentSession = sessions[0];
            setActiveSessionId(currentSession.id);
        } else {
            currentSession = { id: activeSessionId || crypto.randomUUID(), title: "New Patient", messages: [], createdAt: Date.now() };
            setSessions([currentSession]);
            setActiveSessionId(currentSession.id);
        }
    }

    if (!chatSessionRef.current) {
        chatSessionRef.current = createChatSession(convertMessagesToHistory(currentSession.messages));
    }

    const isFirstUserMessage = currentSession.messages.filter(m => m.sender === Sender.User).length === 0;
  
    const userMessage: Message = {
      sender: Sender.User,
      content: content,
      timestamp: new Date().toLocaleTimeString(),
      status: 'complete',
    };

    if (isFirstUserMessage && !content.startsWith('/')) {
      const choiceMessage: Message = {
        sender: Sender.EvidenceFlowAI,
        content: "Please choose how you would like to proceed with this patient case:",
        timestamp: new Date().toLocaleTimeString(),
        status: 'complete',
        isChoicePrompt: true,
        originalCaseText: content,
      };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSession.id) {
            return {
                ...s,
                title: cleanTitle(content),
                messages: [...s.messages, userMessage, choiceMessage],
                patientSummary: undefined,
                masterAlgorithmHtml: undefined,
            };
        }
        return s;
      }));

      setUserInput('');
      setIsLoading(false);
      setError(null);
      return;
    }
  
    setSessions(prev => prev.map(s => {
      if (s.id === currentSession.id) {
          return {
              ...s,
              title: isFirstUserMessage ? cleanTitle(content) : s.title,
              messages: [...s.messages, userMessage],
              patientSummary: undefined,
              masterAlgorithmHtml: undefined,
          };
      }
      return s;
    }));

    setUserInput('');
    setIsLoading(true);
    setError(null);

    const isCommand = content.startsWith('/');
    let loadingMessage: string | undefined = undefined;
    let isHtml = false;

    if (isCommand) {
        const commandName = COMMANDS.find(cmd => content.toLowerCase().startsWith(cmd.toLowerCase()));
        if (commandName) {
            if (commandName === '/assessment_and_plan' || 
                commandName === '/short_presentation' || 
                commandName === '/sticky_note' || 
                commandName === '/handoff') {
                const docType = commandName.replace('/', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                loadingMessage = `EvidenceFlowAI is generating the **${docType}**...`;
            } else if (commandName.startsWith('/clinical')) {
                const topic = content.replace(/^\/clinicalalgorithm\s*/i, '').trim();
                loadingMessage = `EvidenceFlowAI is generating the clinical algorithm for **${topic || 'your topic'}**...`;
                isHtml = true;
            }
        }
    }
  
    const EvidenceFlowAIResponsePlaceholder: Message = {
        sender: Sender.EvidenceFlowAI,
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        status: 'streaming',
        loadingMessage,
        isHtml,
    };
    updateMessageInSession(currentSession.id, prev => [...prev, EvidenceFlowAIResponsePlaceholder]);

    await processStream(content);
  }, [isLoading, activeSessionId, sessions, processStream]);

  const handleSendMessage = useCallback(async () => {
    await sendMessage(userInput);
  }, [userInput, sendMessage]);

  const handleSelectChoice = useCallback(async (choiceId: string, originalCaseText: string) => {
    if (!activeSessionId || isLoading) return;

    // 1. Mark the choice message as selected
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: s.messages.map(m => 
            m.isChoicePrompt 
              ? { ...m, choiceSelected: choiceId } 
              : m
          )
        };
      }
      return s;
    }));

    // 2. Perform the action
    if (choiceId === 'socratic') {
      setIsLoading(true);
      setError(null);
      const placeholder: Message = {
        sender: Sender.EvidenceFlowAI,
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        status: 'streaming',
      };
      updateMessageInSession(activeSessionId, prev => [...prev, placeholder]);
      await processStream(originalCaseText);
    } else {
      await sendMessage(choiceId);
    }
  }, [activeSessionId, isLoading, processStream, sendMessage]);

  const handleRetry = useCallback(async () => {
    if (!activeSessionId) return;
    const messagesBeforeRetry = messages.slice(0, -1).filter(m => m.status !== 'error');
    const lastUserMessage = messagesBeforeRetry.filter(m => m.sender === Sender.User).pop();

    if (!lastUserMessage) return;

    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: messagesBeforeRetry } : s));

    const EvidenceFlowAIResponsePlaceholder: Message = {
        sender: Sender.EvidenceFlowAI,
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        status: 'streaming',
    };
    updateMessageInSession(activeSessionId, prev => [...prev, EvidenceFlowAIResponsePlaceholder]);

    await processStream(lastUserMessage.content);
}, [messages, activeSessionId, processStream]);

  const handleCommandClick = (command: string) => {
      if (command.startsWith('/ask') || command.startsWith('/run') || command.startsWith('/clinical')) {
          setUserInput(command + ' ');
          document.querySelector('textarea')?.focus();
      } else {
        sendMessage(command);
      }
  };
  
  const handlePromptClick = (prompt: string) => {
    setUserInput(prompt);
    document.querySelector('textarea')?.focus();
  };



  return (
    <>
    <div className="h-screen w-screen flex bg-brand-bg text-brand-text-primary font-sans overflow-hidden relative">
        <div 
            className="flex-shrink-0 transition-all duration-300 ease-in-out"
            style={{ 
                width: isSidebarCollapsed ? '0px' : `${sidebarWidth}px`,
                overflow: 'hidden'
            }}
        >
            <Sidebar 
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onNewSession={handleNewSession}
                width={sidebarWidth}
            />
        </div>

        {!isSidebarCollapsed && (
             <div 
                className="w-1.5 cursor-col-resize bg-brand-border/50 hover:bg-brand-accent/50 transition-colors flex-shrink-0"
                onMouseDown={handleResizeMouseDown}
            />
        )}
       
        <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute top-1/2 -translate-y-1/2 z-20 w-6 h-6 bg-brand-surface rounded-full shadow-md border border-brand-border hover:bg-brand-secondary flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-accent"
            style={{ 
                left: isSidebarCollapsed ? '8px' : `${sidebarWidth - 12}px`, 
                transition: 'left 0.3s ease-in-out' 
            }}
            aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
            {isSidebarCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex flex-col min-w-0">
            <header className="border-b border-brand-border/30 bg-brand-bg flex-shrink-0">
                <div className="w-full px-6 md:px-12 lg:px-16 xl:px-24 2xl:px-32 py-3">
                    <h1 className="text-xl font-bold flex items-center tracking-tight text-brand-text-primary">
                        <img src="/logo.svg" className="h-12 w-auto mr-3" alt="EvidenceFlowAI Logo" />
                        <span>EvidenceFlowAI</span>
                    </h1>
                </div>
            </header>
            
            <main ref={chatContainerRef} className="flex-grow overflow-y-auto w-full px-6 md:px-12 lg:px-16 xl:px-24 2xl:px-32 py-6">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center text-brand-text-secondary p-8 gemini-glow">
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                    <span className="bg-gradient-to-r from-[#78a9ff] via-[#9b72ff] to-[#ff729f] bg-clip-text text-transparent">Hello, Doctor.</span>
                  </h2>
                  <p className="text-base md:text-lg text-brand-text-secondary/80 max-w-lg mb-8 leading-relaxed">
                    How can I assist you with your patient case, Socratic medical training, or clinical algorithms today?
                  </p>
                  <ExamplePrompts onPromptClick={handlePromptClick} />
                </div>
            )}
            {messages.map((msg, index) => (
              <MessageBubble 
                key={index} 
                message={msg} 
                onRetry={handleRetry} 
                onSelectChoice={handleSelectChoice} 
              />
            ))}
            </main>
            <footer className="p-4 bg-gradient-to-t from-brand-bg via-brand-bg/95 to-transparent flex-shrink-0">
                <div className="w-full px-6 md:px-12 lg:px-16 xl:px-24 2xl:px-32">
                    {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
                    {activeSession && (
                        <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
                            {COMMANDS.map(cmd => (
                                <button 
                                    key={cmd}
                                    onClick={() => handleCommandClick(cmd)}
                                    disabled={isLoading}
                                    className="px-3 py-1 bg-brand-surface border border-brand-border/40 text-brand-text-secondary text-xs rounded-full hover:bg-brand-secondary hover:text-brand-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {cmd}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2 bg-brand-secondary p-2.5 pl-4 rounded-[28px] border border-brand-border/50 focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/20 transition-all shadow-md">
                        <textarea
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder={activeSession ? "Ask a follow-up, provide an update, or use a command..." : "Describe your patient/medical query to begin."}
                            className="w-full bg-transparent focus:outline-none p-1.5 resize-none max-h-40 text-brand-text-primary placeholder:text-brand-text-secondary/50 text-[14px]"
                            rows={1}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isLoading || !userInput.trim()}
                            className="p-2.5 rounded-full bg-brand-accent hover:bg-brand-accent-hover text-brand-bg transition-colors self-end disabled:bg-brand-border/40 disabled:text-brand-text-secondary/40 disabled:cursor-not-allowed flex-shrink-0"
                            aria-label="Send message"
                        >
                            <SendIcon className="w-4 h-4 text-brand-bg" />
                        </button>
                    </div>
                    <p className="text-[10px] text-brand-text-secondary/60 text-center mt-2.5 px-4 leading-normal">
                        ⚠️ <strong>HIPAA Warning:</strong> Do not enter real patient Protected Health Information (PHI) or Identifiable Information (PII). This app is for training/simulation purposes only.
                    </p>
                </div>
            </footer>
        </div>
    </div>
    </>
  );
};

export default App;