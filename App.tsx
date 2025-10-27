
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sender, type Message, type ChatSession } from './types';
import { COMMANDS } from './constants';
import { createChatSession, sendMessageStream } from './services/geminiService';
import { DrGopalanIcon, UserIcon, SendIcon, LoadingIcon, CopyIcon, CheckIcon } from './components/icons';

// Helper component defined outside the main App component to prevent re-creation on re-renders.
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

  return (
    <div className={`flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-text-secondary flex items-center justify-center"><DrGopalanIcon className="w-5 h-5 text-white" /></div>}
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
                  <span>Dr. Gopalan is thinking...</span>
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

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const chatSessionRef = useRef<ChatSession>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setUserInput('');
    setIsLoading(false);
    setError(null);
    setIsSessionStarted(false);
    chatSessionRef.current = null;
  }, []);

  const processStream = useCallback(async (prompt: string, conversationHistory: string) => {
    if (!chatSessionRef.current) return;
    try {
      const stream = await sendMessageStream(chatSessionRef.current, prompt, conversationHistory);
      let responseText = '';
      for await (const chunk of stream) {
        responseText += chunk.text;
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage?.sender === Sender.DrGopalan) {
              newMessages[newMessages.length - 1] = { ...lastMessage, content: responseText };
            }
            return newMessages;
        });
      }
      setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.sender === Sender.DrGopalan) {
            newMessages[newMessages.length - 1] = { ...lastMessage, status: 'complete' };
          }
          return newMessages;
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(errorMessage);
      setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.sender === Sender.DrGopalan) {
            newMessages[newMessages.length - 1] = { 
               ...lastMessage, 
               status: 'error', 
               content: `*(Dr. Gopalan apologizes. An error occurred. Please try again.)*\n\n**Error:** ${errorMessage}` 
            };
          }
          return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;
  
    let session = chatSessionRef.current;
  
    if (!session) {
      try {
        session = createChatSession();
        chatSessionRef.current = session;
        setIsSessionStarted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create session.');
        return;
      }
    }
  
    const userMessage: Message = {
      sender: Sender.User,
      content: messageContent,
      timestamp: new Date().toLocaleTimeString(),
      status: 'complete',
    };

    const conversationHistory = messages
      .map(m => `${m.sender === Sender.User ? 'User' : 'Dr. Gopalan'}: ${m.content}`)
      .join('\n\n');
  
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setError(null);

    const isCommand = messageContent.trim().startsWith('/');
    let loadingMessage: string | undefined = undefined;

    if (isCommand) {
        const commandName = COMMANDS.find(cmd => messageContent.trim().toLowerCase().startsWith(cmd.toLowerCase()));
        if (commandName) {
            // e.g. /generate assessment and plan -> Assessment And Plan
            const docType = commandName.replace('/generate ', '').replace(/\b\w/g, l => l.toUpperCase());
            loadingMessage = `Dr. Gopalan is generating the **${docType}**...`;
        } else {
            // A fallback for any other potential slash commands
            loadingMessage = `Dr. Gopalan is processing your command...`;
        }
    }
  
    const drGopalanResponsePlaceholder: Message = {
        sender: Sender.DrGopalan,
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        status: 'streaming',
        loadingMessage,
    };
    setMessages(prev => [...prev, drGopalanResponsePlaceholder]);

    await processStream(messageContent, conversationHistory);
  }, [isLoading, messages, processStream]);

  const handleSendMessage = useCallback(async () => {
    await sendMessage(userInput);
  }, [userInput, sendMessage]);

  const handleRetry = useCallback(async () => {
    const messagesBeforeRetry = messages.slice(0, -2);
    const lastUserMessage = messages.filter(m => m.sender === Sender.User).pop();

    if (!lastUserMessage) return;

    setIsLoading(true);
    setError(null);

    const conversationHistory = messagesBeforeRetry
        .map(m => `${m.sender === Sender.User ? 'User' : 'Dr. Gopalan'}: ${m.content}`)
        .join('\n\n');

    setMessages(prev => {
      const newMessages = prev.slice(0, -1);
      
      const isCommand = lastUserMessage.content.trim().startsWith('/');
      let loadingMessage: string | undefined = undefined;

      if (isCommand) {
          const commandName = COMMANDS.find(cmd => lastUserMessage.content.trim().toLowerCase().startsWith(cmd.toLowerCase()));
          if (commandName) {
              const docType = commandName.replace('/generate ', '').replace(/\b\w/g, l => l.toUpperCase());
              loadingMessage = `Dr. Gopalan is generating the **${docType}**...`;
          } else {
              loadingMessage = `Dr. Gopalan is processing your command...`;
          }
      }

      newMessages.push({
        sender: Sender.DrGopalan,
        content: '',
        status: 'streaming',
        timestamp: new Date().toLocaleTimeString(),
        loadingMessage,
      });
      return newMessages;
    });

    await processStream(lastUserMessage.content, conversationHistory);
  }, [messages, processStream]);


  const handleCommandClick = (command: string) => {
      sendMessage(command);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-brand-bg text-brand-text-primary font-sans overflow-hidden">
        <header className="p-4 border-b border-brand-border bg-brand-surface flex-shrink-0 flex justify-between items-center">
             <h1 className="text-xl font-bold flex items-center"><DrGopalanIcon className="w-6 h-6 mr-3 text-brand-accent"/>Consultation with Dr. Gopalan</h1>
             <button
              onClick={handleNewChat}
              className="px-3 py-1.5 bg-brand-secondary text-brand-text-primary font-semibold rounded-lg text-sm hover:bg-brand-border disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              aria-label="Start new consultation"
          >
              New Chat
          </button>
        </header>
        <main ref={chatContainerRef} className="flex-grow p-6 overflow-y-auto w-full max-w-5xl mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-brand-text-secondary p-8">
              <DrGopalanIcon className="w-24 h-24 mb-6 text-brand-border" />
              <h2 className="text-2xl font-bold text-brand-text-primary mb-2">Begin Your Consultation</h2>
              <p className="max-w-md">
                Describe your patient's case to start the conversation with Dr. Gopalan. You can provide the HPI, vitals, labs, and your initial thoughts.
              </p>
            </div>
          )}
          {messages.map((msg, index) => <MessageBubble key={index} message={msg} onRetry={handleRetry} />)}
        </main>
        <footer className="p-4 border-t border-brand-border bg-brand-surface flex-shrink-0">
            <div className="max-w-5xl mx-auto">
                {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
                {isSessionStarted && (
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
                  placeholder={isSessionStarted ? "Ask a follow-up, provide an update, or use a command..." : "Describe your patient to begin..."}
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
            </div>
        </footer>
    </div>
  );
};

export default App;