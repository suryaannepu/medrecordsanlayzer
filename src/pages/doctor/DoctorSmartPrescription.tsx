import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Sparkles, 
  Loader2,
  Printer,
  Save,
  User,
  Search,
  Check,
  AlertCircle,
  Minus
} from 'lucide-react';

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

interface Patient {
  id: string;
  full_name: string | null;
  email: string | null;
  blood_group: string | null;
}

interface AISuggestion {
  medicine: string;
  suggestions: {
    dosage_options: string[];
    frequency_options: string[];
    duration_options: string[];
    instructions: string[];
    alternatives: Array<{ name: string; note: string }>;
  };
  warnings: string[];
}

const frequencyOptions = [
  { value: 'OD', label: 'Once daily (OD)' },
  { value: 'BD', label: 'Twice daily (BD)' },
  { value: 'TDS', label: 'Three times daily (TDS)' },
  { value: 'QID', label: 'Four times daily (QID)' },
  { value: 'SOS', label: 'As needed (SOS)' },
  { value: 'HS', label: 'At bedtime (HS)' },
];

const commonMedicines = [
  'Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Azithromycin', 'Cetirizine',
  'Omeprazole', 'Metformin', 'Atorvastatin', 'Amlodipine', 'Losartan',
  'Pantoprazole', 'Cefixime', 'Levofloxacin', 'Doxycycline', 'Metronidazole'
];

export function DoctorSmartPrescription() {
  const { user, profile } = useAuth();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMedicineSearch, setShowMedicineSearch] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, blood_group')
        .order('full_name');

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const addMedicine = (name: string = '') => {
    const newMedicine: Medicine = {
      id: crypto.randomUUID(),
      name,
      dosage: '',
      frequency: 'OD',
      duration: '',
      instructions: '',
    };
    setMedicines([...medicines, newMedicine]);
    if (name) {
      setShowMedicineSearch(false);
      fetchAISuggestions(name);
    }
  };

  const updateMedicine = (id: string, field: keyof Medicine, value: string) => {
    setMedicines(medicines.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const removeMedicine = (id: string) => {
    setMedicines(medicines.filter(m => m.id !== id));
  };

  const fetchAISuggestions = async (medicineName: string) => {
    if (!medicineName) return;
    
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-prescription', {
        body: {
          medicineName,
          diagnosis,
          patientAge: null,
          patientWeight: null,
          allergies: [],
        }
      });

      if (error) throw error;
      setAiSuggestion(data);
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const applySuggestion = (medicineId: string, field: keyof Medicine, value: string) => {
    updateMedicine(medicineId, field, value);
    toast.success(`Applied: ${value}`);
  };

  const savePrescription = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    if (medicines.length === 0) {
      toast.error('Please add at least one medicine');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('prescriptions')
        .insert({
          doctor_id: user?.id,
          student_id: selectedPatient.id,
          diagnosis,
          notes,
          medicines: medicines.map(m => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            instructions: m.instructions,
          })),
          hospital_name: 'University Hospital',
        });

      if (error) throw error;
      toast.success('Prescription saved successfully');
      
      // Reset form
      setMedicines([]);
      setDiagnosis('');
      setNotes('');
      setSelectedPatient(null);
    } catch (error) {
      console.error('Error saving prescription:', error);
      toast.error('Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredMedicines = commonMedicines.filter(m =>
    m.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Smart Prescription</h1>
        <p className="text-muted-foreground">AI-assisted prescription writing</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Prescription Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Section */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">University Hospital</CardTitle>
                  <CardDescription>Medical Prescription</CardDescription>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>Date: {new Date().toLocaleDateString()}</p>
                  <p>Dr. {profile?.full_name || 'Doctor'}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Select Patient</Label>
                  <Select
                    value={selectedPatient?.id || ''}
                    onValueChange={(value) => {
                      const patient = patients.find(p => p.id === value);
                      setSelectedPatient(patient || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.full_name || patient.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Diagnosis</Label>
                  <Input
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Enter diagnosis"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medicines Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Medicines
                </CardTitle>
                <Dialog open={showMedicineSearch} onOpenChange={setShowMedicineSearch}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Medicine
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Medicine</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search medicine..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                          onKeyDown={(e) => {
                            if (e.key === 'Tab' && filteredMedicines[0]) {
                              e.preventDefault();
                              addMedicine(filteredMedicines[0]);
                            }
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Press TAB to auto-complete
                      </p>
                      <div className="grid gap-2 max-h-60 overflow-auto">
                        {filteredMedicines.map((medicine) => (
                          <Button
                            key={medicine}
                            variant="outline"
                            className="justify-start"
                            onClick={() => addMedicine(medicine)}
                          >
                            {medicine}
                          </Button>
                        ))}
                        {searchQuery && !filteredMedicines.includes(searchQuery) && (
                          <Button
                            variant="secondary"
                            className="justify-start"
                            onClick={() => addMedicine(searchQuery)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add "{searchQuery}"
                          </Button>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {medicines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No medicines added yet</p>
                  <p className="text-sm">Click "Add Medicine" to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {medicines.map((medicine, index) => (
                    <div key={medicine.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{index + 1}.</span>
                          <h4 className="font-medium">{medicine.name}</h4>
                          <Badge variant="outline" className="bg-success/10 text-success">
                            <Check className="h-3 w-3 mr-1" />
                            Available
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeMedicine(medicine.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div>
                          <Label className="text-xs">Dosage</Label>
                          <Input
                            value={medicine.dosage}
                            onChange={(e) => updateMedicine(medicine.id, 'dosage', e.target.value)}
                            placeholder="e.g., 500mg"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Frequency</Label>
                          <Select
                            value={medicine.frequency}
                            onValueChange={(value) => updateMedicine(medicine.id, 'frequency', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {frequencyOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Duration</Label>
                          <Input
                            value={medicine.duration}
                            onChange={(e) => updateMedicine(medicine.id, 'duration', e.target.value)}
                            placeholder="e.g., 5 days"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Instructions</Label>
                          <Input
                            value={medicine.instructions}
                            onChange={(e) => updateMedicine(medicine.id, 'instructions', e.target.value)}
                            placeholder="e.g., After food"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional instructions or notes..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={savePrescription} disabled={saving} className="flex-1">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Prescription
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* AI Suggestions Panel */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Suggestions
              </CardTitle>
              <CardDescription>
                Dosage and frequency recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAI ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : aiSuggestion ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{aiSuggestion.medicine}</h4>
                    
                    {aiSuggestion.suggestions?.dosage_options && (
                      <div className="mb-3">
                        <Label className="text-xs text-muted-foreground">Suggested Dosages</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aiSuggestion.suggestions.dosage_options.map((d) => (
                            <Badge
                              key={d}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => {
                                const lastMedicine = medicines[medicines.length - 1];
                                if (lastMedicine) applySuggestion(lastMedicine.id, 'dosage', d);
                              }}
                            >
                              {d}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiSuggestion.suggestions?.frequency_options && (
                      <div className="mb-3">
                        <Label className="text-xs text-muted-foreground">Suggested Frequency</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aiSuggestion.suggestions.frequency_options.map((f) => (
                            <Badge
                              key={f}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => {
                                const lastMedicine = medicines[medicines.length - 1];
                                if (lastMedicine) applySuggestion(lastMedicine.id, 'frequency', f);
                              }}
                            >
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiSuggestion.suggestions?.duration_options && (
                      <div className="mb-3">
                        <Label className="text-xs text-muted-foreground">Suggested Duration</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aiSuggestion.suggestions.duration_options.map((d) => (
                            <Badge
                              key={d}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => {
                                const lastMedicine = medicines[medicines.length - 1];
                                if (lastMedicine) applySuggestion(lastMedicine.id, 'duration', d);
                              }}
                            >
                              {d}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiSuggestion.warnings && aiSuggestion.warnings.length > 0 && (
                      <div className="mt-4 p-3 bg-warning/10 rounded-lg">
                        <div className="flex items-center gap-2 text-warning mb-1">
                          <AlertCircle className="h-4 w-4" />
                          <span className="font-medium text-sm">Warnings</span>
                        </div>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {aiSuggestion.warnings.map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Add a medicine to see AI suggestions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}