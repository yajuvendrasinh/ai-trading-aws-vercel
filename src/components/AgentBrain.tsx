"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, MessageSquare, TrendingUp, TrendingDown, Minus, Target, Clock, Zap } from "lucide-react"
import { fetchAgentInsights } from "@/app/actions"

interface Insight {
  timestamp: string
  symbol: string
  action: "BUY" | "SELL" | "HOLD"
  instrument: string
  confidence: number
  reasoning: string
}

interface AgentBrainProps {
  initialInsights?: Insight[]
}

export function AgentBrain({ initialInsights }: AgentBrainProps) {
  const [insights, setInsights] = useState<Insight[]>(Array.isArray(initialInsights) ? initialInsights : [])
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [isMounted, setIsMounted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
    // 1. Fetch initial history
    async function loadHistory() {
      const history = await fetchAgentInsights()
      if (history && Array.isArray(history)) {
        setInsights(history)
      }
    }
    loadHistory()

    // 2. Setup WebSocket for real-time updates
    const rawBase = process.env.NEXT_PUBLIC_AWS_IP || "http://localhost:8000"
    const wsBase = rawBase.replace(/\/$/, '').replace(/^http/, 'ws')
    const wsUrl = `${wsBase}/ws/live-prices`

    let socket: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout

    const connect = () => {
      socket = new WebSocket(wsUrl)
      
      socket.onopen = () => setStatus('connected')
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === "AGENT_INSIGHT") {
            setInsights(prev => [message.data, ...prev].slice(0, 50))
          }
        } catch (err) {
          console.error("AgentBrain WS Error:", err)
        }
      }

      socket.onclose = () => {
        setStatus('disconnected')
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      socket?.close()
      clearTimeout(reconnectTimeout)
    }
  }, [])

  return (
    <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg relative overflow-hidden flex flex-col h-[400px]">
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/50 pb-3 h-14 shrink-0 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <Brain className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-white">Agent Reasoning</CardTitle>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Real-time Logic Stream</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-[10px] text-zinc-500 font-mono uppercase">{status}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-hide custom-scrollbar" ref={scrollRef}>
        {insights.length > 0 ? (
          <div className="divide-y divide-zinc-800/30">
            {insights.map((insight, idx) => (
              <div key={idx} className={`p-4 hover:bg-zinc-800/20 transition-colors ${idx === 0 ? 'bg-purple-500/5' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] font-bold border-zinc-700 text-zinc-300 px-1.5 py-0">
                      {insight.symbol}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {insight.action === 'BUY' ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : insight.action === 'SELL' ? (
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                      ) : (
                        <Minus className="h-3 w-3 text-zinc-500" />
                      )}
                      <span className={`text-xs font-bold uppercase tracking-tight ${
                        insight.action === 'BUY' ? 'text-emerald-400' : 
                        insight.action === 'SELL' ? 'text-rose-400' : 'text-zinc-500'
                      }`}>
                        {insight.action} {insight.instrument !== 'futures' ? insight.instrument.toUpperCase() : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Clock className="h-2.5 w-2.5" />
                      {isMounted ? new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 group">
                    <MessageSquare className="h-3 w-3 text-zinc-600 mt-0.5 shrink-0 group-hover:text-purple-400 transition-colors" />
                    <p className="text-xs text-zinc-400 leading-relaxed italic">
                      "{insight.reasoning}"
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          insight.confidence > 0.7 ? 'bg-emerald-500' : 
                          insight.confidence > 0.4 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${insight.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {Math.round(insight.confidence * 100)}% Confidence
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-zinc-900/10">
            <Zap className="h-8 w-8 text-zinc-800 mb-2 animate-pulse" />
            <p className="text-zinc-500 text-xs">Waiting for AI analytical cycle...</p>
            <p className="text-[10px] text-zinc-700 mt-1 uppercase tracking-tighter">Engine checks pulse every 60s</p>
          </div>
        )}
      </CardContent>
      
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </Card>
  )
}
