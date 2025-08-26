import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async signIn({ user }) {
      return user.email?.endsWith('@coder.com') || false
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export default handler
export { handler as GET, handler as POST }
