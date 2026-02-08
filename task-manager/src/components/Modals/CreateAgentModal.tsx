import { useState, useEffect } from 'react';
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingAgent?: any;
}

const API_URL = 'http://localhost:3001/api';

export function CreateAgentModal({ isOpen, onClose, onSuccess, editingAgent }: CreateAgentModalProps) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('claude');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSubmitting, setIsPosting] = useState(false);

  // Load editing agent data when modal opens
  React.useEffect(() => {
    if (editingAgent) {
      setName(editingAgent.name || '');
      setSystemPrompt(editingAgent.system_prompt || '');
      try {
        const config = JSON.parse(editingAgent.model_config || '{}');
        setProvider(config.provider || 'claude');
      } catch (e) {
        setProvider('claude');
      }
    } else {
      setName('');
      setSystemPrompt('');
      setProvider('claude');
    }
  }, [editingAgent, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPosting(true);

    try {
      const token = localStorage.getItem('token');
      const url = editingAgent
        ? `${API_URL}/agents/${editingAgent.id}`
        : `${API_URL}/agents`;
      const method = editingAgent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          provider,
          system_prompt: systemPrompt,
          model_config: {}
        })
      });

      if (res.ok) {
        toast.success(editingAgent ? 'AI Agent updated successfully' : 'AI Agent created successfully');
        onSuccess();
        onClose();
        setName('');
        setSystemPrompt('');
        setProvider('claude');
      } else {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${editingAgent ? 'update' : 'create'} agent`);
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
                  <Bot className="w-5 h-5 text-primary" />
                  {editingAgent ? 'Edit AI Agent' : 'Define New AI Agent'}
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
                  <label className="block text-sm font-medium text-foreground mb-2">Agent Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Atlas (Tech Lead), QA Bot"
                    required
                    className="bg-secondary border-0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">AI Provider</label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger className="bg-secondary border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude">Claude Code (Anthropic)</SelectItem>
                      <SelectItem value="gemini">Gemini CLI (Google)</SelectItem>
                      <SelectItem value="openai">Codex / GPT-4o (OpenAI)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    Identity (System Prompt)
                  </label>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Describe the agent's personality, rules, and coding style..."
                    rows={5}
                    required
                    className="bg-secondary border-0 resize-none text-sm italic"
                  />
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    This prompt will be injected into every session this agent runs.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
                    {isSubmitting
                      ? (editingAgent ? 'Updating...' : 'Defining...')
                      : (editingAgent ? 'Update Agent' : 'Define Agent')
                    }
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
