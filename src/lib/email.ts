import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

// Resend's shared test sender until the app has its own domain.
const FROM = "Task Master <onboarding@resend.dev>";

interface LinkEmail {
  to: string;
  subject: string;
  intro: string;
  linkLabel: string;
  url: string;
  expiry: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Plain email: one sentence, the link, and when it expires.
export function renderLinkEmail({ intro, linkLabel, url, expiry }: Omit<LinkEmail, "to" | "subject">) {
  const text = `${intro}\n\n${url}\n\n${expiry} If you didn't ask for this, you can ignore this email.`;
  const href = escapeHtml(url);
  const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#1f2937">
<p>${escapeHtml(intro)}</p>
<p><a href="${href}">${escapeHtml(linkLabel)}</a></p>
<p style="color:#6b7280;font-size:13px">${escapeHtml(expiry)} If you didn't ask for this, you can ignore this email.<br>Link not working? Paste this into your browser: ${href}</p>
</div>`;
  return { text, html };
}

async function sendLinkEmail({ to, subject, ...content }: LinkEmail) {
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to, subject, ...renderLinkEmail(content) });
  if (error) throw new Error(`Resend failed to send "${subject}": ${error.message}`);
}

export function sendVerificationEmail(to: string, url: string) {
  return sendLinkEmail({
    to,
    subject: "Verify your email for Task Master",
    intro: "Confirm your email address to finish setting up your Task Master account.",
    linkLabel: "Verify email",
    url,
    expiry: "This link expires in 1 hour.",
  });
}

export function sendPasswordResetEmail(to: string, url: string) {
  return sendLinkEmail({
    to,
    subject: "Reset your Task Master password",
    intro: "Use the link below to choose a new password for your Task Master account.",
    linkLabel: "Reset password",
    url,
    expiry: "This link expires in 1 hour.",
  });
}
