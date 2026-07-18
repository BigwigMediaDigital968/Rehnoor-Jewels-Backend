const handleShiprocketWebhook = async (req, res) => {
  try {
    // Shiprocket validates webhook requests with an Optional Custom header or secret token
    const { awb, current_status, current_timestamp, scans, courier_name } = req.body;

    if (!awb) {
      return res.status(400).json({ success: false, message: "No AWB provided." });
    }

    // Find the corresponding order using AWB code
    const order = await Order.findOne({ "shipping.trackingNumber": awb });

    if (!order) {
      // Return 200 to Shiprocket so they stop retrying this webhook
      return res.status(200).json({ success: true, message: "AWB not associated with any internal order." });
    }

    // Map Shiprocket internal statuses safely to your system status
    let mappedStatus = order.status;
    const statusLower = current_status?.toLowerCase();

    if (statusLower.includes("pickup") || statusLower.includes("picked up")) {
      mappedStatus = "shipped";
    } else if (statusLower.includes("transit") || statusLower.includes("out for delivery")) {
      mappedStatus = "shipped"; 
    } else if (statusLower.includes("delivered")) {
      mappedStatus = "delivered";
    } else if (statusLower.includes("canceled") || statusLower.includes("cancelled")) {
      mappedStatus = "cancelled";
    }

    // Process raw tracking updates/scans from Shiprocket into your statusHistory timeline
    const formattedHistory = scans ? scans.map(scan => ({
      status: scan.activity || scan.status,
      location: scan.location || "In Transit",
      timestamp: scan.date ? new Date(scan.date) : new Date(),
      comment: scan.activity || "Package update from courier"
    })) : [];

    // Update order records
    order.status = mappedStatus;
    if (courier_name) order.courierName = courier_name;
    
    if (formattedHistory.length > 0) {
      order.statusHistory = formattedHistory;
    } else {
      order.statusHistory.push({
        status: current_status,
        location: "In Transit",
        timestamp: current_timestamp ? new Date(current_timestamp) : new Date(),
        comment: "Automated update via Shiprocket tracking"
      });
    }

    if (mappedStatus === "shipped" && !order.shippedAt) {
      order.shippedAt = new Date();
    }
    if (mappedStatus === "delivered" && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    await order.save();

    return res.status(200).json({ success: true, message: "Order status synchronized successfully." });
  } catch (error) {
    console.error("[SHIPROCKET WEBHOOK ERROR]:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};