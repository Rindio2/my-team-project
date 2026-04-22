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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildLeadEmailHtml(payload) {
  return `
    <div style="font-family:Segoe UI,Tahoma,sans-serif;line-height:1.65;color:#0f172a;">
      <h2 style="margin:0 0 12px;">Lead mới từ Packet Opt Control Tower</h2>
      <p style="margin:0 0 12px;">Một lead mới vừa đi vào CRM workflow từ app commercial demo.</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;">
        <tbody>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><b>Name</b></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.name || '-')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><b>Email</b></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.email)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><b>Company</b></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.company || '-')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><b>Message</b></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.message || '-')}</td></tr>
          <tr><td style="padding:8px;border:1px solid #cbd5e1;"><b>Source</b></td><td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(payload.source || 'packet-opt-control-tower')}</td></tr>
        </tbody>
      </table>
      <pre style="margin-top:16px;padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;overflow:auto;">${escapeHtml(JSON.stringify(payload.context || {}, null, 2))}</pre>
    </div>
  `;
}

export function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  try {
    const blocked = rejectDisallowedOrigin(context.request, context.env);
    if (blocked) return blocked;

    const backend = getBackendCapabilitySnapshot(context.env);
    if (!backend.capabilities.crmLeadPersist && !backend.capabilities.crmLeadNotify) {
      return json(
        {
          ok: false,
          error: 'CRM workflow đang bị khóa. Cần cấu hình Supabase service hoặc Resend + CRM_RECIPIENT_EMAIL.',
        },
        { status: 503, request: context.request, env: context.env }
      );
    }

    const payload = await readJsonBody(context.request);
    const email = String(payload?.email || '').trim();

    if (!isValidEmail(email)) {
      return json(
        { ok: false, error: 'Lead email is required and must be valid.' },
        { status: 400, request: context.request, env: context.env }
      );
    }

    const leadRecord = {
      name: String(payload?.name || '').trim() || null,
      email,
      company: String(payload?.company || '').trim() || null,
      message: String(payload?.message || '').trim() || null,
      source: String(payload?.source || 'packet-opt-control-tower').trim(),
      context: payload?.context || {},
      created_at: new Date().toISOString(),
    };

    const inserted = await insertSupabaseRow({
      env: context.env,
      table: 'crm_leads',
      row: leadRecord,
    }).catch((error) => ({ skipped: false, error }));

    let emailResult = { skipped: true };
    if (context.env.CRM_RECIPIENT_EMAIL) {
      emailResult = await sendResendEmail({
        env: context.env,
        to: context.env.CRM_RECIPIENT_EMAIL,
        subject: `New CRM lead • ${leadRecord.company || leadRecord.email}`,
        html: buildLeadEmailHtml(leadRecord),
        text: stripHtml(buildLeadEmailHtml(leadRecord)),
        replyTo: leadRecord.email,
      }).then((data) => ({ skipped: false, data }));
    }

    if (inserted.error && emailResult.skipped) {
      throw inserted.error;
    }

    return json({
      ok: true,
      persisted: !inserted.skipped && !inserted.error,
      emailNotified: !emailResult.skipped,
      leadId: inserted.data?.[0]?.id || null,
      emailId: emailResult.data?.id || null,
    }, { request: context.request, env: context.env });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Lead workflow failed.',
      },
      { status: 500, request: context.request, env: context.env }
    );
  }
}
