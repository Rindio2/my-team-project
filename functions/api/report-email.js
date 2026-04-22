import {
  getBackendCapabilitySnapshot,
  handleOptions,
  insertSupabaseRow,
  isValidEmail,
  json,
  rejectDisallowedOrigin,
  readJsonBody,
  sendResendEmail,
  stripHtml,
} from './_shared.js';

export function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  try {
    const blocked = rejectDisallowedOrigin(context.request, context.env);
    if (blocked) return blocked;

    const backend = getBackendCapabilitySnapshot(context.env);
    if (!backend.capabilities.reportEmail) {
      return json(
        {
          ok: false,
          error: 'Executive report email đang bị khóa. Cần cấu hình RESEND_API_KEY và RESEND_FROM_EMAIL.',
        },
        { status: 503, request: context.request, env: context.env }
      );
    }

    const payload = await readJsonBody(context.request);
    const recipientEmail = String(payload?.recipientEmail || '').trim();
    const subject = String(payload?.subject || '').trim() || 'Packet Opt Executive Report';
    const html = String(payload?.html || '').trim();

    if (!isValidEmail(recipientEmail)) {
      return json(
        { ok: false, error: 'Recipient email is required and must be valid.' },
        { status: 400, request: context.request, env: context.env }
      );
    }

    if (!html) {
      return json(
        { ok: false, error: 'Report HTML is required.' },
        { status: 400, request: context.request, env: context.env }
      );
    }

    const emailResult = await sendResendEmail({
      env: context.env,
      to: recipientEmail,
      subject,
      html,
      text: stripHtml(html),
      replyTo: context.env.CRM_RECIPIENT_EMAIL || undefined,
    });

    const logResult = await insertSupabaseRow({
      env: context.env,
      table: 'report_deliveries',
      row: {
        recipient_email: recipientEmail,
        subject,
        summary: payload?.summary || {},
        context: payload?.context || {},
        provider_message_id: emailResult?.id || null,
        created_at: new Date().toISOString(),
      },
    }).catch(() => ({ skipped: true, data: null }));

    return json({
      ok: true,
      messageId: emailResult?.id || null,
      logged: !logResult.skipped,
    }, { request: context.request, env: context.env });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Report email workflow failed.',
      },
      { status: 500, request: context.request, env: context.env }
    );
  }
}
