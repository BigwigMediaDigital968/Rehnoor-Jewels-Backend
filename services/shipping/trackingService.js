const axios = require("axios");
const { getShiprocketToken, SR_BASE } = require("../../config/shiprocket");

async function trackByAWB(awbCode) {
  const token = await getShiprocketToken();
  const { data } = await axios.get(`${SR_BASE}/courier/track/awb/${awbCode}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data?.tracking_data || null;
}

async function trackByOrderId(shiprocketOrderId) {
  const token = await getShiprocketToken();
  const { data } = await axios.get(
    `${SR_BASE}/orders/show/${shiprocketOrderId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
}

module.exports = { trackByAWB, trackByOrderId };
