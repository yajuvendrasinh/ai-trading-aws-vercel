"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeft, 
  Download, 
  BarChart3, 
  Database, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Search
} from "lucide-react"
import Link from "next/link"
import { downloadHistoricalData, searchSymbols } from "../../actions"

export default function HistoricalDataPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    stock_code: "",
    exchange_code: "NSE",
    product_type: "cash",
    interval: "1minute",
    timeframe: "1month",
    from_date: "", // Defaults handled by backend
    to_date: "",
    expiry_date: "",
    strike_price: "",
    right: ""
  })

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Auto-suggestion logic
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (formData.stock_code.length < 2) {
        setSuggestions([])
        return
      }
      const results = await searchSymbols(formData.stock_code, formData.exchange_code)
      setSuggestions(results)
      setShowSuggestions(true)
    }

    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [formData.stock_code, formData.exchange_code])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      const newData = { ...prev, [name]: value }
      // Auto-switch product type/exchange for common sense
      if (name === "exchange_code") {
        newData.product_type = value === "NFO" ? "Futures" : "cash"
      }
      return newData
    })
  }

  const selectSuggestion = (symbol: string) => {
    setFormData(prev => ({ ...prev, stock_code: symbol }))
    setShowSuggestions(false)
  }

  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [completedJobId, setCompletedJobId] = useState<string | null>(null)
  const [downloadReady, setDownloadReady] = useState(false)

  // Polling logic for jobs
  useEffect(() => {
    let interval: any;
    if (jobId) {
      setDownloadReady(false)
      setCompletedJobId(null)
      interval = setInterval(async () => {
        try {
          const m = await import("../../actions")
          const status = await m.getHistoricalJobStatus(jobId)
          
          if (status) {
            setProgress(status.progress || 0)
            setStatusMessage(status.message || "Working...")
            if (status.status === "COMPLETED") {
              setCompletedJobId(jobId)
              setJobId(null)
              setLoading(false)
              setSuccess(true)
              setDownloadReady(true) 
            } else if (status.status === "FAILED") {
              setJobId(null)
              setLoading(false)
              setError(status.message || "Background job failed.")
            }
          }
        } catch (err) {
          console.error("Polling error:", err)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [jobId])

  const handleDownload = async () => {
    if (!formData.stock_code) {
      setError("Please select a symbol first.")
      return
    }
    if (loading || jobId) return 

    setLoading(true)
    setError(null)
    setSuccess(false)
    setDownloadReady(false)
    setCompletedJobId(null)
    setProgress(0)
    setStatusMessage("Initializing background job...")
    
    try {
      const data = await downloadHistoricalData(formData)
      if (data && data.job_id) {
        setJobId(data.job_id)
      } else {
        throw new Error(data?.detail || "Failed to start background job.")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
      setLoading(false)
    }
  }

  const triggerManualDownload = () => {
    if (completedJobId) {
      // Use the secure internal proxy instead of the direct AWS link
      const downloadUrl = `/api/download/${completedJobId}`
      window.location.href = downloadUrl
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors group">
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Database className="text-blue-500 h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Historical Data Downloader</h1>
              <p className="text-sm text-zinc-500 mt-1">Simpler, faster data fetching with auto-suggestion</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="col-span-1 md:col-span-2 border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg h-fit">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Data Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Symbol with Suggestions */}
              <div className="space-y-2 relative" ref={suggestionRef}>
                <label className="text-xs text-zinc-500 uppercase font-bold ml-1">Symbol Search</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                  <input 
                    name="stock_code"
                    value={formData.stock_code}
                    onChange={handleChange}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                    placeholder="Start typing symbol (e.g. NIFTY, RELIANCE...)"
                    autoComplete="off"
                  />
                </div>
                
                {/* Suggestion Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => selectSuggestion(s.symbol)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-blue-600/10 hover:text-blue-400 flex items-center justify-between border-b border-zinc-800/50 last:border-0 transition-colors"
                      >
                        <span className="font-bold">{s.symbol}</span>
                        <span className="text-[10px] text-zinc-600 uppercase italic">{formData.exchange_code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase font-bold ml-1">Exchange</label>
                  <select 
                    name="exchange_code"
                    value={formData.exchange_code}
                    onChange={handleChange}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none transition-all cursor-pointer"
                  >
                    <option value="NSE">NSE (Cash)</option>
                    <option value="NFO">NFO (Futures & Options)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
                      Sample Rate (Interval)
                    </label>
                    <select
                      value={formData.interval}
                      onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none cursor-pointer"
                    >
                      <option value="1second">1 Second</option>
                      <option value="1minute">1 Minute</option>
                      <option value="5minute">5 Minutes</option>
                      <option value="15minute">15 Minutes</option>
                      <option value="30minute">30 Minutes</option>
                      <option value="1hour">1 Hour</option>
                      <option value="1day">1 Day</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest px-1">
                      History Depth (Timeframe)
                    </label>
                    <select
                      value={formData.timeframe}
                      onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none cursor-pointer"
                    >
                      <option value="1day">1 Day</option>
                      <option value="1week">1 Week</option>
                      <option value="1month">1 Month</option>
                      <option value="3month">3 Months</option>
                      <option value="6month">6 Months</option>
                      <option value="1year">1 Year</option>
                      <option value="2year">2 Years</option>
                      <option value="3year">3 Years</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase font-bold ml-1">Product Type</label>
                  <select 
                    name="product_type"
                    value={formData.product_type}
                    onChange={handleChange}
                    disabled={formData.exchange_code === "NSE"}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none disabled:opacity-50"
                  >
                    {formData.exchange_code === "NSE" ? (
                      <option value="cash">Cash</option>
                    ) : (
                      <>
                        <option value="Futures">Futures</option>
                        <option value="Options">Options</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="pt-6">
                {loading && (
                  <div className="mb-4 px-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        {statusMessage}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleDownload}
                  disabled={loading || !formData.stock_code}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      Processing Download...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5 mr-3" />
                      Download Historical Data
                    </>
                  )}
                </Button>
                
                {downloadReady && (
                  <Button 
                    onClick={triggerManualDownload}
                    className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-14 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] flex items-center justify-center animate-in zoom-in-95 duration-500"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-3" />
                    💾 DOWNLOAD READY - SAVE CSV
                  </Button>
                )}

                {success && !downloadReady && (
                  <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 flex items-center justify-center gap-3 animate-in fade-in duration-300">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Download initialized! Monitoring progress...</span>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 flex items-center justify-center gap-3 animate-in fade-in duration-300">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-zinc-800/50 bg-[#121212]/80 backdrop-blur-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Auto-Data Fetch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We've simplified the process. Dates and F&O specifics are now handled **automatically**.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                    Max History
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-tight">
                    The system fetches the maximum allowed history based on your interval (e.g. 30 days for 1-minute).
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                    Smart Symbol Search
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-tight">
                    Search finds the exact Breeze codes for you. No more guessing symbols.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
