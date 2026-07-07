'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
import {
  Plus,
  Trash2,
  Loader2,
  Zap,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Command as CommandIcon,
} from 'lucide-react'

interface ConversationalComponent {
  id: string
  name: string
  description?: string
}

interface PanelProps {
  phoneNumberId: string
  accessToken: string
}

export function ConversationalComponentsPanel({
  phoneNumberId,
  accessToken,
}: PanelProps) {
  const [iceBreakers, setIceBreakers] = useState<ConversationalComponent[]>([])
  const [commands, setCommands] = useState<ConversationalComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'pending' | 'failed'>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [editingIceBreaker, setEditingIceBreaker] = useState<{
    name: string
    isNew?: boolean
  } | null>(null)
  const [editingCommand, setEditingCommand] = useState<{
    name: string
    description: string
    isNew?: boolean
  } | null>(null)

  // Load components on mount
  useEffect(() => {
    loadComponents()
  }, [phoneNumberId])

  const loadComponents = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/whatsapp/conversational')
      if (!res.ok) throw new Error('Failed to load components')
      const data = await res.json()
      setIceBreakers(data.ice_breakers || [])
      setCommands(data.commands || [])
      setSyncStatus('idle')
    } catch (error) {
      console.error('[conversational-panel] Load error:', error)
      setSyncStatus('failed')
      setSyncError('Failed to load components')
    } finally {
      setLoading(false)
    }
  }

  const handleAddIceBreaker = () => {
    setEditingIceBreaker({ name: '', isNew: true })
  }

  const handleSaveIceBreaker = () => {
    if (!editingIceBreaker || !editingIceBreaker.name.trim()) return
    if (editingIceBreaker.name.length > 80) return

    if (editingIceBreaker.isNew) {
      setIceBreakers([
        ...iceBreakers,
        {
          id: `ice-breaker-${Date.now()}`,
          name: editingIceBreaker.name,
        },
      ])
    }

    setEditingIceBreaker(null)
    setSyncStatus('pending')
  }

  const handleDeleteIceBreaker = (id: string) => {
    setIceBreakers(iceBreakers.filter((ib) => ib.id !== id))
    setSyncStatus('pending')
  }

  const handleAddCommand = () => {
    setEditingCommand({ name: '', description: '', isNew: true })
  }

  const handleSaveCommand = () => {
    if (!editingCommand || !editingCommand.name.trim()) return
    if (editingCommand.name.length > 32) return
    if (editingCommand.description.length > 256) return
    if (!/^[a-zA-Z0-9_]+$/.test(editingCommand.name)) return

    if (editingCommand.isNew) {
      setCommands([
        ...commands,
        {
          id: `command-${Date.now()}`,
          name: editingCommand.name,
          description: editingCommand.description,
        },
      ])
    }

    setEditingCommand(null)
    setSyncStatus('pending')
  }

  const handleDeleteCommand = (id: string) => {
    setCommands(commands.filter((cmd) => cmd.id !== id))
    setSyncStatus('pending')
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setSyncError(null)

      const res = await fetch('/api/whatsapp/conversational', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId,
          iceBreakers: iceBreakers.map((ib) => ib.name),
          commands: commands.map((cmd) => ({
            command_name: cmd.name,
            command_description: cmd.description || '',
          })),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Sync failed')
      }

      setSyncStatus('synced')
      setTimeout(() => setSyncStatus('idle'), 5000)
    } catch (error) {
      console.error('[conversational-panel] Sync error:', error)
      setSyncStatus('failed')
      setSyncError(
        error instanceof Error ? error.message : 'Failed to sync to WhatsApp'
      )
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Conversational Components</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-slate-500 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Conversational Components
        </CardTitle>
        <CardDescription className="text-slate-400">
          Set up ice breakers and commands to guide customer conversations on WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Messages */}
        {syncStatus === 'synced' && (
          <Alert className="border-emerald-900/50 bg-emerald-900/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <AlertDescription className="text-emerald-200 ml-2">
              Components synced successfully with WhatsApp
            </AlertDescription>
          </Alert>
        )}

        {syncStatus === 'failed' && syncError && (
          <Alert className="border-red-900/50 bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-200 ml-2">
              {syncError}
            </AlertDescription>
          </Alert>
        )}

        {syncStatus === 'pending' && (
          <Alert className="border-amber-900/50 bg-amber-900/20">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-200 ml-2">
              Unsaved changes. Click "Sync to WhatsApp" to apply.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="ice-breakers" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger
              value="ice-breakers"
              className="data-[state=active]:bg-slate-700 text-slate-300 data-[state=active]:text-white"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Ice Breakers ({iceBreakers.length}/4)
            </TabsTrigger>
            <TabsTrigger
              value="commands"
              className="data-[state=active]:bg-slate-700 text-slate-300 data-[state=active]:text-white"
            >
              <CommandIcon className="h-4 w-4 mr-2" />
              Commands ({commands.length}/30)
            </TabsTrigger>
          </TabsList>

          {/* Ice Breakers Tab */}
          <TabsContent value="ice-breakers" className="space-y-4 mt-4">
            {/* List */}
            <div className="space-y-2">
              {iceBreakers.map((ib) => (
                <div
                  key={ib.id}
                  className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600"
                >
                  <p className="text-white text-sm flex-1">{ib.name}</p>
                  <div className="flex gap-2 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditingIceBreaker({ ...ib, isNew: false })
                      }
                      className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteIceBreaker(ib.id)}
                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Form */}
            {editingIceBreaker && (
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-3">
                <div>
                  <Label className="text-slate-300 text-sm mb-2 block">
                    Ice Breaker Text (max 80 characters)
                  </Label>
                  <Input
                    placeholder="e.g., Browse our products"
                    value={editingIceBreaker.name}
                    onChange={(e) =>
                      setEditingIceBreaker({
                        ...editingIceBreaker,
                        name: e.target.value.slice(0, 80),
                      })
                    }
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {editingIceBreaker.name.length} / 80
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveIceBreaker}
                    disabled={!editingIceBreaker.name.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingIceBreaker(null)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Add Button */}
            {!editingIceBreaker && iceBreakers.length < 4 && (
              <Button
                onClick={handleAddIceBreaker}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Ice Breaker
              </Button>
            )}

            {iceBreakers.length >= 4 && !editingIceBreaker && (
              <p className="text-xs text-slate-500 text-center py-2">
                Maximum 4 ice breakers reached
              </p>
            )}
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4 mt-4">
            {/* List */}
            <div className="space-y-2">
              {commands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="flex items-start justify-between p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-mono">/{cmd.name}</p>
                    {cmd.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {cmd.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditingCommand({ ...cmd, isNew: false })
                      }
                      className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCommand(cmd.id)}
                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Form */}
            {editingCommand && (
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 space-y-3">
                <div>
                  <Label className="text-slate-300 text-sm mb-2 block">
                    Command Name (alphanumeric + underscore, max 32)
                  </Label>
                  <div className="flex gap-1">
                    <span className="text-slate-400 py-2 px-3 bg-slate-700 rounded text-sm">
                      /
                    </span>
                    <Input
                      placeholder="e.g., help"
                      value={editingCommand.name}
                      onChange={(e) =>
                        setEditingCommand({
                          ...editingCommand,
                          name: e.target.value
                            .replace(/[^a-zA-Z0-9_]/g, '')
                            .slice(0, 32),
                        })
                      }
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 font-mono"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {editingCommand.name.length} / 32
                  </p>
                </div>

                <div>
                  <Label className="text-slate-300 text-sm mb-2 block">
                    Description (max 256 characters)
                  </Label>
                  <textarea
                    placeholder="What does this command do?"
                    value={editingCommand.description}
                    onChange={(e) =>
                      setEditingCommand({
                        ...editingCommand,
                        description: e.target.value.slice(0, 256),
                      })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-500 p-2 text-sm"
                    rows={2}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {editingCommand.description.length} / 256
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveCommand}
                    disabled={
                      !editingCommand.name.trim() ||
                      !/^[a-zA-Z0-9_]+$/.test(editingCommand.name)
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingCommand(null)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Add Button */}
            {!editingCommand && commands.length < 30 && (
              <Button
                onClick={handleAddCommand}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Command
              </Button>
            )}

            {commands.length >= 30 && !editingCommand && (
              <p className="text-xs text-slate-500 text-center py-2">
                Maximum 30 commands reached
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Sync Button */}
        <Button
          onClick={handleSync}
          disabled={syncing || (syncStatus !== 'pending' && syncStatus !== 'idle')}
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
      </CardContent>
    </Card>
  )
}
