"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface Position {
  symbol: string
  base_symbol?: string // Added for better matching
  qty: string | number
  price: string | number
  segment?: string
  action?: string
  average_price?: string | number
}

interface LivePositionsTableProps {
  initialPositions: Position[]
}

export function LivePositionsTable({ initialPositions }: LivePositionsTableProps) {
  const [positions, setPositions] = useState<Position[]>(initialPositions)

  useEffect(() => {
    const rawBase = process.env.NEXT_PUBLIC_AWS_IP || "http://localhost:8000"
    const baseIP = rawBase.replace(/\/$/, '')
    const wsBase = baseIP.replace(/^http/, 'ws')
    const wsUrl = `${wsBase}/ws/live-prices`

    let socket: WebSocket | null = null

    const connect = () => {
      socket = new WebSocket(wsUrl)
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === "TICK") {
            const { stock_code, price } = message
            // Normalize incoming stock_code (e.g., CNXBAN -> BANKNIFTY) for frontend matching
            const normalizedCode = stock_code === 'CNXBAN' ? 'BANKNIFTY' : stock_code;
            
            setPositions(prev => prev.map(p => {
              const isMatch = p.symbol === normalizedCode || 
                              p.base_symbol === normalizedCode ||
                              p.symbol === stock_code ||
                              p.base_symbol === stock_code ||
                              (p.symbol && p.symbol.startsWith(normalizedCode));
              return isMatch ? { ...p, price } : p;
            }))
          }
        } catch (e) {}
      }
      socket.onclose = () => setTimeout(connect, 3000)
    }

    connect()
    return () => socket?.close()
  }, [])

  if (!positions || positions.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-zinc-500 text-sm">
        No active positions found.
      </div>
    )
  }

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-500 py-4 px-4 text-[10px] uppercase tracking-wider">Asset</TableHead>
            <TableHead className="text-zinc-500 py-4 text-[10px] uppercase tracking-wider">Side</TableHead>
            <TableHead className="text-zinc-500 py-4 text-[10px] uppercase tracking-wider">Qty</TableHead>
            <TableHead className="text-zinc-500 py-4 text-[10px] uppercase tracking-wider">Avg. Price</TableHead>
            <TableHead className="text-zinc-500 py-4 text-[10px] uppercase tracking-wider">LTP</TableHead>
            <TableHead className="text-zinc-500 py-4 text-[10px] uppercase tracking-wider text-right px-4">P&L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((pos: any, i: number) => {
            const ltp = parseFloat(pos.price) || 0;
            const avg = parseFloat(pos.average_price) || ltp;
            const qty = parseFloat(pos.qty) || 0;
            const pnl = (ltp - avg) * qty;

            const symbolParts = (pos.symbol || '').split(' ');
            const mainSymbol = symbolParts[0];
            const expiryPart = symbolParts.slice(1).join(' ');

            return (
              <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                <TableCell className="px-4 py-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-xs leading-tight">{mainSymbol}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">{expiryPart}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                   <Badge variant="outline" className={`text-[9px] h-5 px-1.5 uppercase font-bold ${pos.action === 'Short' ? 'border-rose-500/30 text-rose-500 bg-rose-500/5' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'}`}>
                      {pos.action || 'Long'}
                    </Badge>
                </TableCell>
                <TableCell className="text-zinc-300 font-mono text-xs py-2">{pos.qty || 0}</TableCell>
                <TableCell className="text-zinc-400 font-mono text-[10px] py-2">₹{avg.toLocaleString('en-IN')}</TableCell>
                <TableCell className="text-zinc-300 font-mono text-[10px] py-2">₹{ltp.toLocaleString('en-IN')}</TableCell>
                <TableCell className={`text-right font-bold font-mono px-4 py-2 text-xs ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
