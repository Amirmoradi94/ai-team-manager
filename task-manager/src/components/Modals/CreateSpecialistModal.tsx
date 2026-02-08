import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface CreateSpecialistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_TOOLS = [
  { id: 'file_edit', label: 'File Editing' },
  { id: 'terminal', label: 'Terminal / Shell' },
  { id: 'browser', label: 'Web Browser' },
  { id: 'git', label: 'Git Operations' },
  { id: 'npm_install', label: 'Package Management' }
];

const API_URL = 'http://localhost:3001/api';

export function CreateSpecialistModal({ isOpen, onClose, onSuccess }: CreateSpecialistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>(['file_edit', 'terminal']);
  const [isSubmitting, setIsPosting] = useState(false);

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPosting(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/specialists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          system_prompt: systemPrompt,
          tools: selectedTools
        })
      });

      if (res.ok) {
        toast.success('Specialist defined successfully');
        onSuccess();
        onClose();
        setName('');
        setDescription('');
        setSystemPrompt('');
        setSelectedTools(['file_edit', 'terminal']);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create specialist');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-card-dark p-6 glow-border">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" />
                  Define Domain Specialist
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Specialist Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. React Expert, SQL Optimizer"
                    required
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Brief Description</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is their primary role?"
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Specialist Instructions</label>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Provide specific instructions for this sub-agent persona..."
                    rows={4}
                    required
                    className="bg-secondary border-0 resize-none text-sm italic"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary" />
                    Allowed Capabilities
                  </label>
                  <div className="grid grid-cols-2 gap-3 bg-secondary/30 p-4 rounded-lg">
                    {AVAILABLE_TOOLS.map(tool => (
                      <div key={tool.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={tool.id} 
                          checked={selectedTools.includes(tool.id)}
                          onCheckedChange={() => toggleTool(tool.id)}
                        />
                        <label htmlFor={tool.id} className="text-xs text-muted-foreground cursor-pointer select-none font-medium">
                          {tool.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
                    {isSubmitting ? 'Defining...' : 'Define Specialist'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
