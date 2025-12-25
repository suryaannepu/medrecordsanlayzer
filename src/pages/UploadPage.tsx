import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileImage, 
  FileText, 
  X, 
  Check, 
  Loader2, 
  Calendar,
  ChevronDown,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useMedical, MedicalRecord } from '@/context/MedicalContext';
import { performOCR, isSupportedFormat } from '@/services/ocrService';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const documentTypes = [
  { value: 'blood-report', label: 'Blood Report', icon: '🩸' },
  { value: 'prescription', label: 'Prescription', icon: '💊' },
  { value: 'scan', label: 'Scan / Imaging', icon: '📷' },
  { value: 'receipt', label: 'Medical Receipt', icon: '🧾' },
] as const;

interface ProcessedFile {
  file: File;
  text: string;
  documentType: MedicalRecord['documentType'];
  date: string;
  isProcessing: boolean;
  progress: number;
  error?: string;
}

export function UploadPage() {
  const { addRecord, isProcessingOCR, setIsProcessingOCR, ocrProgress, setOcrProgress } = useMedical();
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);

  // Handle file drop/selection
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (!isSupportedFormat(file)) {
        toast({
          variant: 'destructive',
          title: 'Unsupported format',
          description: `${file.name} is not a supported image format. Please use JPG or PNG.`,
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Add files to processing queue
    const newFiles: ProcessedFile[] = validFiles.map(file => ({
      file,
      text: '',
      documentType: 'blood-report' as const,
      date: new Date().toISOString().split('T')[0],
      isProcessing: true,
      progress: 0,
    }));

    setProcessedFiles(prev => [...prev, ...newFiles]);
    setActiveFileIndex(processedFiles.length);

    // Process each file with OCR
    for (let i = 0; i < validFiles.length; i++) {
      const fileIndex = processedFiles.length + i;
      const file = validFiles[i];

      setIsProcessingOCR(true);
      
      try {
        const result = await performOCR(file, (progress) => {
          setOcrProgress(progress);
          setProcessedFiles(prev => 
            prev.map((pf, idx) => 
              idx === fileIndex ? { ...pf, progress } : pf
            )
          );
        });

        setProcessedFiles(prev =>
          prev.map((pf, idx) =>
            idx === fileIndex
              ? { ...pf, text: result.text, isProcessing: false, progress: 100 }
              : pf
          )
        );

        toast({
          title: 'OCR Complete',
          description: `Successfully extracted text from ${file.name} (${result.confidence.toFixed(1)}% confidence)`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'OCR failed';
        setProcessedFiles(prev =>
          prev.map((pf, idx) =>
            idx === fileIndex
              ? { ...pf, isProcessing: false, error: errorMessage }
              : pf
          )
        );
        toast({
          variant: 'destructive',
          title: 'OCR Failed',
          description: errorMessage,
        });
      } finally {
        setIsProcessingOCR(false);
        setOcrProgress(0);
      }
    }
  }, [processedFiles.length, setIsProcessingOCR, setOcrProgress]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: true,
    noDrag: false,
  });


  // Update file metadata
  const updateFile = (index: number, updates: Partial<ProcessedFile>) => {
    setProcessedFiles(prev =>
      prev.map((pf, idx) => (idx === index ? { ...pf, ...updates } : pf))
    );
  };

  // Save record to memory
  const saveRecord = (index: number) => {
    const file = processedFiles[index];
    if (!file.text.trim()) {
      toast({
        variant: 'destructive',
        title: 'Cannot save',
        description: 'No text extracted from this document.',
      });
      return;
    }

    addRecord({
      text: file.text,
      documentType: file.documentType,
      date: file.date,
      fileName: file.file.name,
    });

    // Remove from processing list
    setProcessedFiles(prev => prev.filter((_, idx) => idx !== index));
    setActiveFileIndex(null);

    toast({
      title: 'Record Saved',
      description: 'Medical record has been added to memory.',
    });
  };

  // Remove file from list
  const removeFile = (index: number) => {
    setProcessedFiles(prev => prev.filter((_, idx) => idx !== index));
    if (activeFileIndex === index) {
      setActiveFileIndex(null);
    }
  };

  const activeFile = activeFileIndex !== null ? processedFiles[activeFileIndex] : null;

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Upload Medical Records</h1>
          <p className="text-muted-foreground">
            Upload medical documents for OCR text extraction and AI analysis
          </p>
        </div>

        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`upload-zone p-8 lg:p-12 cursor-pointer transition-transform hover:scale-[1.005] active:scale-[0.995] ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <motion.div
              animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
            >
              <Upload className="h-8 w-8 text-primary" />
            </motion.div>
            <div>
              <p className="text-lg font-medium text-foreground">
                {isDragActive ? 'Drop your files here' : 'Drag & drop medical documents'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse • Supports JPG, PNG, WebP
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileImage className="h-4 w-4" />
              <span>Medical reports, prescriptions, lab receipts, scans</span>
            </div>
          </div>
        </div>

        {/* Processing Queue */}
        <AnimatePresence mode="popLayout">
          {processedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Processing Queue ({processedFiles.length})
              </h2>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* File List */}
                <div className="space-y-2">
                  {processedFiles.map((pf, index) => (
                    <motion.div
                      key={pf.file.name + index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onClick={() => !pf.isProcessing && setActiveFileIndex(index)}
                      className={`medical-card p-4 cursor-pointer transition-all ${
                        activeFileIndex === index
                          ? 'ring-2 ring-primary shadow-medical'
                          : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          {pf.isProcessing ? (
                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                          ) : pf.error ? (
                            <AlertCircle className="h-5 w-5 text-destructive" />
                          ) : (
                            <Check className="h-5 w-5 text-success" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {pf.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pf.isProcessing
                              ? `Processing... ${pf.progress}%`
                              : pf.error
                              ? pf.error
                              : `${pf.text.split(/\s+/).length} words extracted`}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {pf.isProcessing && (
                        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pf.progress}%` }}
                            className="h-full bg-primary rounded-full"
                          />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Active File Editor */}
                <AnimatePresence mode="wait">
                  {activeFile && !activeFile.isProcessing && !activeFile.error && (
                    <motion.div
                      key={activeFileIndex}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="medical-card p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Edit Extracted Text
                        </h3>
                      </div>

                      {/* Document Type */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Document Type</Label>
                        <Select
                          value={activeFile.documentType}
                          onValueChange={(value: MedicalRecord['documentType']) =>
                            updateFile(activeFileIndex!, { documentType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <span className="flex items-center gap-2">
                                  <span>{type.icon}</span>
                                  <span>{type.label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Report Date */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Report Date
                        </Label>
                        <Input
                          type="date"
                          value={activeFile.date}
                          onChange={(e) =>
                            updateFile(activeFileIndex!, { date: e.target.value })
                          }
                        />
                      </div>

                      {/* Extracted Text */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Extracted Text (Editable)</Label>
                        <Textarea
                          value={activeFile.text}
                          onChange={(e) =>
                            updateFile(activeFileIndex!, { text: e.target.value })
                          }
                          rows={8}
                          className="font-mono text-sm resize-none"
                          placeholder="OCR extracted text will appear here..."
                        />
                      </div>

                      {/* Save Button */}
                      <Button
                        onClick={() => saveRecord(activeFileIndex!)}
                        className="w-full"
                        size="lg"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Save to Medical Records
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {processedFiles.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-muted-foreground"
          >
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No documents uploaded yet</p>
            <p className="text-sm">Upload medical documents to begin OCR extraction</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
