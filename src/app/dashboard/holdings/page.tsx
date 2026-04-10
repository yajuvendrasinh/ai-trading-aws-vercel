'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Activity,
  ChevronRight,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchBreezeData } from '../../actions';

export default function HoldingsPage() {
  const [mounted, setMounted] = useState(false);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    setMounted(true);
    async function loadData() {
      try {
        const res = await fetchBreezeData('portfolio/holdings');
        const list = res?.Success || [];
        setHoldings(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to load holdings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Polling fallback: Re-fetch holdings every 30s to keep prices fresh
    // even when WebSocket ticks aren't flowing (expired session, market closed, etc.)
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetchBreezeData('portfolio/holdings');
        const list = res?.Success || [];
        if (Array.isArray(list) && list.length > 0) {
          setHoldings(list);
        }
      } catch (err) {
        // Silent fail for polling
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, []);

  // WebSocket for Live Updates
  useEffect(() => {
    if (!mounted) return;

    const rawBase = process.env.NEXT_PUBLIC_AWS_IP || "http://localhost:8000"
    const baseIP = rawBase.replace(/\/$/, '') 
    const wsBase = baseIP.replace(/^http/, 'ws')
    const wsUrl = `${wsBase}/ws/live-prices`

    let socket: WebSocket | null = null
    let reconnectInterval: NodeJS.Timeout

    const connect = () => {
      // PROACTIVELY block insecure WebSocket on HTTPS to avoid console SecurityError
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
      const isInsecureWs = wsUrl.startsWith('ws://')

      if (isHttps && isInsecureWs) {
        console.warn("[HoldingsWS] 🛡️ Secure Protocol: Switching to Smart Polling. (WebSocket requires WSS on HTTPS)")
        // The polling interval is already started in the first useEffect, 
        // but we'll manually trigger one to ensure immediate data.
        return
      }

      console.log(`[HoldingsWS] Attempting connection to: ${wsUrl}`)
      try {
        socket = new WebSocket(wsUrl)

        socket.onopen = () => {
          console.log("[HoldingsWS] ✅ Real-time connection established.")
          setWsStatus('connected')
        }
        
        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === "TICK") {
              const { stock_code, price } = message
              setHoldings(prev => prev.map(h => {
                const symbol = (h.stock_code || h.symbol || h.stockCode || "").split('.')[0]
                if (symbol === stock_code) {
                  return { ...h, current_market_price: price, ltp: price, lastPrice: price }
                }
                return h
              }))
            } else if (message.type === "INIT_PRICES") {
              console.log("[HoldingsWS] 📊 Initial batch received.")
              const initPrices = message.data
              setHoldings(prev => prev.map(h => {
                const symbol = (h.stock_code || h.symbol || h.stockCode || "").split('.')[0]
                if (initPrices[symbol]) {
                  const price = initPrices[symbol]
                  return { ...h, current_market_price: price, ltp: price, lastPrice: price }
                }
                return h
              }))
            }
          } catch (err) {
            console.error("[HoldingsWS] Message error:", err)
          }
        }

        socket.onclose = () => {
          setWsStatus('disconnected')
          reconnectInterval = setTimeout(connect, 3000)
        }
      } catch (err) {
        console.error("[HoldingsWS] WS Exception:", err)
      }
    }

    connect()
    return () => {
      socket?.close()
      clearTimeout(reconnectInterval)
    }
  }, [mounted])

  const getVal = (obj: any, keys: string[]) => {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return null;
  };

  const filteredHoldings = holdings.filter(h => 
    getVal(h, ['stock_code', 'symbol'])?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = filteredHoldings.reduce((acc: any, h: any) => {
    const qty = parseFloat(getVal(h, ['quantity', 'holding_quantity']) || '0');
    const avg = parseFloat(getVal(h, ['average_price', 'avg_price']) || '0');
    const cmp = parseFloat(getVal(h, ['current_market_price', 'ltp']) || '0');
    
    const costValue = qty * avg;
    const currentValue = qty * cmp;
    const pnl = currentValue - costValue;

    acc.invested += costValue;
    acc.current += currentValue;
    acc.pnl += pnl;
    return acc;
  }, { invested: 0, current: 0, pnl: 0 });

  const pnlPercent = stats.invested > 0 ? (stats.pnl / stats.invested * 100) : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-emerald-500 transition-colors group mb-2">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Terminal</span>
            </Link>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <Briefcase className="h-6 w-6 text-emerald-400" />
              </div>
              Demat Portfolio
            </h1>
            <p className="text-zinc-500 text-sm">Detailed analysis of your equity holdings across exchanges.</p>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Filter by symbol..." 
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm w-full md:w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            {/* WS Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800 shadow-inner">
               <div className={`h-1.5 w-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
               <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                 Market Stream: {wsStatus}
               </span>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-[#0a0a0a] border-zinc-800/50 shadow-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase">Total Invested</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">₹{stats.invested.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0a0a0a] border-zinc-800/50 shadow-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase">Current Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">₹{stats.current.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#0a0a0a] border-zinc-800/50 shadow-2xl">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-zinc-500 uppercase">Total Profit/Loss</CardTitle>
              {stats.pnl >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-rose-500" />}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{Math.abs(stats.pnl).toLocaleString('en-IN')} 
                <span className="text-sm ml-2 font-normal opacity-70">({pnlPercent.toFixed(2)}%)</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card className="bg-[#0a0a0a] border-zinc-800/50 shadow-2xl overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-900/30">
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableHead className="text-zinc-500 py-6 px-6 text-xs uppercase font-bold tracking-widest leading-none">Stock Symbol</TableHead>
                <TableHead className="text-zinc-500 py-6 text-xs uppercase font-bold tracking-widest text-right leading-none">Qty</TableHead>
                <TableHead className="text-zinc-500 py-6 text-xs uppercase font-bold tracking-widest text-right leading-none">Avg. Cost</TableHead>
                <TableHead className="text-zinc-500 py-6 text-xs uppercase font-bold tracking-widest text-right leading-none">CMP</TableHead>
                <TableHead className="text-zinc-500 py-6 text-xs uppercase font-bold tracking-widest text-right leading-none">Value (CMP)</TableHead>
                <TableHead className="text-zinc-500 py-6 px-6 text-xs uppercase font-bold tracking-widest text-right leading-none">P&L (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                      <span className="text-zinc-500 text-sm font-mono">Synchronizing Portfolio...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredHoldings.length > 0 ? filteredHoldings.map((h, i) => {
                const qty = parseFloat(getVal(h, ['quantity', 'holding_quantity']) || '0');
                const avg = parseFloat(getVal(h, ['average_price', 'avg_price']) || '0');
                const cmp = parseFloat(getVal(h, ['current_market_price', 'ltp']) || '0');
                const currentVal = qty * cmp;
                const pnl = (cmp - avg) * qty;
                const pnlP = avg > 0 ? ((cmp - avg) / avg * 100) : 0;

                return (
                  <TableRow key={i} className="border-zinc-800/30 hover:bg-zinc-900/40 transition-colors group">
                    <TableCell className="font-bold text-white px-6 py-5">
                      <div className="flex flex-col">
                        <span>{getVal(h, ['stock_code', 'symbol'])}</span>
                        <span className="text-[10px] text-zinc-600 font-normal uppercase">{getVal(h, ['exchange_code'])}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-300">{qty}</TableCell>
                    <TableCell className="text-right font-mono text-zinc-400">₹{avg.toLocaleString('en-IN')}</TableCell>
                    <TableCell className={`text-right font-mono transition-colors duration-500 ${wsStatus === 'connected' ? 'text-emerald-400/90' : 'text-zinc-400'}`}>
                      ₹{cmp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-white">₹{currentVal.toLocaleString('en-IN')}</TableCell>
                    <TableCell className={`text-right font-mono px-6 ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <div className="flex flex-col items-end">
                        <span>{pnl >= 0 ? '+' : '-'}₹{Math.abs(pnl).toLocaleString('en-IN')}</span>
                        <span className="text-[10px] opacity-70">{pnlP.toFixed(2)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-zinc-500 italic">
                    No holdings match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
          <span>Real-time values synchronized with ICICI Direct</span>
          <span>Last sync: {mounted ? new Date().toLocaleTimeString() : '--:--'}</span>
        </div>
      </div>
    </div>
  );
}
