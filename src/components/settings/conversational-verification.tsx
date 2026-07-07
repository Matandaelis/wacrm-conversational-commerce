'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  RefreshCw,
  Copy,
  CheckCircle,
} from 'lucide-react'

interface VerificationProps {
  phoneNumberId: string
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Failed to fetch')
  return r.json()
})

export function ConversationalVerification({ phoneNumberId }: VerificationProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const { data: components, isLoading, mutate } = useSWR(
    phoneNumberId ? `/api/whatsapp/conversational?phone_number_id=${phoneNumberId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <Zap className="h-6 w-6 text-slate-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const iceBreakers = components?.ice_breakers || []
  const commands = components?.commands || []
  const syncStatus = components?.sync_status || 'unknown'

  return (
    <div className="space-y-4">
      {/* Status Summary */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Sync Verification
          </CardTitle>
          <CardDescription className="text-slate-400">
            Verify that conversational components are synced to WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync Status */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
              <div>
                <p className="text-sm font-medium text-white">Meta API Status</p>
                <p className="text-xs text-slate-400">Last sync: {new Date().toLocaleString()}</p>
              </div>
            </div>
            <Badge className={syncStatus === 'synced' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-yellow-900/50 text-yellow-300'}>
              {syncStatus === 'synced' ? 'Synced' : 'Pending'}
            </Badge>
          </div>

          {/* Component Counts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Ice Breakers</p>
              <p className="text-2xl font-bold text-white">{iceBreakers.length}/4</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Commands</p>
              <p className="text-2xl font-bold text-white">{commands.length}/30</p>
            </div>
          </div>

          <Button
            onClick={() => mutate()}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      {/* Ice Breakers List */}
      {iceBreakers.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Ice Breakers ({iceBreakers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {iceBreakers.map((breaker: any, idx: number) => (
                <div
                  key={breaker.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 group hover:border-slate-600"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-slate-500 font-mono">{idx + 1}.</span>
                    <p className="text-sm text-white truncate">{breaker.name}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(breaker.name, `breaker-${breaker.id}`)}
                    className="h-7 px-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copied === `breaker-${breaker.id}` ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commands List */}
      {commands.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Commands ({commands.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {commands.map((cmd: any, idx: number) => (
                <div
                  key={cmd.id}
                  className="flex items-start justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700 group hover:border-slate-600"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500 font-mono">{idx + 1}.</span>
                      <code className="text-sm font-mono text-white bg-slate-700 px-2 py-0.5 rounded">/{cmd.name}</code>
                    </div>
                    {cmd.description && (
                      <p className="text-xs text-slate-400 ml-6">{cmd.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(`/${cmd.name}`, `cmd-${cmd.id}`)}
                    className="h-7 px-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                  >
                    {copied === `cmd-${cmd.id}` ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {iceBreakers.length === 0 && commands.length === 0 && (
        <Alert className="border-slate-700 bg-slate-800/50">
          <AlertCircle className="h-4 w-4 text-slate-500" />
          <AlertDescription className="text-slate-400 ml-2">
            No conversational components configured. Add ice breakers and commands in the panel above.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Box */}
      <div className="p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg">
        <p className="text-xs text-blue-300">
          <span className="font-semibold">Verification Info:</span> Once components are synced, they appear in customer conversations on WhatsApp.
        </p>
      </div>
    </div>
  )
}
