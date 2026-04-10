"use client"

import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ShieldCheck, LogIn } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4 font-sans text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-zinc-800 bg-[#121212]/50 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 mb-4">
              <ShieldCheck className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              AI Trading Terminal
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Authorized access only. Secure Google OAuth required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              size="lg"
              className="w-full bg-white text-black hover:bg-zinc-200 transition-all font-medium py-6"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>
            <p className="mt-6 text-center text-xs text-zinc-600">
              Attempting to sign in with an unauthorized email will result in an access error.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
