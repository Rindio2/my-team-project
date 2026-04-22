async function parseApiResponse(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `API request failed with status ${response.status}.`);
  }

  return payload;
}

async function getJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  });

  return parseApiResponse(response);
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return parseApiResponse(response);
}

export function getPlatformStatus() {
  return getJson('/api/status');
}

export function submitLeadCapture(payload) {
  return postJson('/api/leads', payload);
}

export function sendOperationalReportEmail(payload) {
  return postJson('/api/report-email', payload);
}
