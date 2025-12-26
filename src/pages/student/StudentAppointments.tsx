import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Users, AlertCircle } from 'lucide-react';

export function StudentAppointments() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
        <p className="text-muted-foreground">Manage your medical appointments</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Appointments Scheduled</h3>
          <p className="text-muted-foreground mb-4">
            You don't have any upcoming appointments
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Appointment booking will be available soon</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
