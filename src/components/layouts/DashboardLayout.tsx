import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, UserRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Hospital, 
  User, 
  FileText, 
  MessageSquare, 
  Calendar, 
  Bell, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  Pill,
  ClipboardList,
  Radio,
  LayoutDashboard,
  Shield,
  Megaphone,
  MessagesSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const studentNavItems: NavItem[] = [
  { label: 'Profile', icon: <User className="h-5 w-5" />, path: '/student/profile' },
  { label: 'My Medical Records', icon: <FileText className="h-5 w-5" />, path: '/student/records' },
  { label: 'MediAnalyzer', icon: <MessageSquare className="h-5 w-5" />, path: '/student/medianalyzer' },
  { label: 'Appointments', icon: <Calendar className="h-5 w-5" />, path: '/student/appointments' },
  { label: 'Flash News', icon: <Bell className="h-5 w-5" />, path: '/student/news' },
  { label: 'Settings', icon: <Settings className="h-5 w-5" />, path: '/student/settings' },
];

const doctorNavItems: NavItem[] = [
  { label: 'Patient Queue', icon: <ClipboardList className="h-5 w-5" />, path: '/doctor/queue' },
  { label: 'Smart Prescription', icon: <Pill className="h-5 w-5" />, path: '/doctor/prescription' },
  { label: 'Patient Records', icon: <FileText className="h-5 w-5" />, path: '/doctor/records' },
  { label: 'Announcements', icon: <Megaphone className="h-5 w-5" />, path: '/doctor/announcements' },
  { label: 'Active Rooms', icon: <MessagesSquare className="h-5 w-5" />, path: '/doctor/rooms' },
  { label: 'Settings', icon: <Settings className="h-5 w-5" />, path: '/doctor/settings' },
];

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, path: '/admin/dashboard' },
  { label: 'Users', icon: <Users className="h-5 w-5" />, path: '/admin/users' },
  { label: 'Announcements', icon: <Megaphone className="h-5 w-5" />, path: '/admin/announcements' },
  { label: 'Configuration', icon: <Shield className="h-5 w-5" />, path: '/admin/config' },
  { label: 'Settings', icon: <Settings className="h-5 w-5" />, path: '/admin/settings' },
];

function getNavItems(role: UserRole | null): NavItem[] {
  switch (role) {
    case 'doctor':
      return doctorNavItems;
    case 'admin':
      return adminNavItems;
    default:
      return studentNavItems;
  }
}

function getRoleLabel(role: UserRole | null): string {
  switch (role) {
    case 'doctor':
      return 'Doctor Portal';
    case 'admin':
      return 'Admin Portal';
    default:
      return 'Student Portal';
  }
}

export function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const navItems = getNavItems(role);
  const roleLabel = getRoleLabel(role);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-screen sidebar-gradient border-r border-sidebar-border z-50"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sidebar-accent rounded-lg flex-shrink-0">
                <Hospital className="h-6 w-6 text-sidebar-foreground" />
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <h1 className="text-lg font-bold text-sidebar-foreground whitespace-nowrap">
                      University Hospital
                    </h1>
                    <p className="text-xs text-sidebar-foreground/70">{roleLabel}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      'hover:bg-sidebar-accent/50',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                        : 'text-sidebar-foreground/70'
                    )
                  }
                >
                  {item.icon}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              ))}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border">
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-3 px-3"
                >
                  <p className="text-xs text-sidebar-foreground/70 truncate">
                    {user?.email}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="ghost"
              className={cn(
                'w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                isCollapsed ? 'justify-center' : 'justify-start'
              )}
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span className="ml-3">Sign Out</span>}
            </Button>
          </div>

          {/* Collapse Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-8 h-6 w-6 rounded-full bg-sidebar-accent border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/80"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: isCollapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-1 min-h-screen"
      >
        <div className="p-6">
          <Outlet />
        </div>
      </motion.main>
    </div>
  );
}
