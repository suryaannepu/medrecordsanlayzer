import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types for medical records
export interface MedicalRecord {
  id: string;
  text: string;
  documentType: 'blood-report' | 'prescription' | 'scan' | 'receipt';
  date: string;
  fileName: string;
  uploadedAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: {
    documentType: string;
    date: string;
    snippet: string;
  }[];
  timestamp: Date;
}

interface MedicalContextType {
  // API Key management
  apiKey: string;
  setApiKey: (key: string) => void;
  
  // Medical records storage (in-memory)
  records: MedicalRecord[];
  addRecord: (record: Omit<MedicalRecord, 'id' | 'uploadedAt'>) => void;
  removeRecord: (id: string) => void;
  clearRecords: () => void;
  
  // Chat history
  chatHistory: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChatHistory: () => void;
  
  // Loading states
  isProcessingOCR: boolean;
  setIsProcessingOCR: (state: boolean) => void;
  isQueryingLLM: boolean;
  setIsQueryingLLM: (state: boolean) => void;
  ocrProgress: number;
  setOcrProgress: (progress: number) => void;
}

const MedicalContext = createContext<MedicalContextType | undefined>(undefined);

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function MedicalProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [isQueryingLLM, setIsQueryingLLM] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const addRecord = useCallback((record: Omit<MedicalRecord, 'id' | 'uploadedAt'>) => {
    const newRecord: MedicalRecord = {
      ...record,
      id: generateId(),
      uploadedAt: new Date(),
    };
    setRecords(prev => [...prev, newRecord]);
    return newRecord;
  }, []);

  const removeRecord = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const clearRecords = useCallback(() => {
    setRecords([]);
  }, []);

  const addChatMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
  }, []);

  return (
    <MedicalContext.Provider
      value={{
        apiKey,
        setApiKey,
        records,
        addRecord,
        removeRecord,
        clearRecords,
        chatHistory,
        addChatMessage,
        clearChatHistory,
        isProcessingOCR,
        setIsProcessingOCR,
        isQueryingLLM,
        setIsQueryingLLM,
        ocrProgress,
        setOcrProgress,
      }}
    >
      {children}
    </MedicalContext.Provider>
  );
}

export function useMedical() {
  const context = useContext(MedicalContext);
  if (context === undefined) {
    throw new Error('useMedical must be used within a MedicalProvider');
  }
  return context;
}
