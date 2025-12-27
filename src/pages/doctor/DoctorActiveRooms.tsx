import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Users, 
  Loader2,
  Send,
  X,
  User,
  FileText,
  Clock
} from 'lucide-react';

interface Room {
  id: string;
  student_id: string;
  doctor_id: string;
  active: boolean | null;
  created_at: string;
  student_profile?: {
    full_name: string | null;
    email: string | null;
  };
}

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export function DoctorActiveRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRooms();

    // Subscribe to room updates
    const channel = supabase
      .channel('rooms-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => fetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);
      
      // Subscribe to messages
      const channel = supabase
        .channel(`room-messages-${selectedRoom.id}`)
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'room_messages',
            filter: `room_id=eq.${selectedRoom.id}`
          },
          (payload) => {
            setMessages(prev => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRooms = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('doctor_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch student profiles
      const roomsWithProfiles = await Promise.all(
        (data || []).map(async (room) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', room.student_id)
            .single();
          return { ...room, student_profile: profile };
        })
      );

      setRooms(roomsWithProfiles);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('room_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom || !user) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('room_messages')
        .insert({
          room_id: selectedRoom.id,
          sender_id: user.id,
          message: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const closeRoom = async (roomId: string) => {
    if (!confirm('Close this chat room?')) return;

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ active: false })
        .eq('id', roomId);

      if (error) throw error;
      toast.success('Room closed');
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null);
        setMessages([]);
      }
      fetchRooms();
    } catch (error) {
      console.error('Error closing room:', error);
      toast.error('Failed to close room');
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
        <h1 className="text-2xl font-bold text-foreground">Active Rooms</h1>
        <p className="text-muted-foreground">Chat with patients who responded to announcements</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 h-[calc(100vh-220px)]">
        {/* Room List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Rooms ({rooms.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rooms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No active rooms</p>
                <p className="text-xs">Rooms are created when students respond to announcements</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedRoom?.id === room.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">
                          {room.student_profile?.full_name || 'Unknown Student'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {room.student_profile?.email}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeRoom(room.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(room.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedRoom ? (
            <>
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedRoom.student_profile?.full_name}
                    </CardTitle>
                    <CardDescription>
                      {selectedRoom.student_profile?.email}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <FileText className="h-4 w-4 mr-1" />
                      View Records
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => closeRoom(selectedRoom.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isDoctor = message.sender_id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isDoctor ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              isDoctor
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm">{message.message}</p>
                            <p className={`text-xs mt-1 ${
                              isDoctor ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button onClick={sendMessage} disabled={sendingMessage}>
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a Room</p>
                <p className="text-sm">Choose a room from the list to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </motion.div>
  );
}