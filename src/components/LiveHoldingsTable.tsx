"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface Holding {
  symbol: string
  qty: string | number
  price: string | number
  invested: string | number
}

interface LiveHoldingsTableProps {
  initialHoldings: Holding[]
}

export function LiveHoldingsTable({ initialHoldings }: LiveHoldingsTableProps) {
  const [holdings, setHoldings] = useState<Holding[]>(initialHoldings)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    // Determine WebSocket URL from base HTTP URL
    const rawBase = process.env.NEXT_PUBLIC_AWS_IP || "http://localhost:8000"
    const baseIP = rawBase.replace(/\/$/, '') 
    const wsBase = baseIP.replace(/^http/, 'ws')
    const wsUrl = `${wsBase}/ws/live-prices`

    let socket: WebSocket | null = null
    let reconnectInterval: NodeJS.Timeout
    let pollingInterval: NodeJS.Timeout

    const startPolling = () => {
      console.log("[LiveHoldings] 🔄 Falling back to Smart Polling (Mixed Content or WS Failure).")
      if (pollingInterval) clearInterval(pollingInterval)
      pollingInterval = setInterval(async () => {
        try {
          // Import dynamic to avoid build issues
          const { fetchBreezeData } = await import("@/app/actions")
          const data = await fetchBreezeData('/portfolio/holdings')
          if (data && data.Success) {
            const list = Array.isArray(data.Success) ? data.Success : [data.Success]
            setHoldings(list.map((h: any) => ({
                symbol: h.stock_code || h.symbol || h.stockCode,
                qty: h.quantity || h.holding_quantity || h.qty,
                price: h.current_market_price || h.last_traded_price || h.ltp,
                invested: h.average_price || h.avg_price
            })))
          }
        } catch (e) {
          console.error("[LiveHoldings] Polling error:", e)
        }
      }, 7000) // Poll every 7s as a safe fallback
    }

    const connect = () => {
      // Logic for Mixed Content Detection
      if (window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
        console.warn("[LiveHoldings] ⚠️ Insecure WebSocket blocked by HTTPS protocol. Initiating fallback.")
        setStatus('disconnected')
        startPolling()
        return
      }

      console.log(`[LiveDashboard] Connecting to WebSocket: ${wsUrl}`)
      try {
        socket = new WebSocket(wsUrl)
        
        socket.onopen = () => {
          console.log("[LiveDashboard] ✅ WebSocket Connected Successfully.")
          setStatus('connected')
          if (pollingInterval) clearInterval(pollingInterval)
        }

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === "TICK") {
              const { stock_code, price } = message
              setHoldings(prev => prev.map(h => 
                h.symbol === stock_code ? { ...h, price } : h
              ))
            } else if (message.type === "INIT_PRICES") {
              const initPrices = message.data
              setHoldings(prev => prev.map(h => 
                initPrices[h.symbol] ? { ...h, price: initPrices[h.symbol] } : h
              ))
            }
          } catch (err) {}
        }

        socket.onclose = () => {
          if (socket?.readyState !== WebSocket.CLOSED) return
          setStatus('disconnected')
          reconnectInterval = setTimeout(connect, 5000)
          startPolling() // Start polling while trying to reconnect
        }

        socket.onerror = (error) => {
          console.error("[LiveHoldings] WS Error:", error)
          startPolling()
        }
      } catch (e) {
        console.error("[LiveHoldings] Connection setup failed:", e)
        startPolling()
      }
    }

    connect()

    return () => {
      socket?.close()
      if (reconnectInterval) clearTimeout(reconnectInterval)
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [])

  if (!holdings || holdings.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-zinc-500 text-sm">
        No holdings available.
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Connection Status Indicator */}
      <div className="absolute -top-12 right-6 flex items-center gap-2 px-3 py-1 bg-zinc-900/50 rounded-full border border-zinc-800 backdrop-blur-sm z-10">
        <div className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : status === 'connecting' ? 'bg-amber-500 animate-bounce' : 'bg-rose-500'}`} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
          WS: {status}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-500 py-4 px-6 text-xs uppercase tracking-wider">Stock</TableHead>
            <TableHead className="text-zinc-500 py-4 text-xs uppercase tracking-wider">Qty</TableHead>
            <TableHead className="text-zinc-500 py-4 text-xs uppercase tracking-wider text-right">LTP</TableHead>
            <TableHead className="text-zinc-500 py-4 text-xs uppercase tracking-wider text-right px-6">Return</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((hold: any, i: number) => {
            const qty = parseFloat(hold.qty) || 0
            const price = parseFloat(hold.price) || 0
            const invested = parseFloat(hold.invested) || price
            const pnl = qty * (price - invested)
            const pnlPercent = invested > 0 ? ((price - invested) / invested * 100) : 0

            return (
              <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                <TableCell className="font-medium text-zinc-200 px-6">
                  {hold.symbol || 'N/A'}
                </TableCell>
                <TableCell className="text-zinc-400">{hold.qty || 0}</TableCell>
                <TableCell className={`text-right font-mono transition-all duration-300 ${price > 0 ? 'text-blue-400' : 'text-zinc-300'} ${status === 'connected' ? 'scale-105' : ''}`}>
                  ₹{price > 0 ? price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '--'}
                </TableCell>
                <TableCell className={`text-right px-6 font-mono text-xs ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  <div className="flex flex-col items-end">
                    <span className="flex items-center gap-1">
                      {pnl >= 0 ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
                      ₹{Math.abs(pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
