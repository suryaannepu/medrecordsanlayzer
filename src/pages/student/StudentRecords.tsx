import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Upload, 
  FileText, 
  Image, 
  Trash2, 
  Eye, 
  Calendar, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Droplets,
  Pill,
  Scan,
  Receipt
} from 'lucide-react';
import { performOCR } from '@/services/ocrService';
import { extractMedicalData, ExtractedMedicalData } from '@/services/medicalExtractionService';

interface MedicalReport {
  id: string;
  student_id: string;
  file_url: string;
  file_name: string | null;
  document_type: string | null;
  extracted_data: ExtractedMedicalData | null;
  ocr_text: string | null;
  report_date: string | null;
  created_at: string;
}

const documentTypes = [
  { value: 'blood-report', label: 'Blood Report', icon: Droplets },
  { value: 'prescription', label: 'Prescription', icon: Pill },
  { value: 'scan', label: 'Scan/Imaging', icon: Scan },
  { value: 'receipt', label: 'Medical Receipt', icon: Receipt },
];

export function StudentRecords() {
  const { user } = useAuth();
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);

  useEffect(() => {
    fetchReports();
  }, [user]);

  const fetchReports = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('medical_reports')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast the data to our MedicalReport type
      const typedReports = (data || []).map(report => ({
        ...report,
        extracted_data: report.extracted_data as unknown as ExtractedMedicalData | null
      }));
      
      setReports(typedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load medical reports');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;
    
    for (const file of acceptedFiles) {
      setUploading(true);
      setUploadProgress(0);

      try {
        // 1. Upload file to storage
        const fileName = `${user.id}/${Date.now()}_${file.name}`;
        setUploadProgress(10);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('medical-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        setUploadProgress(30);

        // 2. Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('medical-files')
          .getPublicUrl(fileName);

        setUploadProgress(40);

        // 3. Perform OCR
        const ocrResult = await performOCR(file, (progress) => {
          setUploadProgress(40 + progress * 0.4);
        });

        setUploadProgress(80);

        // 4. Extract medical data
        const extractedData = extractMedicalData(ocrResult.text);

        setUploadProgress(90);

        // 5. Save to database
        const { error: dbError } = await supabase
          .from('medical_reports')
          .insert({
            student_id: user.id,
            file_url: publicUrl,
            file_name: file.name,
            document_type: extractedData.document_type,
            extracted_data: JSON.parse(JSON.stringify(extractedData)),
            ocr_text: ocrResult.text,
            report_date: extractedData.report_date,
          });

        if (dbError) throw dbError;

        setUploadProgress(100);
        toast.success(`${file.name} uploaded and analyzed successfully`);
        fetchReports();
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to process ${file.name}`);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  const handleDelete = async (report: MedicalReport) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      // Delete from storage
      const filePath = report.file_url.split('/').slice(-2).join('/');
      await supabase.storage.from('medical-files').remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('medical_reports')
        .delete()
        .eq('id', report.id);

      if (error) throw error;

      toast.success('Report deleted successfully');
      fetchReports();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete report');
    }
  };

  const getDocTypeIcon = (type: string | null) => {
    const docType = documentTypes.find(d => d.value === type);
    return docType ? <docType.icon className="h-5 w-5" /> : <FileText className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Medical Records</h1>
        <p className="text-muted-foreground">Upload and manage your health documents</p>
      </div>

      {/* Upload Zone */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`upload-zone p-8 text-center cursor-pointer ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                <div className="w-full max-w-xs mx-auto">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {uploadProgress < 40 ? 'Uploading...' : uploadProgress < 80 ? 'Analyzing with OCR...' : 'Extracting medical data...'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto text-primary/60 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Upload Medical Records
                </h3>
                <p className="text-muted-foreground mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports JPG, PNG, WebP, PDF
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports Grid */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Records Yet</h3>
            <p className="text-muted-foreground">
              Upload your medical documents to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {reports.map((report, index) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  {/* Preview Image */}
                  <div className="relative h-40 bg-muted">
                    {report.file_url.endsWith('.pdf') ? (
                      <div className="flex items-center justify-center h-full">
                        <FileText className="h-16 w-16 text-muted-foreground/50" />
                      </div>
                    ) : (
                      <img
                        src={report.file_url}
                        alt={report.file_name || 'Medical report'}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <Badge className="absolute top-2 right-2" variant="secondary">
                      {getDocTypeIcon(report.document_type)}
                      <span className="ml-1 capitalize">
                        {report.document_type?.replace('-', ' ') || 'Document'}
                      </span>
                    </Badge>
                  </div>

                  <CardContent className="p-4">
                    <h4 className="font-medium truncate mb-1">{report.file_name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {report.report_date || new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Extracted Data Preview */}
                    {report.extracted_data?.extracted_facts && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {report.extracted_data.extracted_facts.slice(0, 3).map((fact, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {fact.name}: {fact.value}
                          </Badge>
                        ))}
                        {report.extracted_data.extracted_facts.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{report.extracted_data.extracted_facts.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh]">
                          <DialogHeader>
                            <DialogTitle>{report.file_name}</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[70vh]">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                {report.file_url.endsWith('.pdf') ? (
                                  <iframe
                                    src={report.file_url}
                                    className="w-full h-96 rounded border"
                                  />
                                ) : (
                                  <img
                                    src={report.file_url}
                                    alt="Report"
                                    className="w-full rounded border"
                                  />
                                )}
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium mb-2">Extracted Information</h4>
                                  {report.extracted_data?.extracted_facts?.map((fact, i) => (
                                    <div key={i} className="flex items-start gap-2 py-1 border-b last:border-0">
                                      <span className="font-medium text-sm">{fact.name}:</span>
                                      <span className="text-sm">{fact.value} {fact.unit}</span>
                                      <Badge variant={
                                        fact.confidence === 'high' ? 'default' :
                                        fact.confidence === 'medium' ? 'secondary' : 'outline'
                                      } className="ml-auto text-xs">
                                        {fact.confidence}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(report)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
