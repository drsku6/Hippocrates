
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sender, type Message, type ChatSession, type Session, CaseOfTheWeek, CurbsideConsult } from './types';
import { COMMANDS } from './constants';
import { createChatSession, sendMessageStream, generateLearningContent } from './services/geminiService';
import { EvidenceFlowAIIcon, UserIcon, SendIcon, LoadingIcon, CopyIcon, CheckIcon, BookOpenIcon, ChevronDownIcon, TrashIcon } from './components/icons';
import Feedback from './components/Feedback';
import { Content } from '@google/genai';

const markdownComponents = {
    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
    h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 border-b border-brand-border pb-1" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-lg font-semibold mt-3 mb-2" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-2 mb-2" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 pl-4 space-y-1" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 pl-4 space-y-1" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-brand-border pl-4 italic my-2 text-brand-text-secondary" {...props} />,
    code: ({node, inline, className, children, ...props}) => {
      return !inline ? (
        <pre className="bg-brand-text-primary text-brand-surface p-3 rounded-md my-2 overflow-x-auto text-sm">
          <code {...props}>
            {String(children).replace(/\n$/, '')}
          </code>
        </pre>
      ) : (
        <code className="bg-brand-border font-mono px-1.5 py-1 rounded-md text-sm" {...props}>
          {children}
        </code>
      )
    },
    a: ({node, ...props}) => <a className="text-brand-accent hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
    table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table className="w-full text-sm border-collapse border border-brand-border" {...props} /></div>,
    thead: ({node, ...props}) => <thead className="bg-brand-secondary" {...props} />,
    th: ({node, ...props}) => <th className="border border-brand-border px-3 py-2 text-left font-semibold" {...props} />,
    td: ({node, ...props}) => <td className="border border-brand-border px-3 py-2" {...props} />,
};

const convertMessagesToHistory = (messages: Message[]): Content[] => {
    return messages
        .filter(msg => msg.status === 'complete' && msg.content) // Only use completed, non-empty messages
        .map(msg => ({
            role: msg.sender === Sender.User ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));
};

const MessageBubble: React.FC<{ message: Message; onRetry: () => void; }> = ({ message, onRetry }) => {
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

  return (
    <div className={`flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-text-secondary flex items-center justify-center"><EvidenceFlowAIIcon className="w-5 h-5 text-white" /></div>}
      <div className={`relative max-w-3xl w-full p-4 rounded-lg shadow-md ${isUser ? 'bg-brand-accent text-white rounded-br-none max-w-2xl' : 'bg-brand-surface text-brand-text-primary rounded-bl-none'}`}>
        {!isUser && message.content && message.status !== 'streaming' && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-full text-brand-text-secondary hover:bg-brand-border hover:text-brand-text-primary transition-colors"
              aria-label="Copy to clipboard"
            >
              {isCopied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
            </button>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {(message.status === 'streaming' && message.content === '') ? (
              <div className="flex items-center">
                <LoadingIcon className="w-5 h-5 mr-3" />
                {message.loadingMessage ? (
                  <ReactMarkdown
                    children={message.loadingMessage}
                    components={{ p: React.Fragment }} 
                  />
                ) : (
                  <span>EvidenceFlowAI is thinking...</span>
                )}
              </div>
            ) : (
              <ReactMarkdown
                children={message.content}
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              />
            )}
            
            {message.status === 'error' && (
               <div className="mt-3 pt-3 border-t border-brand-border">
                <p className="text-red-600 text-sm mb-2">Error: {message.content.split('Error: ')[1]}</p>
                <button
                  onClick={onRetry}
                  className="px-3 py-1 text-xs font-semibold bg-brand-surface text-brand-text-primary rounded-md hover:bg-brand-border transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201-4.42 5.5 5.5 0 0110.89 2.024l-.135.539a.75.75 0 01-1.423-.356l.135-.54a4 4 0 00-7.94-1.464.75.75 0 01-1.061-1.06 5.5 5.5 0 019.201 4.42zM4.688 8.576a.75.75 0 01.356-1.423l.539-.135a4 4 0 00-1.464-7.94.75.75 0 01-1.06-1.06 5.5 5.5 0 014.42 9.201l.54.135a.75.75 0 01-.356 1.423l-.539-.135a4 4 0 00-1.464 7.94.75.75 0 011.06 1.06 5.5 5.5 0 01-4.42-9.201l-.54-.135z" clipRule="evenodd" />
                  </svg>
                  Retry
                </button>
              </div>
            )}
          </>
        )}
        <p className="text-xs mt-2 opacity-60 text-right">{message.timestamp}</p>
      </div>
       {isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center"><UserIcon className="w-5 h-5 text-white" /></div>}
    </div>
  );
};

const CaseOfTheWeekDisplay: React.FC<{ caseData: CaseOfTheWeek }> = ({ caseData }) => (
    <div className="bg-brand-surface p-6 rounded-lg shadow">
        <h3 className="text-2xl font-bold text-brand-text-primary mb-3">{caseData.title}</h3>
        <div className="space-y-4 text-brand-text-primary">
            <div>
                <h4 className="font-semibold text-lg border-b border-brand-border pb-1 mb-2">Case Summary</h4>
                <ReactMarkdown children={caseData.summary} components={markdownComponents} />
            </div>
            <div>
                <h4 className="font-semibold text-lg border-b border-brand-border pb-1 mb-2">Clinical Reasoning</h4>
                <ReactMarkdown children={caseData.reasoning} components={markdownComponents} />
            </div>
            <div>
                <h4 className="font-semibold text-lg border-b border-brand-border pb-1 mb-2">Key Learning Points</h4>
                <ul className="list-disc list-inside space-y-1 pl-4">
                    {caseData.learningPoints.map((point, index) => <li key={index}><ReactMarkdown children={point} components={{ p: React.Fragment }} /></li>)}
                </ul>
            </div>
            <div>
                <h4 className="font-semibold text-lg border-b border-brand-border pb-1 mb-2">What If?</h4>
                <blockquote className="border-l-4 border-brand-accent pl-4 italic my-2 text-brand-text-secondary">
                  <ReactMarkdown children={caseData.whatIf} components={markdownComponents} />
                </blockquote>
            </div>
        </div>
    </div>
);

const CurbsideConsultsDisplay: React.FC<{ consults: CurbsideConsult[] }> = ({ consults }) => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggleConsult = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="space-y-3">
            {consults.map((consult, index) => (
                <div key={index} className="border border-brand-border rounded-lg bg-brand-surface overflow-hidden">
                    <button onClick={() => toggleConsult(index)} className="w-full text-left p-4 flex justify-between items-center hover:bg-brand-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-accent">
                        <h4 className="font-semibold text-brand-text-primary">{consult.question}</h4>
                        <ChevronDownIcon isOpen={openIndex === index} />
                    </button>
                    {openIndex === index && (
                        <div className="p-4 border-t border-brand-border bg-white">
                            <ReactMarkdown children={consult.answer} components={markdownComponents} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const LearningHub: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onGenerate: () => void;
    isLoading: boolean;
    error: string | null;
    caseOfTheWeek: CaseOfTheWeek | null;
    curbsideConsults: CurbsideConsult[];
}> = ({ isOpen, onClose, onGenerate, isLoading, error, caseOfTheWeek, curbsideConsults }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="bg-brand-bg rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                <header className="p-4 border-b border-brand-border flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-brand-text-primary flex items-center gap-2"><BookOpenIcon /> Learning Hub</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-brand-secondary">&times;</button>
                </header>
                <main className="flex-grow p-6 overflow-y-auto space-y-6">
                    {!caseOfTheWeek && !isLoading && (
                        <div className="text-center p-8 border-2 border-dashed border-brand-border rounded-lg">
                            <h3 className="text-xl font-semibold text-brand-text-primary mb-2">Unlock Personalized Insights</h3>
                            <p className="text-brand-text-secondary mb-4">Analyze your recent consultations to generate a deep-dive case study and actionable curbside consults.</p>
                            <button onClick={onGenerate} className="px-4 py-2 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-accent-hover transition-colors flex items-center gap-2 mx-auto">
                                Analyze Recent Consultations
                            </button>
                        </div>
                    )}
                    {isLoading && (
                        <div className="flex items-center justify-center p-10">
                            <LoadingIcon className="w-8 h-8 mr-4" />
                            <span className="text-lg text-brand-text-secondary">EvidenceFlowAI is analyzing your cases...</span>
                        </div>
                    )}
                    {error && !isLoading && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">Analysis Failed</p>
                            <p>{error}</p>
                            <button onClick={onGenerate} className="mt-2 text-sm font-semibold text-red-800 hover:underline">Try Again</button>
                        </div>
                    )}
                    {caseOfTheWeek && (
                        <section>
                            <h2 className="text-2xl font-bold text-brand-text-primary mb-4 border-b pb-2">Case of the Week</h2>
                            <CaseOfTheWeekDisplay caseData={caseOfTheWeek} />
                        </section>
                    )}
                    {curbsideConsults.length > 0 && (
                        <section>
                            <h2 className="text-2xl font-bold text-brand-text-primary mb-4 border-b pb-2">Curbside Consults</h2>
                            <CurbsideConsultsDisplay consults={curbsideConsults} />
                        </section>
                    )}
                </main>
                 {caseOfTheWeek && (
                    <footer className="p-4 border-t border-brand-border flex-shrink-0">
                        <button onClick={onGenerate} disabled={isLoading} className="w-full px-4 py-2 bg-brand-secondary text-brand-text-primary font-semibold rounded-lg hover:bg-brand-border transition-colors flex items-center gap-2 mx-auto justify-center disabled:opacity-50">
                            {isLoading ? <LoadingIcon className="w-5 h-5" /> : null}
                            {isLoading ? 'Re-analyzing...' : 'Re-analyze and Generate New Insights'}
                        </button>
                    </footer>
                )}
            </div>
        </div>
    );
};

const Sidebar: React.FC<{
    sessions: Session[];
    activeSessionId: string | null;
    onNewSession: () => void;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    width: number;
}> = ({ sessions, activeSessionId, onNewSession, onSelectSession, onDeleteSession, width }) => {
    return (
        <aside className="bg-brand-secondary flex flex-col border-r border-brand-border" style={{ width: `${width}px` }}>
            <div className="p-3 border-b border-brand-border">
                <button onClick={onNewSession} className="w-full px-3 py-2 bg-brand-surface text-brand-text-primary font-semibold rounded-lg text-sm hover:bg-brand-border transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    New Consultation
                </button>
            </div>
            <nav className="flex-grow overflow-y-auto p-2">
                <ul>
                    {sessions.map(session => (
                        <li key={session.id}>
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); onSelectSession(session.id); }}
                                className={`group flex justify-between items-center p-2 my-1 rounded-md text-sm truncate ${activeSessionId === session.id ? 'bg-brand-accent/10 text-brand-accent font-semibold' : 'hover:bg-brand-border'}`}
                            >
                                <span className="truncate">{session.title}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                    className="p-1 rounded-full text-brand-text-secondary hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Delete session"
                                >
                                    <TrashIcon />
                                </button>
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
};

const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);

  // Learning Hub state
  const [isLearningHubOpen, setIsLearningHubOpen] = useState(false);
  const [isLearningHubLoading, setIsLearningHubLoading] =useState(false);
  const [learningHubError, setLearningHubError] = useState<string | null>(null);
  const [caseOfTheWeek, setCaseOfTheWeek] = useState<CaseOfTheWeek | null>(null);
  const [curbsideConsults, setCurbsideConsults] = useState<CurbsideConsult[]>([]);
  const [hasNewLearningContent, setHasNewLearningContent] = useState(false);

  const chatSessionRef = useRef<ChatSession>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('evidenceflowai-sessions');
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        if (parsedSessions.length > 0) {
          setActiveSessionId(parsedSessions[0].id);
        } else {
           handleNewSession();
        }
      } else {
        handleNewSession();
      }
    } catch (e) {
      console.error("Failed to load sessions from localStorage", e);
      handleNewSession();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('evidenceflowai-sessions', JSON.stringify(sessions));
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
    if (isResizing.current) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);

  const handleNewSession = useCallback(() => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: "New Consultation",
      messages: [],
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setUserInput('');
    setIsLoading(false);
    setError(null);
    setCaseOfTheWeek(null);
    setCurbsideConsults([]);
    setHasNewLearningContent(false);
    setLearningHubError(null);
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
        if (activeSessionId === idToDelete) {
            if (remainingSessions.length > 0) {
                setActiveSessionId(remainingSessions[0].id);
            } else {
                handleNewSession(); 
                // handleNewSession creates a new session and sets it as active,
                // but we need to return the new session array here.
                return []; // This will be overwritten by handleNewSession's effect
            }
        }
        if (remainingSessions.length === 0) {
             localStorage.removeItem('evidenceflowai-sessions');
        }
        return remainingSessions;
    });
  };

  const updateMessageInSession = (sessionId: string, messageUpdater: (messages: Message[]) => Message[]) => {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: messageUpdater(s.messages) } : s));
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
  
    if (!chatSessionRef.current) {
        // This case might happen on first load, ensure session is created
        const currentSession = sessions.find(s => s.id === activeSessionId);
        if (currentSession) {
            chatSessionRef.current = createChatSession(convertMessagesToHistory(currentSession.messages));
        } else {
             setError('No active session found.');
             return;
        }
    }
  
    const userMessage: Message = {
      sender: Sender.User,
      content: content,
      timestamp: new Date().toLocaleTimeString(),
      status: 'complete',
    };
  
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
          const isFirstUserMessage = s.messages.filter(m => m.sender === Sender.User).length === 0;
          return {
              ...s,
              title: isFirstUserMessage ? content.substring(0, 40) : s.title,
              messages: [...s.messages, userMessage]
          };
      }
      return s;
    }));

    setUserInput('');
    setIsLoading(true);
    setError(null);

    const isCommand = content.startsWith('/');
    let loadingMessage: string | undefined = undefined;

    if (isCommand) {
        const commandName = COMMANDS.find(cmd => content.toLowerCase().startsWith(cmd.toLowerCase()));
        if (commandName && commandName.startsWith('/generate')) {
            const docType = commandName.replace('/generate ', '').replace(/\b\w/g, l => l.toUpperCase());
            loadingMessage = `EvidenceFlowAI is generating the **${docType}**...`;
        }
    }
  
    const EvidenceFlowAIResponsePlaceholder: Message = {
        sender: Sender.EvidenceFlowAI,
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        status: 'streaming',
        loadingMessage,
    };
    updateMessageInSession(activeSessionId, prev => [...prev, EvidenceFlowAIResponsePlaceholder]);

    await processStream(content);
  }, [isLoading, activeSessionId, sessions]);

  const handleSendMessage = useCallback(async () => {
    await sendMessage(userInput);
  }, [userInput, sendMessage]);

  const handleRetry = useCallback(async () => {
    if (!activeSessionId) return;
    const messagesBeforeRetry = messages.slice(0, -1).filter(m => m.status !== 'error');
    const lastUserMessage = messagesBeforeRetry.filter(m => m.sender === Sender.User).pop();

    if (!lastUserMessage) return;

    setIsLoading(true);
    setError(null);

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
      if (command.startsWith('/ask') || command.startsWith('/run')) {
          setUserInput(command + ' ');
          // Find the textarea and focus it
          const textarea = document.querySelector('textarea');
          if (textarea) {
            textarea.focus();
          }
      } else {
        sendMessage(command);
      }
  };

  const handleGenerateLearningContent = useCallback(async () => {
    setIsLearningHubLoading(true);
    setLearningHubError(null);
    try {
        const conversationHistory = messages
          .filter(m => m.status === 'complete')
          .map(m => `${m.sender === Sender.User ? 'User' : 'EvidenceFlowAI'}: ${m.content}`)
          .join('\n\n');
        
        if (!conversationHistory) {
            throw new Error("There is no consultation history to analyze yet.");
        }

        const content = await generateLearningContent(conversationHistory);
        setCaseOfTheWeek(content.caseOfTheWeek);
        setCurbsideConsults(content.curbsideConsults);
        setHasNewLearningContent(true);
    } catch (e) {
        setLearningHubError(e instanceof Error ? e.message : "An unknown error occurred during analysis.");
        setCaseOfTheWeek(null);
        setCurbsideConsults([]);
    } finally {
        setIsLearningHubLoading(false);
    }
  }, [messages]);


  return (
    <>
    <LearningHub
        isOpen={isLearningHubOpen}
        onClose={() => setIsLearningHubOpen(false)}
        onGenerate={handleGenerateLearningContent}
        isLoading={isLearningHubLoading}
        error={learningHubError}
        caseOfTheWeek={caseOfTheWeek}
        curbsideConsults={curbsideConsults}
    />
    <div className="h-screen w-screen flex bg-brand-bg text-brand-text-primary font-sans overflow-hidden">
        <Sidebar 
            sessions={sessions}
            activeSessionId={activeSessionId}
            onNewSession={handleNewSession}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            width={sidebarWidth}
        />
        <div 
            className="w-1.5 cursor-col-resize bg-brand-border/50 hover:bg-brand-accent/50 transition-colors flex-shrink-0"
            onMouseDown={handleResizeMouseDown}
        />
        <div className="flex-1 flex flex-col min-w-0">
            <header className="p-4 border-b border-brand-border bg-brand-surface flex-shrink-0 flex justify-between items-center">
                <h1 className="text-xl font-bold flex items-center"><EvidenceFlowAIIcon className="w-6 h-6 mr-3 text-brand-accent"/>Consultation with EvidenceFlowAI</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setIsLearningHubOpen(true);
                            setHasNewLearningContent(false);
                        }}
                        disabled={!activeSession || messages.length === 0}
                        className="relative p-2 rounded-full hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Open Learning Hub"
                    >
                        <BookOpenIcon className="w-6 h-6 text-brand-text-secondary"/>
                        {hasNewLearningContent && (
                            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-brand-accent ring-2 ring-white"></span>
                        )}
                    </button>
                </div>
            </header>
            <main ref={chatContainerRef} className="flex-grow p-6 overflow-y-auto w-full max-w-5xl mx-auto">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-brand-text-secondary p-8">
                <EvidenceFlowAIIcon className="w-24 h-24 mb-6 text-brand-border" />
                <h2 className="text-2xl font-bold text-brand-text-primary mb-2">Begin Your Consultation</h2>
                <p className="max-w-md mb-4">
                    Describe your patient's case to start the conversation.
                </p>
                </div>
            )}
            {messages.map((msg, index) => <MessageBubble key={index} message={msg} onRetry={handleRetry} />)}
            </main>
            <footer className="p-4 border-t border-brand-border bg-brand-surface flex-shrink-0">
                <div className="max-w-5xl mx-auto">
                    {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
                    <>
                    {activeSession && (
                        <div className="flex flex-wrap gap-2 mb-3 justify-center">
                            {COMMANDS.map(cmd => (
                                <button 
                                    key={cmd}
                                    onClick={() => handleCommandClick(cmd)}
                                    disabled={isLoading}
                                    className="px-3 py-1 bg-brand-secondary text-brand-text-secondary text-xs rounded-full hover:bg-gray-200 hover:text-brand-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {cmd}
                                </button>
                            ))}
                        </div>
                    )}
                <div className="flex items-center gap-2 bg-brand-secondary p-2 rounded-lg border border-transparent focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/50">
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
                    className="w-full bg-transparent focus:outline-none p-2 resize-none max-h-40"
                    rows={1}
                    disabled={isLoading}
                    />
                    <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !userInput.trim()}
                    className="p-2 rounded-full bg-brand-accent text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-brand-accent-hover transition-colors self-end"
                    aria-label="Send message"
                    >
                    <SendIcon />
                    </button>
                </div>
                </>
                </div>
            </footer>
        </div>
    </div>
    <Feedback />
    </>
  );
};

export default App;