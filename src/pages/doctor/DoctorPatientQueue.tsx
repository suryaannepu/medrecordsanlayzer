import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Play,
  ArrowUp,
  ArrowDown,
  Loader2,
  User,
  FileText,
  Stethoscope
} from 'lucide-react';

interface PatientVisit {
  id: string;
  student_id: string;
  symptoms: string | null;
  status: string | null;
  risk_score: number | null;
  queue_position: number | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
    blood_group: string | null;
  };
}

const priorityColors = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-warning text-warning-foreground',
  MODERATE: 'bg-primary text-primary-foreground',
  LOW: 'bg-secondary text-secondary-foreground',
  ROUTINE: 'bg-muted text-muted-foreground',
};

const getPriority = (score: number | null) => {
  if (!score) return 'ROUTINE';
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MODERATE';
  if (score >= 30) return 'LOW';
  return 'ROUTINE';
};

export function DoctorPatientQueue() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<PatientVisit | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchVisits();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('patient-visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_visits' },
        () => fetchVisits()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchVisits = async () => {
    try {
      const { data: visitsData, error } = await supabase
        .from('patient_visits')
        .select('*')
        .in('status', ['waiting', 'in_progress'])
        .order('risk_score', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for each visit
      const visitsWithProfiles = await Promise.all(
        (visitsData || []).map(async (visit) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, blood_group')
            .eq('id', visit.student_id)
            .single();
          return { ...visit, profile };
        })
      );

      setVisits(visitsWithProfiles);
    } catch (error) {
      console.error('Error fetching visits:', error);
      toast.error('Failed to load patient queue');
    } finally {
      setLoading(false);
    }
  };

  const handleStartConsultation = async (visit: PatientVisit) => {
    setProcessingId(visit.id);
    try {
      const { error } = await supabase
        .from('patient_visits')
        .update({ status: 'in_progress', doctor_id: user?.id })
        .eq('id', visit.id);

      if (error) throw error;
      toast.success('Consultation started');
      fetchVisits();
    } catch (error) {
      console.error('Error starting consultation:', error);
      toast.error('Failed to start consultation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteConsultation = async (visitId: string) => {
    setProcessingId(visitId);
    try {
      const { error } = await supabase
        .from('patient_visits')
        .update({ status: 'completed' })
        .eq('id', visitId);

      if (error) throw error;
      toast.success('Consultation completed');
      fetchVisits();
    } catch (error) {
      console.error('Error completing consultation:', error);
      toast.error('Failed to complete consultation');
    } finally {
      setProcessingId(null);
    }
  };

  const waitingCount = visits.filter(v => v.status === 'waiting').length;
  const inProgressCount = visits.filter(v => v.status === 'in_progress').length;
  const criticalCount = visits.filter(v => getPriority(v.risk_score) === 'CRITICAL').length;

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
        <h1 className="text-2xl font-bold text-foreground">Patient Queue</h1>
        <p className="text-muted-foreground">AI-prioritized patient management</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold">{waitingCount}</p>
              </div>
              <Users className="h-8 w-8 text-primary/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{inProgressCount}</p>
              </div>
              <Stethoscope className="h-8 w-8 text-accent/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Wait</p>
                <p className="text-2xl font-bold">~15 min</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Queue (Sorted by Priority)
          </CardTitle>
          <CardDescription>
            Patients are automatically sorted by AI risk assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-success/50 mb-4" />
              <p className="text-lg font-medium">No patients waiting</p>
              <p className="text-muted-foreground">The queue is clear</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <AnimatePresence>
                {visits.map((visit, index) => {
                  const priority = getPriority(visit.risk_score);
                  return (
                    <motion.div
                      key={visit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 mb-3 rounded-lg border ${
                        visit.status === 'in_progress' ? 'border-accent bg-accent/5' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            priorityColors[priority as keyof typeof priorityColors]
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {visit.profile?.full_name || 'Unknown Patient'}
                              </h4>
                              <Badge variant={visit.status === 'in_progress' ? 'default' : 'secondary'}>
                                {visit.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {visit.profile?.email}
                            </p>
                            {visit.symptoms && (
                              <p className="text-sm mt-1">
                                <span className="font-medium">Symptoms:</span> {visit.symptoms}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={priorityColors[priority as keyof typeof priorityColors]}>
                                {priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Risk Score: {visit.risk_score || 'N/A'}
                              </span>
                              {visit.profile?.blood_group && (
                                <Badge variant="outline">
                                  {visit.profile.blood_group}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {visit.status === 'waiting' ? (
                            <Button
                              size="sm"
                              onClick={() => handleStartConsultation(visit)}
                              disabled={processingId === visit.id}
                            >
                              {processingId === visit.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Play className="h-4 w-4 mr-1" />
                              )}
                              Start
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCompleteConsultation(visit.id)}
                              disabled={processingId === visit.id}
                            >
                              {processingId === visit.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-1" />
                              )}
                              Complete
                            </Button>
                          )}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  Patient Details - {visit.profile?.full_name}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">Email</label>
                                  <p className="text-muted-foreground">{visit.profile?.email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Blood Group</label>
                                  <p className="text-muted-foreground">{visit.profile?.blood_group || 'Not specified'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Symptoms</label>
                                  <p className="text-muted-foreground">{visit.symptoms || 'Not specified'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Risk Score</label>
                                  <p className="text-muted-foreground">{visit.risk_score} ({priority})</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Registered At</label>
                                  <p className="text-muted-foreground">
                                    {new Date(visit.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}