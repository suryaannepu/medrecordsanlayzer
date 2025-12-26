import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Image as ImageIcon, 
  FileText,
  Sparkles,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { ExtractedMedicalData } from '@/services/medicalExtractionService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: {
    reportId: string;
    fileName: string;
    fileUrl: string;
    snippet: string;
  }[];
  timestamp: Date;
}

interface MedicalReport {
  id: string;
  file_url: string;
  file_name: string;
  extracted_data: ExtractedMedicalData | null;
  ocr_text: string | null;
}

export function StudentMediAnalyzer() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReports();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchReports = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('medical_reports')
      .select('id, file_url, file_name, extracted_data, ocr_text')
      .eq('student_id', user.id);

    if (!error && data) {
      setReports(data.map(r => ({
        ...r,
        extracted_data: r.extracted_data as unknown as ExtractedMedicalData | null
      })));
    }
  };

  const buildContext = () => {
    if (reports.length === 0) return '';

    return reports.map((report, i) => {
      const extractedInfo = report.extracted_data?.extracted_facts
        ?.map(f => `${f.name}: ${f.value} ${f.unit || ''}`)
        .join('\n') || '';
      
      return `--- DOCUMENT ${i + 1}: ${report.file_name} ---
${report.ocr_text || ''}

Extracted Facts:
${extractedInfo}
--- END DOCUMENT ${i + 1} ---`;
    }).join('\n\n');
  };

  const findEvidence = (query: string, answer: string): ChatMessage['evidence'] => {
    const evidence: ChatMessage['evidence'] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);
    const answerTerms = answer.toLowerCase().split(/\s+/);
    const allTerms = [...new Set([...queryTerms, ...answerTerms])];

    for (const report of reports) {
      if (!report.ocr_text) continue;
      
      const lines = report.ocr_text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        const isRelevant = allTerms.some(term => term.length > 3 && lineLower.includes(term));
        
        if (isRelevant && line.trim().length > 10) {
          evidence.push({
            reportId: report.id,
            fileName: report.file_name || 'Document',
            fileUrl: report.file_url,
            snippet: line.trim().substring(0, 150),
          });
          if (evidence.length >= 3) break;
        }
      }
      if (evidence.length >= 3) break;
    }

    return evidence;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    if (reports.length === 0) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'No medical records have been uploaded yet. Please upload your medical documents first using the "My Medical Records" page.',
        timestamp: new Date(),
      }]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('analyze-medical', {
        body: {
          query: userMessage.content,
          context: buildContext(),
        },
      });

      if (error) throw error;

      const answer = data?.answer || 'Not found in your medical records.';
      const evidence = findEvidence(userMessage.content, answer);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: answer,
        evidence,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('MediAnalyzer error:', error);
      toast.error('Failed to analyze. Please try again.');
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error analyzing your records. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const exampleQueries = [
    "What is my blood group?",
    "What medications have I been prescribed?",
    "What are my latest blood test results?",
    "Do I have any allergies documented?",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-[calc(100vh-120px)] flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            MediAnalyzer
          </h1>
          <p className="text-muted-foreground">Ask questions about your medical records</p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearChat}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        )}
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Bot className="h-16 w-16 text-primary/30 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Welcome to MediAnalyzer</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Ask any question about your uploaded medical records. I'll find answers 
                only from your documents and show you the proof.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {exampleQueries.map((query, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(query)}
                    className="text-sm"
                  >
                    {query}
                  </Button>
                ))}
              </div>
              {reports.length === 0 && (
                <div className="mt-6 p-4 bg-warning/10 rounded-lg flex items-center gap-3 text-warning">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">No medical records uploaded yet</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                      <div className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      
                      {/* Evidence */}
                      {message.evidence && message.evidence.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Sources:</p>
                          {message.evidence.map((ev, i) => (
                            <Dialog key={i}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs">
                                  <ImageIcon className="h-3 w-3 mr-1" />
                                  {ev.fileName}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>{ev.fileName}</DialogTitle>
                                </DialogHeader>
                                <img src={ev.fileUrl} alt="Evidence" className="w-full rounded" />
                                <p className="text-sm bg-muted p-2 rounded">{ev.snippet}</p>
                              </DialogContent>
                            </Dialog>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-accent-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="chat-bubble-ai flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing your records...</span>
                  </div>
                </motion.div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <CardContent className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your medical records..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            MediAnalyzer only answers from your uploaded medical records
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
