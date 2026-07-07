'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface ComponentItem {
  id: string;
  name: string;
  description?: string;
  type: 'ice_breaker' | 'command';
}

interface ConversationalComponentsPanelProps {
  phoneNumberId: string;
  accessToken: string;
}

export function ConversationalComponentsPanel({
  phoneNumberId,
  accessToken,
}: ConversationalComponentsPanelProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [iceBreakers, setIceBreakers] = useState<ComponentItem[]>([]);
  const [commands, setCommands] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'failed'>('idle');
  const [syncError, setSyncError] = useState<string>('');

  // Form states
  const [newIceBreaker, setNewIceBreaker] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newCommandDesc, setNewCommandDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load components on mount
  useEffect(() => {
    const loadComponents = async () => {
      if (!user || !phoneNumberId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('conversational_components')
          .select('*')
          .eq('user_id', user.id)
          .eq('phone_number_id', phoneNumberId)
          .eq('status', 'active');

        if (error) throw error;

        if (data) {
          setIceBreakers(
            data
              .filter((c: any) => c.type === 'ice_breaker')
              .sort((a: any, b: any) => a.position - b.position)
          );
          setCommands(
            data
              .filter((c: any) => c.type === 'command')
              .sort((a: any, b: any) => a.position - b.position)
          );
        }
      } catch (err) {
        console.error('[conversational] load failed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadComponents();
  }, [user, phoneNumberId, supabase]);

  // Add ice breaker
  const addIceBreaker = async () => {
    if (!newIceBreaker.trim() || newIceBreaker.length > 80 || iceBreakers.length >= 4) {
      toast.error('Invalid ice breaker');
      return;
    }

    if (!/^[a-zA-Z0-9\s.,!?&'"-]*$/.test(newIceBreaker)) {
      toast.error('Ice breaker contains invalid characters');
      return;
    }

    try {
      const { error } = await supabase.from('conversational_components').insert({
        user_id: user?.id,
        phone_number_id: phoneNumberId,
        type: 'ice_breaker',
        name: newIceBreaker,
        position: iceBreakers.length,
        status: 'active',
      });

      if (error) throw error;

      setIceBreakers([...iceBreakers, { id: Date.now().toString(), name: newIceBreaker, type: 'ice_breaker' }]);
      setNewIceBreaker('');
      toast.success('Ice breaker added');
      setSyncStatus('idle');
    } catch (err) {
      toast.error('Failed to add ice breaker');
      console.error(err);
    }
  };

  // Add command
  const addCommand = async () => {
    if (!newCommand.trim() || newCommand.length > 32 || commands.length >= 30 || newCommandDesc.length > 256) {
      toast.error('Invalid command');
      return;
    }

    if (!/^[a-zA-Z0-9_]*$/.test(newCommand)) {
      toast.error('Command name must be alphanumeric + underscore only');
      return;
    }

    if (!/^[a-zA-Z0-9\s.,!?&'"-]*$/.test(newCommandDesc)) {
      toast.error('Command description contains invalid characters');
      return;
    }

    try {
      const { error } = await supabase.from('conversational_components').insert({
        user_id: user?.id,
        phone_number_id: phoneNumberId,
        type: 'command',
        name: newCommand,
        description: newCommandDesc,
        position: commands.length,
        status: 'active',
      });

      if (error) throw error;

      setCommands([
        ...commands,
        { id: Date.now().toString(), name: newCommand, description: newCommandDesc, type: 'command' },
      ]);
      setNewCommand('');
      setNewCommandDesc('');
      toast.success('Command added');
      setSyncStatus('idle');
    } catch (err) {
      toast.error('Failed to add command');
      console.error(err);
    }
  };

  // Delete component
  const deleteComponent = async (id: string, type: 'ice_breaker' | 'command') => {
    try {
      const { error } = await supabase
        .from('conversational_components')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (type === 'ice_breaker') {
        setIceBreakers(iceBreakers.filter((c) => c.id !== id));
      } else {
        setCommands(commands.filter((c) => c.id !== id));
      }
      toast.success('Component deleted');
      setSyncStatus('idle');
    } catch (err) {
      toast.error('Failed to delete component');
      console.error(err);
    }
  };

  // Sync to Meta
  const handleSync = async () => {
    if (!phoneNumberId || !accessToken || accessToken.includes('•')) {
      toast.error('WhatsApp configuration required');
      return;
    }

    setSyncing(true);
    setSyncError('');

    try {
      const response = await fetch('/api/whatsapp/conversational', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId,
          accessToken,
          iceBreakers: iceBreakers.map((c) => c.name),
          commands: commands.map((c) => ({
            command_name: c.name,
            command_description: c.description || '',
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Sync failed');
      }

      setSyncStatus('synced');
      toast.success('Synced to WhatsApp');
    } catch (err: any) {
      setSyncStatus('failed');
      setSyncError(err.message || 'Sync failed');
      toast.error('Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Conversational Components
        </CardTitle>
        <CardDescription className="text-slate-400">
          Create ice breakers and commands to guide customer conversations
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Alerts */}
        {syncStatus === 'synced' && (
          <Alert className="border-emerald-900/50 bg-emerald-900/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <AlertDescription className="text-emerald-200 ml-2">
              Components synced with WhatsApp
            </AlertDescription>
          </Alert>
        )}

        {syncStatus === 'failed' && syncError && (
          <Alert className="border-red-900/50 bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-200 ml-2">{syncError}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-slate-500 animate-spin" />
          </div>
        ) : (
          <>
            <Tabs defaultValue="ice-breakers" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                <TabsTrigger value="ice-breakers" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                  Ice Breakers ({iceBreakers.length}/4)
                </TabsTrigger>
                <TabsTrigger value="commands" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                  Commands ({commands.length}/30)
                </TabsTrigger>
              </TabsList>

              {/* Ice Breakers Tab */}
              <TabsContent value="ice-breakers" className="space-y-4 mt-4">
                <div className="space-y-2">
                  {iceBreakers.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4">No ice breakers yet</p>
                  ) : (
                    iceBreakers.map((breaker) => (
                      <div key={breaker.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <span className="text-slate-300 text-sm">{breaker.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteComponent(breaker.id, 'ice_breaker')}
                          className="text-red-400 hover:text-red-300 hover:bg-slate-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {iceBreakers.length < 4 && (
                  <div className="space-y-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <Input
                      placeholder="Add ice breaker (max 80 characters)"
                      value={newIceBreaker}
                      onChange={(e) => setNewIceBreaker(e.target.value.slice(0, 80))}
                      onKeyDown={(e) => e.key === 'Enter' && addIceBreaker()}
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                      maxLength={80}
                    />
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>{newIceBreaker.length}/80</span>
                      <Button size="sm" onClick={addIceBreaker} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Commands Tab */}
              <TabsContent value="commands" className="space-y-4 mt-4">
                <div className="space-y-2">
                  {commands.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4">No commands yet</p>
                  ) : (
                    commands.map((cmd) => (
                      <div key={cmd.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex-1">
                          <div className="text-slate-300 text-sm font-mono">/{cmd.name}</div>
                          {cmd.description && <div className="text-xs text-slate-500 mt-1">{cmd.description}</div>}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteComponent(cmd.id, 'command')}
                          className="text-red-400 hover:text-red-300 hover:bg-slate-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {commands.length < 30 && (
                  <div className="space-y-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <div>
                      <Label className="text-slate-300 text-xs">Command Name</Label>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-slate-400">/</span>
                        <Input
                          placeholder="help"
                          value={newCommand}
                          onChange={(e) => setNewCommand(e.target.value.slice(0, 32))}
                          className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 text-sm"
                          maxLength={32}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{newCommand.length}/32</p>
                    </div>

                    <div>
                      <Label className="text-slate-300 text-xs">Description</Label>
                      <textarea
                        placeholder="What does this command do?"
                        value={newCommandDesc}
                        onChange={(e) => setNewCommandDesc(e.target.value.slice(0, 256))}
                        className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 p-2 rounded text-sm mt-1"
                        rows={2}
                        maxLength={256}
                      />
                      <p className="text-xs text-slate-500 mt-1">{newCommandDesc.length}/256</p>
                    </div>

                    <Button size="sm" onClick={addCommand} className="w-full bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Command
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Sync Button */}
            <Button
              onClick={handleSync}
              disabled={syncing || iceBreakers.length === 0 || commands.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Sync to WhatsApp
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
