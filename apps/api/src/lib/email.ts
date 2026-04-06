import { Resend } from 'resend';
import { config } from './env';
import { getConfig } from '../services/appConfig.service';

async function getResendClient(): Promise<Resend> {
  const dbKey = await getConfig('RESEND_API_KEY');
  return new Resend(dbKey || config.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = await getResendClient();
  await resend.emails.send({
    from: 'FunnelOrders <noreply@funnelorders.com>',
    to,
    subject: 'Reset your FunnelOrders password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your FunnelOrders password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
        <p style="margin-top:24px;color:#6b7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendRoutingFailureEmail(
  to: string,
  data: { orderId: string; destination: string; errorMessage: string; firstName: string },
): Promise<void> {
  const resend = await getResendClient();
  const shortId = data.orderId.slice(0, 8).toUpperCase();
  await resend.emails.send({
    from: 'FunnelOrders <noreply@funnelorders.com>',
    to,
    subject: `⚠️ Order routing failed — ${shortId}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:.05em;">Routing Failed</p>
          <h2 style="margin:0;font-size:20px;">Order ${shortId} could not be routed</h2>
        </div>
        <p>Hi ${data.firstName},</p>
        <p>An order failed to route to <strong>${data.destination}</strong> after all retry attempts were exhausted.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 0;color:#6b7280;width:140px;">Order ID</td>
            <td style="padding:10px 0;font-family:monospace;">${data.orderId}</td>
          </tr>
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px 0;color:#6b7280;">Destination</td>
            <td style="padding:10px 0;">${data.destination}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#6b7280;">Error</td>
            <td style="padding:10px 0;color:#dc2626;">${data.errorMessage}</td>
          </tr>
        </table>
        <p>You can retry this order manually from your FunnelOrders dashboard.</p>
        <a href="${config.APP_URL}/orders" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">View Orders</a>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">
          You're receiving this because routing failure alerts are enabled in your profile.<br>
          <a href="${config.APP_URL}/settings/profile" style="color:#6366f1;">Manage notification settings</a>
        </p>
      </div>
    `,
  });
}
