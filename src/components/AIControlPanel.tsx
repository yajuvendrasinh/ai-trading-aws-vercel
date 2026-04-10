"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Square, Zap, Loader2, AlertCircle, ShieldAlert } from "lucide-react"
import { postTradingCommand, triggerKillSwitch, fetchBreezeData } from "@/app/actions"

interface AIControlPanelProps {
  initialStatus?: any
}

export function AIControlPanel({ initialStatus }: AIControlPanelProps) {
  const [status, setStatus] = useState(initialStatus || { active: false, symbol: 'NIFTY', mode: 'PAPER' })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' | null }>({ text: '', type: null })

  // Clear messages after 5 seconds
  useEffect(() => {
    if (message.text) {
      const t = setTimeout(() => setMessage({ text: '', type: null }), 5000);
      return () => clearTimeout(t);
    }
  }, [message.text])

  // Polling to keep the status synced
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await fetchBreezeData('/trading/status')
        if (data) {
          setStatus(data)
        }
      } catch (e) {
        // Silent fail for polling
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleTrading = async () => {
    setIsLoading(true)
    const endpoint = status.active ? '/trading/stop' : '/trading/start'
    const result = await postTradingCommand(endpoint)
    
    if (result.success) {
      setStatus({ ...status, active: !status.active })
      setMessage({ 
        text: status.active ? "AI Deactivated" : "AI Agent Activated", 
        type: 'success' 
      })
    } else {
      setMessage({ 
        text: "Command Failed: " + (result.error || "Network error"), 
        type: 'error' 
      })
    }
    setIsLoading(false)
  }

  const handleKillSwitch = async () => {
    if (!confirm("EMERGENCY: This will close ALL OPEN LIVE POSITIONS immediately. Your Demat Portfolio holdings are NOT affected. Proceed?")) return
    
    setIsLoading(true)
    const result = await triggerKillSwitch()
    if (result.success) {
      setMessage({
        text: "KILL-SWITCH EXECUTED: All positions squared off.",
        type: 'error' 
      })
    }
    setIsLoading(false)
  }

  return (
    <Card className={`border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg relative overflow-hidden transition-all ${status.active ? 'ring-1 ring-emerald-500/50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
        <div className="space-y-0.5">
          <CardTitle className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">AI Command Center</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={status.active ? "default" : "outline"} className={`text-[10px] py-0 px-1 uppercase font-bold ${status.active ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' : 'text-zinc-500 border-zinc-800'}`}>
              {status.active ? 'Active' : 'Idle'}
            </Badge>
            <span className="text-[9px] text-zinc-600 font-mono">{status.mode} MODE</span>
          </div>
        </div>
        <Zap className={`h-4 w-4 ${status.active ? 'text-emerald-500 animate-pulse' : 'text-zinc-700'}`} />
      </CardHeader>
      
      <CardContent className="space-y-2 px-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <Button 
            onClick={handleToggleTrading} 
            disabled={isLoading}
            className={`w-full justify-start font-bold transition-all ${status.active ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'}`}
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (status.active ? <Square className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2 fill-current" />)}
            {status.active ? 'STOP AUTOPILOT' : 'START AI AGENT'}
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleKillSwitch}
            disabled={isLoading}
            className="w-full justify-start border-red-900/30 bg-red-950/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
          >
            <ShieldAlert className="h-4 w-4 mr-2" />
            EMERGENCY KILL-SWITCH
          </Button>
        </div>

        {message.text && (
          <div className={`mt-2 p-1.5 rounded text-[10px] flex items-center gap-2 border ${
            message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
            message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
            'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
          }`}>
            {message.type === 'error' ? <AlertCircle className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
