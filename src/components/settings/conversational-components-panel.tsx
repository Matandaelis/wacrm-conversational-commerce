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

  // Fetch components from database
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

  // Add or update ice breaker
  const handleSaveIceBreaker = async () => {
    if (!editingIceBreaker || !user?.id) return;

    const validation = validateIceBreaker(editingIceBreaker.name);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid ice breaker');
      return;
    }

    try {
      if (editingIceBreaker.isNew) {
        // Insert new
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
        // Update existing
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

  // Add or update command
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

  // Delete component
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

  // Sync to Meta API
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
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <Zap className="h-5 w-5 text-amber-500 mt-1" />
            <div>
              <CardTitle>Conversational Components</CardTitle>
              <CardDescription>
                Manage ice breakers and commands for your WhatsApp number
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncStatus && (
              <div className="flex items-center gap-1 text-xs">
                {syncStatus === 'synced' && (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-700">Synced</span>
                  </>
                )}
                {syncStatus === 'pending' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-700">Pending</span>
                  </>
                )}
                {syncStatus === 'failed' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-700">Failed</span>
                  </>
                )}
              </div>
            )}
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing || iceBreakers.length === 0}
              variant="outline"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                'Sync to Meta'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {syncError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{syncError}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="ice-breakers" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ice-breakers">
              Ice Breakers ({iceBreakers.length}/4)
            </TabsTrigger>
            <TabsTrigger value="commands">
              Commands ({commands.length}/30)
            </TabsTrigger>
          </TabsList>

          {/* Ice Breakers Tab */}
          <TabsContent value="ice-breakers" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Up to 4 prompts (max 80 characters each). No emojis allowed.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {iceBreakers.map((breaker) => (
                <div
                  key={breaker.id}
                  className="flex items-center gap-2 p-3 rounded-md border bg-slate-50"
                >
                  <GripVertical className="h-4 w-4 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{breaker.name}</p>
                    <p className="text-xs text-slate-500">{breaker.name.length}/80 chars</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(breaker.id, 'ice_breaker')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {editingIceBreaker ? (
              <div className="p-4 rounded-md border bg-slate-50 space-y-3">
                <Label htmlFor="ice-breaker-input">Ice Breaker Text</Label>
                <Input
                  id="ice-breaker-input"
                  value={editingIceBreaker.name}
                  onChange={(e) =>
                    setEditingIceBreaker({
                      ...editingIceBreaker,
                      name: e.target.value.slice(0, 80),
                    })
                  }
                  placeholder="e.g., Browse our products"
                  maxLength={80}
                />
                <p className="text-xs text-slate-500">
                  {editingIceBreaker.name.length}/80 characters
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingIceBreaker(null)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveIceBreaker}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                variant="outline"
                onClick={() =>
                  setEditingIceBreaker({ name: '', isNew: true })
                }
                disabled={iceBreakers.length >= 4}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Ice Breaker
              </Button>
            )}
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Up to 30 commands. Command name max 32 chars, description max 256 chars. No emojis.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              {commands.map((command) => (
                <div
                  key={command.id}
                  className="p-3 rounded-md border bg-slate-50 space-y-1"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <GripVertical className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-mono font-semibold text-slate-900">
                          /{command.name}
                        </p>
                        <p className="text-xs text-slate-600">{command.description}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {command.name.length}/32 chars (name)
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(command.id, 'command')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {editingCommand ? (
              <div className="p-4 rounded-md border bg-slate-50 space-y-3">
                <div>
                  <Label htmlFor="command-name-input">Command Name</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-mono">/</span>
                    <Input
                      id="command-name-input"
                      value={editingCommand.name}
                      onChange={(e) =>
                        setEditingCommand({
                          ...editingCommand,
                          name: e.target.value.slice(0, 32),
                        })
                      }
                      placeholder="help"
                      maxLength={32}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {editingCommand.name.length}/32 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="command-desc-input">Description</Label>
                  <Input
                    id="command-desc-input"
                    value={editingCommand.description || ''}
                    onChange={(e) =>
                      setEditingCommand({
                        ...editingCommand,
                        description: e.target.value.slice(0, 256),
                      })
                    }
                    placeholder="Get help with your order"
                    maxLength={256}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {(editingCommand.description || '').length}/256 characters
                  </p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingCommand(null)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveCommand}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                variant="outline"
                onClick={() =>
                  setEditingCommand({ name: '', description: '', isNew: true })
                }
                disabled={commands.length >= 30}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Command
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
