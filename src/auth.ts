import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const ALLOWED_EMAILS = [
  "gidayajuvendrasinh@gmail.com",
  "yajuvendragida@gmail.com"
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      if (!user.email || !ALLOWED_EMAILS.includes(user.email)) {
        console.warn(`Blocked unauthorized login attempt: ${user.email}`)
        return false // Deny access
      }
      return true // Allow access
    },
    async session({ session, token }) {
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
})
