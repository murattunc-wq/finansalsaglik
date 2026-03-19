import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getSupabaseAdmin } from '@/lib/db';
import bcrypt from 'bcryptjs';

interface DBUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  provider: string;
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'E-posta', type: 'email' },
        password: { label: 'Şifre',   type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const sb = getSupabaseAdmin() as any;
        const { data } = await sb.from('users').select('*').eq('email', credentials.email).single();
        const user = data as DBUser | null;
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const sb = getSupabaseAdmin() as any;
        await sb.from('users').upsert({
          id: user.email,
          email: user.email,
          name: user.name || '',
          provider: 'google',
        }, { onConflict: 'email' });
      }
      return true;
    },
    async session({ session }) { return session; },
    async jwt({ token }) { return token; },
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
