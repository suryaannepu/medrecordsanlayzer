import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  FileText, 
  Calendar,
  Sparkles,
  AlertTriangle,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { useMedical } from '@/context/MedicalContext';
import { queryMedicalBot } from '@/services/llmService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export function ChatPage() {
  const { 
    apiKey, 
    records, 
    chatHistory, 
    addChatMessage, 
    clearChatHistory,
    isQueryingLLM, 
    setIsQueryingLLM 
  } = useMedical();
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!apiKey) {
      toast({
        variant: 'destructive',
        title: 'API Key Required',
        description: 'Please enter your Groq Cloud API key in the sidebar.',
      });
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to chat
    addChatMessage({
      role: 'user',
      content: userMessage,
    });

    setIsQueryingLLM(true);

    try {
      // Query the LLM with medical context
      const response = await queryMedicalBot(apiKey, userMessage, records);

      // Add AI response to chat
      addChatMessage({
        role: 'assistant',
        content: response.answer,
        evidence: response.evidence,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
      
      addChatMessage({
        role: 'assistant',
        content: `I encountered an error: ${errorMessage}. Please check your API key and try again.`,
      });

      toast({
        variant: 'destructive',
        title: 'Query Failed',
        description: errorMessage,
      });
    } finally {
      setIsQueryingLLM(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const exampleQueries = [
    "What were my last blood test results?",
    "What medications have been prescribed to me?",
    "When was my last scan performed?",
    "What is my hemoglobin level?",
  ];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-foreground">MediAnalyzer Bot</h1>
              <p className="text-xs text-muted-foreground">
                {records.length} record{records.length !== 1 ? 's' : ''} available for analysis
              </p>
            </div>
          </div>
          {chatHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearChatHistory}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Chat
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Empty State */}
          {chatHistory.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Ask about your medical records
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    I can only answer questions based on the documents you've uploaded
                  </p>
                </div>
              </div>

              {/* API Key Warning */}
              {!apiKey && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20 max-w-md mx-auto"
                >
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                  <p className="text-sm text-warning">
                    Enter your Groq API key in the sidebar to enable AI analysis
                  </p>
                </motion.div>
              )}

              {/* No Records Warning */}
              {records.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 max-w-md mx-auto"
                >
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Upload medical records first to enable document-grounded Q&A
                  </p>
                </motion.div>
              )}

              {/* Example Queries */}
              <div className="space-y-3 max-w-lg mx-auto">
                <p className="text-sm font-medium text-muted-foreground text-center">
                  Try asking:
                </p>
                <div className="grid gap-2">
                  {exampleQueries.map((query, index) => (
                    <motion.button
                      key={query}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setInputMessage(query)}
                      className="text-left px-4 py-3 rounded-lg bg-secondary/50 hover:bg-secondary text-sm text-foreground transition-colors"
                    >
                      {query}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Chat Messages */}
          <AnimatePresence mode="popLayout">
            {chatHistory.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div className={`max-w-[80%] space-y-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Evidence Section */}
                  {message.evidence && message.evidence.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 mt-2"
                    >
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Source Evidence
                      </p>
                      <div className="space-y-1.5">
                        {message.evidence.map((ev, evIndex) => (
                          <div
                            key={evIndex}
                            className="p-2.5 rounded-md bg-muted/50 border border-border/50 text-xs"
                          >
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <span className="font-medium">{ev.documentType}</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {ev.date}
                              </span>
                            </div>
                            <p className="text-foreground/80 italic">"{ev.snippet}"</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading Indicator */}
          {isQueryingLLM && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="chat-bubble-ai flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analyzing your records<span className="loading-dots"></span></span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-border bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask questions about your medical records..."
                disabled={isQueryingLLM}
                className="pr-12 h-12 text-base"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <MessageSquare className="h-5 w-5 text-muted-foreground/30" />
              </div>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={isQueryingLLM || !inputMessage.trim()}
              size="lg"
              className="h-12 px-6"
            >
              {isQueryingLLM ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Responses are grounded only in your uploaded medical records
          </p>
        </div>
      </div>
    </div>
  );
}
