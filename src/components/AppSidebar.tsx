import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  MessageSquare, 
  Eye, 
  EyeOff, 
  FileText, 
  Activity,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Shield
} from 'lucide-react';
import { useMedical } from '@/context/MedicalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { apiKey, setApiKey, records } = useMedical();
  const [showApiKey, setShowApiKey] = useState(false);

  const navItems = [
    {
      path: '/upload',
      label: 'Upload Medical Records',
      icon: Upload,
      description: 'OCR & document processing',
    },
    {
      path: '/chat',
      label: 'MediAnalyzer Bot',
      icon: MessageSquare,
      description: 'AI-powered Q&A',
    },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative h-screen sidebar-gradient flex flex-col shadow-lg"
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
            <Stethoscope className="h-5 w-5 text-sidebar-foreground" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="font-bold text-sidebar-foreground text-lg leading-tight">
                  MediAnalyzer
                </h1>
                <p className="text-xs text-sidebar-foreground/70">
                  University Hospital
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* API Key Input */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="p-4 border-b border-sidebar-border"
          >
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-xs font-medium text-sidebar-foreground/80 flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Groq Cloud LLM API Key
              </Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key..."
                  className="pr-10 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 text-sm h-9"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-sidebar-foreground/50">
                Required for AI-powered analysis
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 min-w-0"
                    >
                      <p className="font-medium text-sm truncate">{item.label}</p>
                      <p className="text-[10px] opacity-70 truncate">{item.description}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Records Status */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 border-t border-sidebar-border"
          >
            <div className="flex items-center gap-2 text-sidebar-foreground/70">
              <FileText className="h-4 w-4" />
              <span className="text-xs">
                {records.length} record{records.length !== 1 ? 's' : ''} in memory
              </span>
            </div>
            {records.length > 0 && (
              <div className="mt-2 flex items-center gap-1">
                <Activity className="h-3 w-3 text-green-400" />
                <span className="text-[10px] text-green-400">Ready for analysis</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
