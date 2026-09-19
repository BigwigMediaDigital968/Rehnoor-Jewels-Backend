const sendInvoiceEmail = require("../mail/sendInvoiceEmail");
const sendAdminOrderNotification = require("../mail/sendAdminOrderNotification");
const sendSMSOrderConfirmation = require("./sendSMS");
const sendWhatsappOrderConfirmation = require("./sendWhatsapp.js");

const CHANNELS = ["Customer Email", "Admin Email", "SMS", "WhatsApp"];

/**
 * Sends the four order-confirmation notifications for a single order.
 *
 * `order` must expose the normalised shape used by the notification
 * templates: customerName, customerEmail, customerPhone, orderNumber,
 * items[], pricing{}, payment{}, shippingAddress{}. A Mongoose Order
 * document already satisfies this, as does the payload built by the
 * Shiprocket webhook.
 *
 * Every channel is attempted independently — one failure never blocks the
 * others, and nothing thrown here propagates to the caller.
 *
 * @param {object} order      notification-shaped order
 * @param {object} [options]
 * @param {import("mongoose").Document} [options.markOn]
 *        Order document to stamp with `notificationsSentAt`. When it already
 *        carries a timestamp the dispatch is skipped, which is what keeps the
 *        Razorpay verify call and the Razorpay webhook from double-sending.
 * @returns {Promise<{skipped: boolean, results?: object}>}
 */
async function dispatchOrderNotifications(order, { markOn = null } = {}) {
  const label = order?.orderNumber || markOn?.orderNumber || "unknown";

  if (markOn?.notificationsSentAt) {
    console.log(
      `[Notifications] Already sent for ${label} at ${markOn.notificationsSentAt.toISOString()} — skipping`,
    );
    return { skipped: true };
  }

  // Claim the slot before awaiting any send, so two near-simultaneous
  // callers (verify + webhook) cannot both get past the guard above.
  if (markOn) {
    markOn.notificationsSentAt = new Date();
    try {
      await markOn.save();
    } catch (err) {
      console.error(
        `[Notifications] Could not stamp notificationsSentAt for ${label}:`,
        err.message,
      );
    }
  }

  const settled = await Promise.allSettled([
    order.customerEmail
      ? sendInvoiceEmail(order)
      : Promise.resolve("Skipped: no email address"),

    sendAdminOrderNotification(order),

    order.customerPhone
      ? sendSMSOrderConfirmation(order)
      : Promise.resolve("Skipped: no phone number"),

    order.customerPhone
      ? sendWhatsappOrderConfirmation(order)
      : Promise.resolve("Skipped: no phone number"),
  ]);

  const results = {};
  settled.forEach((result, idx) => {
    const channel = CHANNELS[idx];
    if (result.status === "rejected") {
      results[channel] = "failed";
      console.error(
        `[Notification Error - ${channel}] ${label}:`,
        result.reason?.message || result.reason,
      );
    } else {
      results[channel] = "sent";
      console.log(`[Notification Success - ${channel}] ${label}`);
    }
  });

  return { skipped: false, results };
}

module.exports = dispatchOrderNotifications;
