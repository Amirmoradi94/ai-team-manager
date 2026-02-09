import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Bot, Brain, Cpu, Shield, Edit3, Target, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { capitalize } from '@/lib/utils';

interface TeamDetailModalProps {
  team: any | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (team: any) => void;
}

export function TeamDetailModal({ team, isOpen, onClose, onEdit }: TeamDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'hierarchy'>('overview');

  if (!team) return null;

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
            className="relative w-full max-w-3xl z-10"
            onClick={(e) => e.stopPropagation()}
          >
                        <div className="glass-card-dark glow-border max-h-[90vh] overflow-hidden flex flex-col">
                          {/* Header */}
                          <div className="pt-10 pb-6 px-6 border-b border-border flex items-center justify-between bg-primary/5">                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{capitalize(team.name)}</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      {team.human_in_the_loop === 1 ? (
                        <span className="flex items-center gap-1 text-warning font-medium">
                          <Shield className="w-3.5 h-3.5" /> Human Approval Mode
                        </span>
                      ) : (
                        <span className="text-success font-medium">Autonomous Mode</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(team)} className="gap-2">
                    <Edit3 className="w-4 h-4" /> Edit Team
                  </Button>
                  <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-border px-6">
                <div className="flex gap-6">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`pt-4 pb-4 px-1 border-b-2 transition-all font-medium text-sm flex items-center gap-2 ${
                      activeTab === 'overview'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Target className="w-4 h-4" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('hierarchy')}
                    className={`pt-4 pb-4 px-1 border-b-2 transition-all font-medium text-sm flex items-center gap-2 ${
                      activeTab === 'hierarchy'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Network className="w-4 h-4" />
                    Team Hierarchy
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'overview' ? (
                  <div className="space-y-8">
                    {/* Mission Section */}
                    <section className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Mission Statement
                      </h3>
                      <div className="p-5 rounded-xl bg-secondary/30 border border-border italic text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        <ReactMarkdown>{team.mission_statement || 'No mission statement defined.'}</ReactMarkdown>
                      </div>
                    </section>

                    {/* Team Lead Section */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-3 border-b border-border pb-2">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <Bot className="w-5 h-5 text-primary" />
                          Team Lead: {team.lead?.name ? capitalize(team.lead.name) : 'Unassigned'}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase tracking-widest text-primary/60">Core Identity & Prompt</p>
                          <div className="p-4 rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] text-green-400/80 max-h-60 overflow-y-auto">
                            <pre className="whitespace-pre-wrap">{team.lead?.system_prompt}</pre>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Team Roles Section */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
                        <Cpu className="w-5 h-5 text-primary" />
                        Team Roles ({team.specialists?.length || 0})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {team.specialists?.map((spec: any) => (
                          <div key={spec.id} className="p-4 rounded-xl border border-border bg-secondary/20 hover:border-primary/30 transition-colors group">
                            <h4 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{capitalize(spec.name)}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2 italic">"{spec.description}"</p>
                            <div className="mt-3 flex flex-wrap gap-1">
                              {(() => {
                                try {
                                  return JSON.parse(spec.tools || '[]').map((tool: string) => (
                                    <span key={tool} className="px-1.5 py-0.5 rounded bg-black/30 text-[9px] text-primary/70 border border-primary/10">
                                      {tool}
                                    </span>
                                  ));
                                } catch (e) { return null; }
                              })()}
                            </div>
                          </div>
                        ))}
                        {(!team.specialists || team.specialists.length === 0) && (
                          <p className="text-sm text-muted-foreground italic">No roles assigned to this team yet.</p>
                        )}
                      </div>
                    </section>
                  </div>
                ) : (
                  // Hierarchy View
                  <div className="flex flex-col items-center py-8">
                    <h3 className="text-xl font-semibold text-foreground mb-12 flex items-center gap-2">
                      <Network className="w-6 h-6 text-primary" />
                      Team Organization Structure
                    </h3>

                    <div className="relative w-full max-w-4xl">
                      {/* Team Lead */}
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center mb-16"
                      >
                        <div className="relative">
                          <div className="px-8 py-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-2 border-primary shadow-2xl shadow-primary/20">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                                <Bot className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-primary/60 font-bold">Team Lead</p>
                                <h4 className="text-lg font-bold text-foreground">{team.lead?.name ? capitalize(team.lead.name) : 'Unassigned'}</h4>
                              </div>
                            </div>
                          </div>

                          {/* Vertical connector line */}
                          {team.specialists && team.specialists.length > 0 && (
                            <div className="absolute left-1/2 top-full w-0.5 h-12 bg-gradient-to-b from-primary/50 to-transparent transform -translate-x-1/2" />
                          )}
                        </div>
                      </motion.div>

                      {/* Team Roles */}
                      {team.specialists && team.specialists.length > 0 ? (
                        <div className="relative">
                          {/* Horizontal connector line */}
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                          {/* Roles Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8">
                            {team.specialists.map((spec: any, index: number) => (
                              <motion.div
                                key={spec.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative"
                              >
                                {/* Vertical connector to horizontal line */}
                                <div className="absolute left-1/2 -top-8 w-0.5 h-8 bg-gradient-to-b from-primary/30 to-transparent transform -translate-x-1/2" />

                                <div className="px-4 py-4 rounded-xl bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent border border-cyan-400/30 hover:border-cyan-400/60 transition-all hover:shadow-lg hover:shadow-cyan-500/10 group">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/30 transition-colors">
                                      <Cpu className="w-3.5 h-3.5" />
                                    </div>
                                    <h4 className="text-sm font-bold text-foreground group-hover:text-cyan-400 transition-colors line-clamp-2">{capitalize(spec.name)}</h4>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{spec.description}</p>

                                  {/* Tool count badge */}
                                  {(() => {
                                    try {
                                      const tools = JSON.parse(spec.tools || '[]');
                                      if (tools.length > 0) {
                                        return (
                                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20">
                                            <Brain className="w-2.5 h-2.5 text-cyan-400" />
                                            <span className="text-[9px] text-cyan-400 font-medium">{tools.length} tools</span>
                                          </div>
                                        );
                                      }
                                    } catch (e) {}
                                    return null;
                                  })()}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-muted-foreground italic">No roles assigned to this team yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
