export async function logEvent(
  accessToken: string,
  event_type: string,
  event_props?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ event_type, event_props: event_props ?? {} }),
    });
  } catch {
    /* fire-and-forget */
  }
}
