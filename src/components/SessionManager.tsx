"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, ChevronRight, ExternalLink, KeyRound, Loader2, RefreshCcw } from "lucide-react"
import { updateBreezeSession, getBreezeLoginUrl, checkSessionStatus, deepCheckSession } from "@/app/actions"

interface SessionManagerProps {
  isSessionActive: boolean
  accountId: string
}

export function SessionManager({ isSessionActive, accountId }: SessionManagerProps) {
  const [isOpen, setIsOpen] = useState(!isSessionActive)
  const [sessionActive, setSessionActive] = useState(isSessionActive)
  const [token, setToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [expiryReason, setExpiryReason] = useState("")
  const router = useRouter()

  // Active session monitoring: Check every 60s whether the session is TRULY alive
  // This catches mid-day token expiry that the initial server render can't detect
  useEffect(() => {
    // Do an immediate deep check on mount
    const immediateCheck = async () => {
      const result = await deepCheckSession()
      if (!result.active) {
        setSessionActive(false)
        setIsOpen(true)
        setExpiryReason(result.reason)
        console.log(`[SessionManager] Session expired: ${result.reason}`)
      }
    }
    immediateCheck()

    // Then poll every 60 seconds
    const interval = setInterval(async () => {
      const result = await deepCheckSession()
      if (!result.active && sessionActive) {
        // Session just expired!
        setSessionActive(false)
        setIsOpen(true)
        setExpiryReason(result.reason)
      } else if (result.active && !sessionActive) {
        // Session came back (e.g., updated via Telegram)
        setSessionActive(true)
        setIsOpen(false)
        router.refresh()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [sessionActive, router])

  // If session was initially inactive, also do fast polling to detect Telegram-based activation
  useEffect(() => {
    if (sessionActive) return

    const interval = setInterval(async () => {
      const active = await checkSessionStatus()
      if (active) {
        console.log("[SessionPoller] Session detected as active. Refreshing dashboard...")
        setSessionActive(true)
        setIsOpen(false)
        router.refresh()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionActive, router])

  const handleLogin = async () => {
    const url = await getBreezeLoginUrl()
    if (url) {
      window.open(url, "_blank")
    } else {
      alert("Failed to fetch login URL. Please check if the backend is running.")
    }
  }

  const handleUpdate = async () => {
    if (!token.trim()) return
    setIsLoading(true)
    setStatus("idle")
    
    const res = await updateBreezeSession(token.trim())
    
    if (res.success) {
      setStatus("success")
      setToken("")
      setSessionActive(true)
      setTimeout(() => {
        setIsOpen(false)
        setStatus("idle")
        router.refresh()
      }, 2000)
    } else {
      setStatus("error")
      setErrorMessage(res.error || "Failed to update session")
    }
    setIsLoading(false)
  }

  return (
    <div className="w-full">
      <AnimatePresence>
        {!sessionActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <Card className="border-yellow-500/50 bg-yellow-500/5 backdrop-blur-md">
              <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-yellow-500 text-sm">Breeze Session Expired</h3>
                    <p className="text-xs text-yellow-500/70">
                      {expiryReason 
                        ? `Reason: ${expiryReason}` 
                        : 'Please initialize your daily OAuth session to start trading.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLogin}
                    className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    Get Token
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => setIsOpen(true)}
                    className="bg-yellow-500 text-black hover:bg-yellow-400 text-xs"
                  >
                    Initialize Now
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 overflow-hidden"
          >
            <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-xl relative overflow-hidden">
               {status === "success" && (
                <div className="absolute inset-0 bg-emerald-500/10 z-10 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-emerald-500 font-bold">
                    <CheckCircle2 className="h-6 w-6" />
                    Session Active! Restarting Engine...
                  </div>
                </div>
              )}
              
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <KeyRound className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Daily Session Update</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Paste your ICICI Breeze session token below to wake up the bot.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Session Token</label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste apisession token here..."
                        className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-700"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <kbd className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-700">CTRL+V</kbd>
                      </div>
                    </div>
                  </div>

                  {status === "error" && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {errorMessage}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button 
                      onClick={handleLogin}
                      className="text-xs text-zinc-500 hover:text-white flex items-center gap-1.5 transition-colors underline-offset-4 hover:underline"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Get new Login URL
                    </button>
                    <div className="flex items-center gap-3">
                       <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsOpen(false)}
                        className="text-zinc-500 hover:text-white"
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleUpdate}
                        disabled={isLoading || !token.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Activate Session"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
