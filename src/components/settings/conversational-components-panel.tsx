'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  MessageSquare,
  Slash,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ConversationalComponent, ConversationalComponentType } from '@/types';
import {
  validateIceBreaker,
  validateCommandName,
  validateCommandDescription,
  syncConversationalComponents,
  buildConversationalPayload,
} from '@/lib/whatsapp/conversational-api';

interface EditingComponent {
  id?: string;
  name: string;
  description?: string;
  isNew?: boolean;
}

interface ConversationalComponentsPanelProps {
  phoneNumberId: string;
  accessToken: string;
}

export function ConversationalComponentsPanel({
  phoneNumberId,
  accessToken,
}: ConversationalComponentsPanelProps) {
  const supabase = createClient();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [iceBreakers, setIceBreakers] = useState<ConversationalComponent[]>([]);
  const [commands, setCommands] = useState<ConversationalComponent[]>([]);
  const [editingIceBreaker, setEditingIceBreaker] = useState<EditingComponent | null>(null);
  const [editingCommand, setEditingCommand] = useState<EditingComponent | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'failed' | null>(null);
  const [syncError, setSyncError] = useState<string>('');

  const fetchComponents = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversational_components')
        .select('*')
        .eq('user_id', user.id)
        .eq('phone_number_id', phoneNumberId)
        .order('position', { ascending: true });

      if (error) throw error;

      const ice = (data || []).filter((c) => c.type === 'ice_breaker');
      const cmds = (data || []).filter((c) => c.type === 'command');

      setIceBreakers(ice);
      setCommands(cmds);
      setSyncStatus('synced');
      setSyncError('');
    } catch (error) {
      console.error('Failed to fetch components:', error);
      toast.error('Failed to load components');
    } finally {
      setLoading(false);
    }
  }, [user?.id, phoneNumberId, supabase]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const handleSaveIceBreaker = async () => {
    if (!editingIceBreaker || !user?.id) return;

    const validation = validateIceBreaker(editingIceBreaker.name);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid ice breaker');
      return;
    }

    try {
      if (editingIceBreaker.isNew) {
        const { error } = await supabase
          .from('conversational_components')
          .insert([
            {
              user_id: user.id,
              phone_number_id: phoneNumberId,
              type: 'ice_breaker',
              name: editingIceBreaker.name,
              position: iceBreakers.length,
              status: 'active',
            },
          ]);

        if (error) throw error;
        toast.success('Ice breaker added');
      } else {
        const { error } = await supabase
          .from('conversational_components')
          .update({ name: editingIceBreaker.name })
          .eq('id', editingIceBreaker.id);

        if (error) throw error;
        toast.success('Ice breaker updated');
      }

      setSyncStatus('pending');
      setEditingIceBreaker(null);
      fetchComponents();
    } catch (error) {
      console.error('Failed to save ice breaker:', error);
      toast.error('Failed to save ice breaker');
    }
  };

  const handleSaveCommand = async () => {
    if (!editingCommand || !user?.id) return;

    const nameValidation = validateCommandName(editingCommand.name);
    if (!nameValidation.valid) {
      toast.error(nameValidation.error || 'Invalid command name');
      return;
    }

    const descValidation = validateCommandDescription(editingCommand.description || '');
    if (!descValidation.valid) {
      toast.error(descValidation.error || 'Invalid command description');
      return;
    }

    try {
      if (editingCommand.isNew) {
        const { error } = await supabase
          .from('conversational_components')
          .insert([
            {
              user_id: user.id,
              phone_number_id: phoneNumberId,
              type: 'command',
              name: editingCommand.name,
              description: editingCommand.description,
              position: commands.length,
              status: 'active',
            },
          ]);

        if (error) throw error;
        toast.success('Command added');
      } else {
        const { error } = await supabase
          .from('conversational_components')
          .update({
            name: editingCommand.name,
            description: editingCommand.description,
          })
          .eq('id', editingCommand.id);

        if (error) throw error;
        toast.success('Command updated');
      }

      setSyncStatus('pending');
      setEditingCommand(null);
      fetchComponents();
    } catch (error) {
      console.error('Failed to save command:', error);
      toast.error('Failed to save command');
    }
  };

  const handleDelete = async (id: string, type: ConversationalComponentType) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('conversational_components')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`${type === 'ice_breaker' ? 'Ice breaker' : 'Command'} deleted`);
      setSyncStatus('pending');
      fetchComponents();
    } catch (error) {
      console.error('Failed to delete component:', error);
      toast.error('Failed to delete component');
    }
  };

  const handleSync = async () => {
    if (!user?.id || !accessToken) return;

    setSyncing(true);
    setSyncError('');

    try {
      const iceBreakersText = iceBreakers.map((c) => c.name);
      const commandsData = commands.map((c) => ({
        command_name: c.name,
        command_description: c.description || '',
      }));

      const payload = buildConversationalPayload(iceBreakersText, commandsData);

      const response = await syncConversationalComponents(
        phoneNumberId,
        accessToken,
        payload
      );

      if (!response.success) {
        setSyncError(response.error?.message || 'Sync failed');
        setSyncStatus('failed');
        toast.error(`Sync failed: ${response.error?.message}`);
        return;
      }

      setSyncStatus('synced');
      toast.success('Components synced to WhatsApp');
    } catch (error) {
      setSyncStatus('failed');
      setSyncError(error instanceof Error ? error.message : 'Unknown error');
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            <p className="text-sm text-slate-400">Loading components...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-700 ring-0 ring-transparent">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-white">Conversational Components</CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                Create ice breakers and commands to guide customer conversations
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {syncStatus && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                syncStatus === 'synced' ? 'bg-emerald-900/30 text-emerald-300' :
                syncStatus === 'pending' ? 'bg-amber-900/30 text-amber-300' :
                'bg-red-900/30 text-red-300'
              }`}>
                {syncStatus === 'synced' && <CheckCircle2 className="h-3 w-3" />}
                {syncStatus === 'pending' && <AlertCircle className="h-3 w-3" />}
                {syncStatus === 'failed' && <AlertCircle className="h-3 w-3" />}
                <span>{syncStatus === 'synced' ? 'Synced' : syncStatus === 'pending' ? 'Pending' : 'Failed'}</span>
              </div>
            )}
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing || iceBreakers.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Syncing
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Sync
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {syncError && (
          <Alert className="border-red-900/50 bg-red-900/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <AlertDescription className="text-red-200 ml-2">{syncError}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="ice-breakers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800 border border-slate-700 p-1 rounded-lg">
            <TabsTrigger
              value="ice-breakers"
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 data-[state=inactive]:hover:text-slate-300 rounded-md transition-colors flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Ice Breakers</span>
              <span className="ml-auto bg-slate-900 px-2 py-0.5 rounded text-xs font-medium">{iceBreakers.length}/4</span>
            </TabsTrigger>
            <TabsTrigger
              value="commands"
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-400 data-[state=inactive]:hover:text-slate-300 rounded-md transition-colors flex items-center gap-2"
            >
              <Slash className="h-4 w-4" />
              <span>Commands</span>
              <span className="ml-auto bg-slate-900 px-2 py-0.5 rounded text-xs font-medium">{commands.length}/30</span>
            </TabsTrigger>
          </TabsList>

          {/* Ice Breakers Tab */}
          <TabsContent value="ice-breakers" className="space-y-4 mt-6">
            <Alert className="border-blue-900/30 bg-blue-900/10 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <AlertDescription className="text-blue-300 ml-2 text-sm">
                Quick reply buttons shown when customers start a chat (max 4, 80 chars each, no emojis)
              </AlertDescription>
            </Alert>

            {iceBreakers.length === 0 && !editingIceBreaker && (
              <div className="text-center py-8 px-4 bg-slate-800/50 border border-dashed border-slate-700 rounded-lg">
                <MessageSquare className="h-8 w-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-slate-400 text-sm">No ice breakers yet. Create one to engage customers.</p>
              </div>
            )}

            <div className="space-y-2">
              {iceBreakers.map((breaker) => (
                <div
                  key={breaker.id}
                  className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800/80 transition-all group"
                >
                  <GripVertical className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-move" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{breaker.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{breaker.name.length} / 80 characters</p>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingIceBreaker(breaker as EditingComponent)}
                      className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(breaker.id, 'ice_breaker')}
                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {editingIceBreaker ? (
              <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 space-y-4">
                <div>
                  <Label className="text-slate-300 mb-2 block text-sm font-medium">Ice Breaker Text</Label>
                  <Input
                    autoFocus
                    placeholder="e.g., Browse Products"
                    value={editingIceBreaker.name}
                    onChange={(e) =>
                      setEditingIceBreaker({
                        ...editingIceBreaker,
                        name: e.target.value.slice(0, 80),
                      })
                    }
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                    maxLength={80}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-500">Maximum 80 characters, no emojis</p>
                    <p className={`text-xs font-medium ${editingIceBreaker.name.length > 75 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {editingIceBreaker.name.length} / 80
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingIceBreaker(null)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveIceBreaker}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                onClick={() => setEditingIceBreaker({ name: '', isNew: true })}
                disabled={iceBreakers.length >= 4}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Ice Breaker
              </Button>
            )}
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4 mt-6">
            <Alert className="border-blue-900/30 bg-blue-900/10 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <AlertDescription className="text-blue-300 ml-2 text-sm">
                Triggered when customers type /command (max 30, names max 32 chars, descriptions max 256 chars, no emojis)
              </AlertDescription>
            </Alert>

            {commands.length === 0 && !editingCommand && (
              <div className="text-center py-8 px-4 bg-slate-800/50 border border-dashed border-slate-700 rounded-lg">
                <Slash className="h-8 w-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-slate-400 text-sm">No commands yet. Create one to provide quick actions.</p>
              </div>
            )}

            <div className="space-y-2">
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="p-3 bg-slate-800/60 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800/80 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <GripVertical className="h-4 w-4 text-slate-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-move flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-white font-mono font-medium text-sm bg-slate-700 px-2 py-0.5 rounded">
                            /{cmd.name}
                          </code>
                          <span className="text-xs px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded-full font-medium">command</span>
                        </div>
                        {cmd.description && (
                          <p className="text-sm text-slate-400 line-clamp-2 mb-1.5">{cmd.description}</p>
                        )}
                        <p className="text-xs text-slate-600">
                          Name: {cmd.name.length}/32 · Description: {(cmd.description || '').length}/256
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCommand(cmd as EditingComponent)}
                        className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(cmd.id, 'command')}
                        className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-slate-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {editingCommand ? (
              <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 space-y-4">
                <div>
                  <Label className="text-slate-300 mb-2 block text-sm font-medium">Command Name</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono text-lg">/</span>
                    <Input
                      autoFocus
                      placeholder="help"
                      value={editingCommand.name}
                      onChange={(e) =>
                        setEditingCommand({
                          ...editingCommand,
                          name: e.target.value.slice(0, 32),
                        })
                      }
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-mono flex-1"
                      maxLength={32}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-500">Alphanumeric + underscore, max 32 characters</p>
                    <p className={`text-xs font-medium ${editingCommand.name.length > 28 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {editingCommand.name.length} / 32
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300 mb-2 block text-sm font-medium">Description</Label>
                  <textarea
                    placeholder="Describe what this command does..."
                    value={editingCommand.description || ''}
                    onChange={(e) =>
                      setEditingCommand({
                        ...editingCommand,
                        description: e.target.value.slice(0, 256),
                      })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-500 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 resize-none"
                    maxLength={256}
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-500">Maximum 256 characters, no emojis</p>
                    <p className={`text-xs font-medium ${(editingCommand.description || '').length > 240 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {(editingCommand.description || '').length} / 256
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingCommand(null)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveCommand}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                onClick={() => setEditingCommand({ name: '', description: '', isNew: true })}
                disabled={commands.length >= 30}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Command
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {/* Info Box */}
        <div className="p-3.5 bg-blue-900/20 border border-blue-900/40 rounded-lg">
          <p className="text-xs text-blue-300 leading-relaxed">
            <span className="font-semibold">Pro tip:</span> Changes sync to WhatsApp when you click the Sync button. Customers will see your ice breakers as quick replies and can trigger commands by typing /{'{command}'}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
