import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Activity, Power, TrendingUp, History, User, Wallet, Briefcase, BarChart3, Clock, AlertTriangle, CheckCircle2, Eye } from "lucide-react"
import { SessionManager } from "@/components/SessionManager"
import { AIControlPanel } from "@/components/AIControlPanel"
import { LiveHoldingsTable } from "@/components/LiveHoldingsTable"
import { LivePositionsTable } from "@/components/LivePositionsTable"
import { AgentBrain } from "@/components/AgentBrain"
import Link from 'next/link';

import { fetchBreezeData, fetchTradeLogs } from "../actions"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  // Fetch all endpoints in parallel for performance
  const [status, profile, fundsData, holdingsData, positionsData, tradingStatusData, tradeLogs, insightsData] = await Promise.all([
    fetchBreezeData('/health'),
    fetchBreezeData('/profile'),
    fetchBreezeData('/funds'),
    fetchBreezeData('/portfolio/holdings'),
    fetchBreezeData('/portfolio/positions'),
    fetchBreezeData('/trading/status'),
    fetchTradeLogs(),
    fetchBreezeData('/trading/insights')
  ])

  // Helper to extract a single property with multiple fallbacks
  const getVal = (obj: any, keys: string[]) => {
    if (!obj) return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return null;
  };

  // Helper to extract data from Breeze's varied response formats (List or Object)
  const extractData = (data: any) => {
    if (!data) return null;
    const success = data.Success || data;
    return Array.isArray(success) ? success[0] : success;
  };

  // Helper to extract a list of items (Holdings/Positions)
  const extractList = (data: any) => {
    if (!data) return [];
    const success = data.Success || data;
    return Array.isArray(success) ? success : [success].filter(i => i && typeof i === 'object' && Object.keys(i).length > 0);
  };

  const rawFunds = extractData(fundsData) || {};
  const rawHoldings = extractList(holdingsData);
  const rawPositions = extractList(positionsData);
  const profileDetails = extractData(profile) || {};

  // Map fields with robust fallbacks
  const funds = {
    balance: getVal(rawFunds, ['total_bank_balance', 'available_margin', 'available_limit', 'cash_balance', 'bank_balance']) || '0.00',
    margin: getVal(rawFunds, ['unallocated_balance', 'margin_limit', 'total_margin', 'margin_available']) || '0.00',
    utilised: getVal(rawFunds, ['allocated_fno', 'margin_utilised', 'utilised_margin']) || '0.00'
  };

  const holdings = rawHoldings.map((h: any) => ({
    symbol: getVal(h, ['stock_code', 'symbol', 'stockCode', 'scrip_name']),
    qty: getVal(h, ['quantity', 'holding_quantity', 'qty', 'holding_qty']),
    price: getVal(h, ['current_market_price', 'last_traded_price', 'ltp', 'current_price', 'avg_price']),
    invested: getVal(h, ['average_price', 'avg_price', 'cost_price', 'purchase_price'])
  }));

  // Calculate Demat Summary
  const dematSummary = holdings.reduce((acc: any, h: any) => {
    const qty = parseFloat(h.qty) || 0;
    const price = parseFloat(h.price) || 0;
    const invested = parseFloat(h.invested) || price; // Fallback to current price if cost unknown
    acc.invested += qty * invested;
    acc.current += qty * price;
    return acc;
  }, { invested: 0, current: 0 });

  const positions = rawPositions
    .filter((p: any) => {
      const qty = parseFloat(getVal(p, ['quantity', 'qty', 'net_qty', 'position_qty']) || '0');
      return qty !== 0;
    })
    .map((p: any) => {
      const sym = getVal(p, ['stock_code', 'symbol', 'stockCode', 'scrip_name']) || '';
      return {
        symbol: sym,
        base_symbol: p.base_symbol || sym.split(' ')[0],
        qty: getVal(p, ['quantity', 'qty', 'position_qty']),
        price: getVal(p, ['last_traded_price', 'ltp', 'current_price', 'price']),
        segment: getVal(p, ['segment', 'product_type', 'instrument_type']),
        action: getVal(p, ['action', 'transaction_type', 'side']),
        average_price: getVal(p, ['average_price', 'avg_price', 'entry_price', 'purchase_price'])
      };
    });

  const userName = getVal(profileDetails, ['customer_name', 'client_name', 'name']) || session.user?.email || "Trader"
  const accountId = getVal(profileDetails, ['account_id', 'client_id', 'id']) || "A/C ••••"
  const isBreezeActive = status?.breeze_session === true

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6 pb-20">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <TrendingUp className="text-blue-500 h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">
              Trading Control Center
            </h1>
            <p className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
              <Activity className={`h-3 w-3 ${status ? 'text-green-500' : 'text-red-500'}`} />
              {status ? `Monitoring Engine Active` : 'Engine Offline'} • {accountId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/dashboard/data">
            <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 shadow-sm rounded-full px-5">
              <BarChart3 className="h-4 w-4 mr-2" />
              Get Data
            </Button>
          </Link>
          <form action={async () => { "use server"; await signOut(); }}>
            <Button variant="outline" size="sm" className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 shadow-sm rounded-full px-5">
              <Power className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {/* New Session Manager Component */}
        <SessionManager isSessionActive={isBreezeActive} accountId={accountId} />

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex flex-col gap-6 lg:col-span-1">
             <AIControlPanel initialStatus={tradingStatusData} />
             
             <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg relative overflow-hidden">
              {!isBreezeActive && (
                <div className="absolute top-0 right-0 p-2">
                  <div className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              )}
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
                <CardTitle className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Session Status</CardTitle>
                <Activity className={`h-4 w-4 ${isBreezeActive ? 'text-green-500' : 'text-red-500'}`} />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className={`text-2xl font-bold ${isBreezeActive ? 'text-white' : 'text-zinc-500'}`}>
                  {isBreezeActive ? 'ACTIVE' : 'EXPIRED'}
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-tight flex items-center gap-1.5">
                  {isBreezeActive ? (
                    <><CheckCircle2 className="h-3 w-3 text-green-500" /> Authentically Connected</>
                  ) : (
                    <><AlertTriangle className="h-3 w-3 text-red-500" /> Daily token required</>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <AgentBrain initialInsights={insightsData} />
          </div>

          <div className="flex flex-col gap-6 lg:col-span-1">
            <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
                <CardTitle className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  {rawFunds.bank_account === "PAPER_MODE" ? "Paper Capital" : "Available Funds"}
                </CardTitle>
                <Wallet className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold text-white">
                  {funds?.balance ? `₹${parseFloat(funds.balance).toLocaleString('en-IN')}` : '₹0.00'}
                </div>
                <p className="text-xs text-emerald-500/70 mt-2 font-mono flex items-center gap-1">
                  Utilised: {funds?.utilised ? `₹${funds.utilised}` : '₹0.00'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-3 px-4">
                <CardTitle className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Active Positions</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold text-white">
                  {Array.isArray(positions) ? positions.length : 0}
                </div>
                <p className="text-xs text-blue-500/70 mt-2 font-mono flex items-center gap-1">
                  Open Intraday & Derivates
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Trade Audit Log - Moved up for priority */}
        <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <History className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-base text-white">AI Execution Audit</CardTitle>
                <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">All Paper/Live Trades Taken By AI</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-500">Live Updated</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800/50 hover:bg-transparent">
                  <TableHead className="text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Time</TableHead>
                  <TableHead className="text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Symbol</TableHead>
                  <TableHead className="text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Action</TableHead>
                  <TableHead className="text-right text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Qty</TableHead>
                  <TableHead className="text-right text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Price</TableHead>
                  <TableHead className="text-right text-zinc-500 font-medium text-[10px] uppercase tracking-wider hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(tradeLogs) && tradeLogs.length > 0 ? (
                  tradeLogs.map((trade: any, i: number) => (
                    <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                      <TableCell className="text-xs font-mono text-zinc-400">
                        <div className="flex flex-col gap-0.5">
                           <span>{new Date(trade.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           <span className="text-[9px] text-zinc-600 font-sans uppercase tracking-tighter">{new Date(trade.timestamp).toLocaleDateString([], {day: '2-digit', month: 'short'})}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-white">{trade.symbol}</div>
                        <div className="text-[10px] text-zinc-500">{trade.mode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-bold ${trade.action.toUpperCase() === 'BUY' ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'}`}>
                          {trade.action.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-white">{trade.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-zinc-300">₹{parseFloat(trade.price).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-[10px] text-zinc-500 tracking-wider hidden md:table-cell">
                        <div className="flex flex-col items-end">
                          <span className={`${trade.status === 'FAILED' ? 'text-rose-500 font-bold' : ''}`}>
                            {trade.status || 'SENT'}
                          </span>
                          {trade.status === 'FAILED' && trade.reasoning && (
                            <span className="text-[8px] text-rose-500/70 mt-0.5 max-w-[150px] truncate" title={trade.reasoning}>
                              {trade.reasoning}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-sm text-zinc-500 border-none">
                      No trades orchestrated today.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Data Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Active Positions */}
          <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg col-span-1">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/50 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <BarChart3 className="h-4 w-4 text-indigo-400" />
                </div>
                <CardTitle className="text-base text-white">Live Positions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <LivePositionsTable initialPositions={positions} />
            </CardContent>
          </Card>

          {/* Portfolio Holdings */}
          <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg col-span-1 group hover:border-emerald-500/30 transition-all cursor-pointer">
            <Link href="/dashboard/holdings">
              <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 group-hover:bg-emerald-500/10 transition-colors">
                    <Briefcase className="h-4 w-4 text-sky-400 group-hover:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      Demat Holdings
                      <Eye className="h-3 w-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardTitle>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
                    <span>Inv: ₹{dematSummary.invested.toLocaleString('en-IN')}</span>
                    <span className="text-zinc-700">|</span>
                    <span>Val: ₹{dematSummary.current.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-zinc-400">Total: {holdings.length}</p>
                <p className={`text-[10px] font-mono ${dematSummary.current >= dematSummary.invested ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {dematSummary.invested > 0 ? ((dematSummary.current - dematSummary.invested) / dematSummary.invested * 100).toFixed(2) : '0.00'}%
                </p>
              </div>
            </CardHeader>
            </Link>
            <CardContent className="p-0">
              <LiveHoldingsTable initialHoldings={holdings.slice(0, 5)} />
              {Array.isArray(holdings) && holdings.length > 5 && (
                <div className="p-4 border-t border-zinc-800/50 text-center">
                   <Link href="/dashboard/holdings" className="text-xs text-zinc-500 hover:text-white transition-colors">View All Holdings</Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Tables Section */}
      </main>
    </div>
  );
}

function ShieldCheck(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
