import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from 'convex/values';

declare const process: { env: Record<string, string | undefined> };

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({
    profile(params) {
      const email = String(params.email ?? '').trim();
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ConvexError('Please enter a valid email address.');
      }
      if (params.flow === 'signUp') {
        const normalized = email.toLowerCase();
        const reserved = [
          [process.env.SUPER_ADMIN_EMAIL, process.env.SUPER_ADMIN_PASSWORD],
          [process.env.TESTER_EMAIL, process.env.TESTER_PASSWORD]
        ];
        for (const [address, secret] of reserved) {
          if (address?.trim().toLowerCase() === normalized && (!secret || params.password !== secret)) {
            throw new ConvexError('This account is provisioned by the administrator. Please use the issued credentials.');
          }
        }
      }
      return { email: params.flow === 'signUp' ? email.toLowerCase() : email };
    }
  })],
});
