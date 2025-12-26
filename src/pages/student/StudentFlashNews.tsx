import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Bell, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  Clock,
  Loader2,
  HandHelping,
  Megaphone
} from 'lucide-react';

interface Announcement {
  id: string;
  doctor_id: string;
  title: string;
  message: string;
  urgency: string;
  active: boolean;
  created_at: string;
  response_count?: number;
  has_responded?: boolean;
}

export function StudentFlashNews() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('announcements')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcements',
      }, () => {
        fetchAnnouncements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchAnnouncements = async () => {
    if (!user) return;

    try {
      // Fetch active announcements
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (announcementsError) throw announcementsError;

      // Fetch user's responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('announcement_responses')
        .select('announcement_id')
        .eq('student_id', user.id);

      if (responsesError) throw responsesError;

      const respondedIds = new Set(responsesData?.map(r => r.announcement_id));

      // Fetch response counts for each announcement
      const announcementsWithCounts = await Promise.all(
        (announcementsData || []).map(async (announcement) => {
          const { count } = await supabase
            .from('announcement_responses')
            .select('*', { count: 'exact', head: true })
            .eq('announcement_id', announcement.id);

          return {
            ...announcement,
            response_count: count || 0,
            has_responded: respondedIds.has(announcement.id),
          };
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

  const handleRespond = async (announcementId: string) => {
    if (!user) return;
    setRespondingTo(announcementId);

    try {
      const { error } = await supabase
        .from('announcement_responses')
        .insert({
          announcement_id: announcementId,
          student_id: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.info('You have already responded to this announcement');
        } else {
          throw error;
        }
      } else {
        toast.success('Thank you for responding!');
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error responding:', error);
      toast.error('Failed to respond');
    } finally {
      setRespondingTo(null);
    }
  };

  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return {
          icon: AlertTriangle,
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          badgeVariant: 'destructive' as const,
        };
      case 'important':
        return {
          icon: Bell,
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          badgeVariant: 'secondary' as const,
        };
      default:
        return {
          icon: Info,
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          badgeVariant: 'outline' as const,
        };
    }
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
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Flash News
        </h1>
        <p className="text-muted-foreground">Important announcements from doctors</p>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Announcements</h3>
            <p className="text-muted-foreground">
              There are no active announcements at the moment
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {announcements.map((announcement, index) => {
              const urgencyConfig = getUrgencyConfig(announcement.urgency);
              const UrgencyIcon = urgencyConfig.icon;

              return (
                <motion.div
                  key={announcement.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Card className={`border-l-4 ${
                    announcement.urgency === 'urgent' ? 'border-l-destructive' :
                    announcement.urgency === 'important' ? 'border-l-warning' :
                    'border-l-primary'
                  }`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${urgencyConfig.bgColor}`}>
                            <UrgencyIcon className={`h-5 w-5 ${urgencyConfig.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{announcement.title}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3" />
                              {new Date(announcement.created_at).toLocaleString()}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={urgencyConfig.badgeVariant} className="capitalize">
                          {announcement.urgency}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground mb-4">{announcement.message}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <HandHelping className="h-4 w-4" />
                          <span>{announcement.response_count} students responded</span>
                        </div>
                        
                        {announcement.has_responded ? (
                          <Badge variant="outline" className="text-success border-success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Responded
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => handleRespond(announcement.id)}
                            disabled={respondingTo === announcement.id}
                          >
                            {respondingTo === announcement.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Responding...
                              </>
                            ) : (
                              <>
                                <HandHelping className="h-4 w-4 mr-2" />
                                Respond
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
