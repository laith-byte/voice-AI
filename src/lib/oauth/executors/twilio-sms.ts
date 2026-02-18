import { sendSms, getTwilioClient } from "@/lib/twilio";

interface CallLog {
  id: string;
  retell_call_id: string;
  from_number: string | null;
  to_number: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  summary: string | null;
  started_at: string | null;
  ended_at: string | null;
  post_call_analysis: unknown;
}

interface AppointmentData {
  date?: string;
  time?: string;
  datetime?: string;
  service?: string;
  provider?: string;
  location?: string;
}

function extractAppointment(
  postCallAnalysis: unknown
): AppointmentData | null {
  if (!postCallAnalysis || typeof postCallAnalysis !== "object") return null;

  const analysis = postCallAnalysis as Record<string, unknown>;

  // Check common shapes: direct fields or nested under "appointment"
  const source = (analysis.appointment as Record<string, unknown>) || analysis;

  const date = source.date || source.appointment_date;
  const time = source.time || source.appointment_time;
  const datetime = source.datetime || source.appointment_datetime;

  if (!date && !datetime) return null;

  return {
    date: date as string | undefined,
    time: time as string | undefined,
    datetime: datetime as string | undefined,
    service: (source.service || source.service_type) as string | undefined,
    provider: (source.provider || source.provider_name) as string | undefined,
    location: (source.location || source.address) as string | undefined,
  };
}

function formatAppointmentTime(appt: AppointmentData): string {
  if (appt.datetime) {
    const d = new Date(appt.datetime);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return appt.datetime;
  }
  const parts = [appt.date, appt.time].filter(Boolean);
  return parts.join(" at ");
}

export async function executeTwilioSms(
  callLog: CallLog,
  _clientId: string,
  config: Record<string, unknown>
): Promise<void> {
  const phone = (config.reminder_phone as string) || callLog.from_number;
  if (!phone) return;

  const businessName = (config.business_name as string) || "Our office";
  const includeConfirmation = config.include_confirmation !== false;
  const reminderHoursBefore = Number(config.reminder_hours_before) || 24;

  const appointment = extractAppointment(callLog.post_call_analysis);

  // Send confirmation SMS
  if (includeConfirmation) {
    let confirmationMsg: string;
    if (appointment) {
      const timeStr = formatAppointmentTime(appointment);
      const parts = [
        `Your appointment with ${businessName} is confirmed for ${timeStr}.`,
        appointment.service && `Service: ${appointment.service}`,
        appointment.location && `Location: ${appointment.location}`,
      ];
      confirmationMsg = parts.filter(Boolean).join("\n");
    } else {
      confirmationMsg = `Thank you for calling ${businessName}! We look forward to assisting you.`;
    }

    await sendSms(phone, confirmationMsg);
  }

  // Schedule reminder SMS if we have appointment data
  if (!appointment) return;

  const appointmentTime = appointment.datetime
    ? new Date(appointment.datetime)
    : appointment.date
      ? new Date(`${appointment.date}${appointment.time ? ` ${appointment.time}` : ""}`)
      : null;

  if (!appointmentTime || isNaN(appointmentTime.getTime())) return;

  const reminderTime = new Date(
    appointmentTime.getTime() - reminderHoursBefore * 60 * 60 * 1000
  );

  // Reminder must be at least 15 min in the future (Twilio requirement)
  if (reminderTime.getTime() < Date.now() + 15 * 60 * 1000) return;

  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!messagingServiceSid) return; // Can't schedule without messaging service

  const client = getTwilioClient();
  if (!client) return;

  const timeStr = formatAppointmentTime(appointment);
  const reminderMsg = `Reminder: You have an appointment with ${businessName} on ${timeStr}. We look forward to seeing you!`;

  await client.messages.create({
    body: reminderMsg,
    messagingServiceSid,
    to: phone,
    scheduleType: "fixed",
    sendAt: reminderTime,
  });
}
