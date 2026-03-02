import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Send, 
  Image as ImageIcon, 
  Code, 
  MessageSquare, 
  Plus, 
  Trash2, 
  Settings, 
  User, 
  Bot, 
  Loader2,
  ChevronRight,
  Sparkles,
  Terminal,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from './lib/utils';

// --- Types ---

type MessageRole = 'user' | 'assistant';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  type: 'text' | 'image' | 'code';
  imageUrl?: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// --- App Component ---

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mode, setMode] = useState<'chat' | 'image'>('chat');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // --- Initialization ---

  useEffect(() => {
    // Create initial session if none exist
    if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isLoading]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Math.random().toString(36).substring(7),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
      } else {
        createNewSession();
      }
    }
  };

  // --- AI Logic ---

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const handleSend = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      type: 'text',
      timestamp: new Date(),
    };

    // Update session with user message
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const newMessages = [...s.messages, userMessage];
        // Update title if it's the first message
        const title = s.messages.length === 0 ? input.slice(0, 30) + (input.length > 30 ? '...' : '') : s.title;
        return { ...s, messages: newMessages, title };
      }
      return s;
    }));

    const prompt = input;
    setInput('');
    setIsLoading(true);

    try {
      if (mode === 'image') {
        // Image Generation
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: prompt }] },
          config: { imageConfig: { aspectRatio: "1:1" } }
        });

        let imageUrl = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Generated image for: "${prompt}"`,
            type: 'image',
            imageUrl,
            timestamp: new Date(),
          };
          addAssistantMessage(assistantMessage);
        } else {
          throw new Error("No image generated");
        }
      } else {
        // Text Generation
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: prompt,
          config: {
            systemInstruction: "You are Scrapt AI, a highly advanced, helpful, and creative AI assistant. You can answer any question, solve complex problems, write high-quality code in any language, and engage in meaningful conversations. Your tone is professional yet friendly and encouraging. Always prioritize accuracy and clarity.",
          }
        });

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.text || "I'm sorry, I couldn't generate a response.",
          type: 'text',
          timestamp: new Date(),
        };
        addAssistantMessage(assistantMessage);
      }
    } catch (error) {
      console.error("AI Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I encountered an error while processing your request. Please try again.",
        type: 'text',
        timestamp: new Date(),
      };
      addAssistantMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const addAssistantMessage = (msg: Message) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, msg] };
      }
      return s;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Render Helpers ---

  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'image' && msg.imageUrl) {
      return (
        <div className="space-y-4">
          <p className="text-zinc-600 italic">{msg.content}</p>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl overflow-hidden border border-zinc-200 shadow-lg max-w-md"
          >
            <img src={msg.imageUrl} alt="AI Generated" className="w-full h-auto" referrerPolicy="no-referrer" />
          </motion.div>
        </div>
      );
    }

    return (
      <div className="markdown-body prose prose-zinc max-w-none">
        <Markdown
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  className="rounded-xl !bg-zinc-950 !p-4 !my-4"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={cn("bg-zinc-100 px-1.5 py-0.5 rounded text-indigo-600 font-medium", className)} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {msg.content}
        </Markdown>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-white font-sans text-zinc-900 overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-zinc-100 bg-zinc-50 flex flex-col h-full relative z-20"
          >
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
                  <Cpu size={18} />
                </div>
                <span>Scrapt AI</span>
              </div>
              <button 
                onClick={createNewSession}
                className="p-2 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-600"
                title="New Chat"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all group",
                    currentSessionId === session.id 
                      ? "bg-white shadow-sm border border-zinc-200 text-zinc-900" 
                      : "hover:bg-zinc-200/50 text-zinc-500"
                  )}
                >
                  <MessageSquare size={16} className={cn(currentSessionId === session.id ? "text-zinc-900" : "text-zinc-400")} />
                  <span className="truncate flex-1 text-sm font-medium">{session.title}</span>
                  <button 
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-300 rounded transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-200 space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">User Account</p>
                  <p className="text-[10px] text-zinc-500 truncate">shakkajulianto@gmail.com</p>
                </div>
                <Settings size={14} className="text-zinc-400" />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-white">
        {/* Header */}
        <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-6 sticky top-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-500"
            >
              <ChevronRight className={cn("transition-transform", isSidebarOpen && "rotate-180")} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-400">/</span>
              <span className="text-sm font-medium text-zinc-600 truncate max-w-[200px]">
                {currentSession?.title || 'Scrapt AI'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button 
                onClick={() => setMode('chat')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                  mode === 'chat' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <MessageSquare size={14} />
                Chat
              </button>
              <button 
                onClick={() => setMode('image')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2",
                  mode === 'image' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <ImageIcon size={14} />
                Image
              </button>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth"
        >
          {currentSession?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center text-white shadow-2xl"
              >
                <Cpu size={40} />
              </motion.div>
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">How can Scrapt AI help?</h1>
                <p className="text-zinc-500 text-lg">Your intelligent companion for coding, creativity, and knowledge.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  { icon: <Code size={18} />, text: "Write a React component", prompt: "Write a modern React component for a pricing table using Tailwind CSS." },
                  { icon: <Sparkles size={18} />, text: "Explain Quantum Physics", prompt: "Explain quantum entanglement in simple terms for a 10-year old." },
                  { icon: <ImageIcon size={18} />, text: "Generate a futuristic city", prompt: "A futuristic cyberpunk city with neon lights and flying cars, digital art style.", isImage: true },
                  { icon: <Terminal size={18} />, text: "Python script for scraping", prompt: "Write a Python script using BeautifulSoup to scrape news headlines from a website." }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (item.isImage) setMode('image');
                      else setMode('chat');
                      setInput(item.prompt);
                      inputRef.current?.focus();
                    }}
                    className="p-4 border border-zinc-100 rounded-2xl hover:border-zinc-300 hover:bg-zinc-50 transition-all text-left flex items-start gap-3 group"
                  >
                    <div className="p-2 bg-zinc-100 rounded-lg group-hover:bg-white transition-colors">
                      {item.icon}
                    </div>
                    <span className="text-sm font-medium pt-1">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full space-y-10">
              {currentSession?.messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-6",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm",
                    msg.role === 'user' ? "bg-zinc-100 text-zinc-600" : "bg-zinc-900 text-white"
                  )}>
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className={cn(
                    "flex-1 space-y-2",
                    msg.role === 'user' ? "text-right" : "text-left"
                  )}>
                    <div className={cn(
                      "inline-block rounded-3xl px-6 py-4",
                      msg.role === 'user' 
                        ? "bg-zinc-100 text-zinc-800" 
                        : "bg-white border border-zinc-100 shadow-sm"
                    )}>
                      {renderMessageContent(msg)}
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium px-2">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-6"
                >
                  <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                    <Bot size={20} />
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm font-medium">Scrapt AI is thinking...</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-zinc-100 bg-white">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative flex items-end gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-2 focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-100 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'chat' ? "Ask Scrapt AI anything..." : "Describe the image you want to create..."}
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-4 resize-none max-h-40"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-3 rounded-xl transition-all flex-shrink-0",
                  input.trim() && !isLoading 
                    ? "bg-zinc-900 text-white shadow-lg hover:scale-105 active:scale-95" 
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                )}
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Gemini 3.1 Pro
                </div>
                <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[9px]">Enter</kbd>
                  to send
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">
                Scrapt AI can make mistakes. Check important info.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
