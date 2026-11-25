import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.FROM_EMAIL || 'ETI Hub <hub@eti-trade.com>';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping email to ${payload.to}: ${payload.subject}`);
    return;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  } catch (err) {
    // Email failures never break the main operation
    console.error('[email] Failed to send:', err);
  }
}

// ── Notification email templates ─────────────────────────────────────

export async function sendTaskAssignedEmail(opts: {
  to: string;
  recipientName: string;
  taskTitle: string;
  assignedByName: string;
  taskUrl: string;
}) {
  await sendEmail({
    to: opts.to,
    subject: `New task assigned: ${opts.taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#0f2d5c;">ETI Hub — Task Assigned</h2>
        <p>Hi ${opts.recipientName},</p>
        <p><strong>${opts.assignedByName}</strong> has assigned you a new task:</p>
        <p style="background:#f1f5f9;border-left:4px solid #0f2d5c;padding:12px 16px;border-radius:4px;font-weight:600;">
          ${opts.taskTitle}
        </p>
        <p style="margin:20px 0;">
          <a href="${opts.taskUrl}" style="background:#0f2d5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            View Task
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">— ETI Hub</p>
      </div>
    `,
  });
}

export async function sendTaskUpdatedEmail(opts: {
  to: string;
  recipientName: string;
  taskTitle: string;
  updateDescription: string;
  taskUrl: string;
}) {
  await sendEmail({
    to: opts.to,
    subject: `Task updated: ${opts.taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#0f2d5c;">ETI Hub — Task Updated</h2>
        <p>Hi ${opts.recipientName},</p>
        <p>A task assigned to you has been updated:</p>
        <p style="background:#f1f5f9;border-left:4px solid #0f2d5c;padding:12px 16px;border-radius:4px;">
          <strong>${opts.taskTitle}</strong><br/>
          <span style="color:#64748b;">${opts.updateDescription}</span>
        </p>
        <p style="margin:20px 0;">
          <a href="${opts.taskUrl}" style="background:#0f2d5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            View Task
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">— ETI Hub</p>
      </div>
    `,
  });
}

export async function sendAnnouncementEmail(opts: {
  to: string;
  recipientName: string;
  title: string;
  body: string;
  announcementsUrl: string;
}) {
  await sendEmail({
    to: opts.to,
    subject: `Announcement: ${opts.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#0f2d5c;">ETI Hub — New Announcement</h2>
        <p>Hi ${opts.recipientName},</p>
        <h3 style="margin-bottom:8px;">${opts.title}</h3>
        <p style="color:#334155;white-space:pre-wrap;">${opts.body}</p>
        <p style="margin:20px 0;">
          <a href="${opts.announcementsUrl}" style="background:#0f2d5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            View Announcements
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">— ETI Hub</p>
      </div>
    `,
  });
}

export async function sendNewMessageEmail(opts: {
  to: string;
  recipientName: string;
  senderName: string;
  channelName: string;
  preview: string;
  messagesUrl: string;
}) {
  await sendEmail({
    to: opts.to,
    subject: `New message from ${opts.senderName}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#0f2d5c;">ETI Hub — New Message</h2>
        <p>Hi ${opts.recipientName},</p>
        <p><strong>${opts.senderName}</strong> sent you a message in <strong>${opts.channelName}</strong>:</p>
        <p style="background:#f1f5f9;border-left:4px solid #0f2d5c;padding:12px 16px;border-radius:4px;color:#334155;">
          "${opts.preview}"
        </p>
        <p style="margin:20px 0;">
          <a href="${opts.messagesUrl}" style="background:#0f2d5c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Reply
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">— ETI Hub</p>
      </div>
    `,
  });
}
