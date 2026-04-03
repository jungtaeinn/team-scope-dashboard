import nodemailer from 'nodemailer';
import { betterAuth } from 'better-auth';
import { magicLink, organization } from 'better-auth/plugins';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { passkey } from '@better-auth/passkey';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';

function getBaseUrl() {
  return process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function getAuthSecret() {
  return process.env.BETTER_AUTH_SECRET ?? 'dev-only-better-auth-secret-change-me-before-production';
}

async function sendMagicLinkEmail(email: string, url: string) {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const from = process.env.SMTP_FROM?.trim() || 'TeamScope <no-reply@teamscope.local>';

  if (!host || !user || !pass) {
    console.info(`[Auth] Magic link for ${email}: ${url}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'TeamScope 로그인 링크',
    text: `아래 링크로 로그인하세요.\n\n${url}`,
    html: `<p>아래 링크로 로그인하세요.</p><p><a href="${url}">${url}</a></p>`,
  });
}

export const auth = betterAuth({
  baseURL: getBaseUrl(),
  secret: getAuthSecret(),
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
    usePlural: false,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  trustedOrigins: Array.from(
    new Set([
      getBaseUrl(),
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]),
  ),
  plugins: [
    nextCookies(),
    organization({
      allowUserToCreateOrganization: false,
    }),
    magicLink({
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
    passkey({
      rpName: 'TeamScope',
      origin: getBaseUrl(),
      rpID: (() => {
        try {
          return new URL(getBaseUrl()).hostname;
        } catch {
          return 'localhost';
        }
      })(),
    }),
  ],
});
