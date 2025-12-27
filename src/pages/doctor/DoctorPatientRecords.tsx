import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Search, 
  FileText, 
  User, 
  Loader2,
  Eye,
  Calendar,
  Droplets,
  Mail
} from 'lucide-react';

interface Patient {
  id: string;
  full_name: string | null;
  email: string | null;
  blood_group: string | null;
  date_of_birth: string | null;
  phone: string | null;
  reports_count?: number;
}

interface MedicalReport {
  id: string;
  file_url: string;
  file_name: string | null;
  document_type: string | null;
  extracted_data: any;
  report_date: string | null;
  created_at: string;
}

export function DoctorPatientRecords() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientReports, setPatientReports] = useState<MedicalReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      // Get profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (error) throw error;

      // Get report counts for each patient
      const patientsWithCounts = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count } = await supabase
            .from('medical_reports')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', profile.id);
          return { ...profile, reports_count: count || 0 };
        })
      );

      setPatients(patientsWithCounts);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientReports = async (patientId: string) => {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('medical_reports')
        .select('*')
        .eq('student_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatientReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load patient reports');
    } finally {
      setLoadingReports(false);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    fetchPatientReports(patient.id);
  };

  const filteredPatients = patients.filter(patient =>
    patient.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h1 className="text-2xl font-bold text-foreground">Patient Records</h1>
        <p className="text-muted-foreground">View and analyze patient medical histories</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patients
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {filteredPatients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No patients found</p>
                </div>
              ) : (
                filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedPatient?.id === patient.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                    }`}
                    onClick={() => handleSelectPatient(patient)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{patient.full_name || 'Unnamed'}</h4>
                        <p className="text-sm text-muted-foreground">{patient.email}</p>
                      </div>
                      <div className="text-right">
                        {patient.blood_group && (
                          <Badge variant="outline" className="mb-1">
                            <Droplets className="h-3 w-3 mr-1" />
                            {patient.blood_group}
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {patient.reports_count} reports
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Patient Details & Reports */}
        <Card className="lg:col-span-2">
          {selectedPatient ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedPatient.full_name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {selectedPatient.email}
                      </span>
                      {selectedPatient.blood_group && (
                        <Badge variant="secondary">
                          <Droplets className="h-3 w-3 mr-1" />
                          {selectedPatient.blood_group}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Medical Reports ({patientReports.length})
                </h4>
                
                {loadingReports ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : patientReports.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No medical reports found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {patientReports.map((report) => (
                        <div key={report.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-medium">{report.file_name}</h5>
                                <Badge variant="outline" className="capitalize">
                                  {report.document_type?.replace('-', ' ') || 'Document'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="h-3 w-3" />
                                {report.report_date || new Date(report.created_at).toLocaleDateString()}
                              </p>
                              {report.extracted_data?.extracted_facts && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {report.extracted_data.extracted_facts.slice(0, 4).map((fact: any, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {fact.name}: {fact.value}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4" />
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
                                        {report.extracted_data?.extracted_facts?.map((fact: any, i: number) => (
                                          <div key={i} className="flex items-start gap-2 py-1 border-b last:border-0">
                                            <span className="font-medium text-sm">{fact.name}:</span>
                                            <span className="text-sm">{fact.value} {fact.unit}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </ScrollArea>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a Patient</p>
                <p className="text-sm">Choose a patient from the list to view their records</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </motion.div>
  );
}