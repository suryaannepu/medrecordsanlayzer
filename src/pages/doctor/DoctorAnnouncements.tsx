import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Megaphone, 
  Plus, 
  Users, 
  Loader2,
  AlertTriangle,
  Bell,
  Clock,
  MessageSquare,
  Trash2,
  Edit
} from 'lucide-react';

interface Announcement {
  id: string;
  doctor_id: string;
  title: string;
  message: string;
  urgency: string | null;
  active: boolean | null;
  created_at: string;
  responses_count?: number;
}

const urgencyColors = {
  normal: 'bg-secondary text-secondary-foreground',
  important: 'bg-warning text-warning-foreground',
  urgent: 'bg-destructive text-destructive-foreground',
};

export function DoctorAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    message: '',
    urgency: 'normal',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAnnouncements();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('announcements-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => fetchAnnouncements()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcement_responses' },
        () => fetchAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get response counts
      const announcementsWithCounts = await Promise.all(
        (data || []).map(async (announcement) => {
          const { count } = await supabase
            .from('announcement_responses')
            .select('*', { count: 'exact', head: true })
            .eq('announcement_id', announcement.id);
          return { ...announcement, responses_count: count || 0 };
        })
      );

      setAnnouncements(announcementsWithCounts);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          doctor_id: user?.id,
          title: newAnnouncement.title,
          message: newAnnouncement.message,
          urgency: newAnnouncement.urgency,
          active: true,
        });

      if (error) throw error;

      toast.success('Announcement created');
      setShowCreateDialog(false);
      setNewAnnouncement({ title: '', message: '', urgency: 'normal' });
      fetchAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error('Failed to create announcement');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentActive ? 'Announcement deactivated' : 'Announcement activated');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling announcement:', error);
      toast.error('Failed to update announcement');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Announcement deleted');
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const activeCount = announcements.filter(a => a.active).length;
  const totalResponses = announcements.reduce((sum, a) => sum + (a.responses_count || 0), 0);

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flash News</h1>
          <p className="text-muted-foreground">Broadcast important announcements to students</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  placeholder="e.g., Urgent: O+ Blood Donation Needed"
                />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  value={newAnnouncement.message}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                  placeholder="Provide details about the announcement..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Urgency Level</Label>
                <Select
                  value={newAnnouncement.urgency}
                  onValueChange={(value) => setNewAnnouncement({ ...newAnnouncement, urgency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createAnnouncement} disabled={creating} className="w-full">
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Megaphone className="h-4 w-4 mr-2" />
                )}
                Publish Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
              <Bell className="h-8 w-8 text-primary/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Announcements</p>
                <p className="text-2xl font-bold">{announcements.length}</p>
              </div>
              <Megaphone className="h-8 w-8 text-accent/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Responses</p>
                <p className="text-2xl font-bold">{totalResponses}</p>
              </div>
              <Users className="h-8 w-8 text-success/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            All Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No Announcements Yet</p>
              <p className="text-sm">Create your first announcement to reach students</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <AnimatePresence>
                {announcements.map((announcement, index) => (
                  <motion.div
                    key={announcement.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 mb-3 rounded-lg border ${
                      announcement.active ? 'border-border' : 'border-muted bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{announcement.title}</h4>
                          <Badge className={urgencyColors[announcement.urgency as keyof typeof urgencyColors] || urgencyColors.normal}>
                            {announcement.urgency === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {announcement.urgency}
                          </Badge>
                          {!announcement.active && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {announcement.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(announcement.created_at).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1 text-success">
                            <Users className="h-3 w-3" />
                            {announcement.responses_count} responses
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`active-${announcement.id}`} className="text-xs">
                            Active
                          </Label>
                          <Switch
                            id={`active-${announcement.id}`}
                            checked={announcement.active || false}
                            onCheckedChange={() => toggleActive(announcement.id, announcement.active || false)}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteAnnouncement(announcement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}