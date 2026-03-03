const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

/* ========================= */
/* CONFIG */
/* ========================= */

const PORT = 3000;
const JWT_SECRET = "my_super_secret_key";
const RM_BEARER_TOKEN = "061e8b94-f28c-4368-bcb9-27a061dd7591";
const RM_BASE_URL = "https://api.parcel.royalmail.com/api/v1";

/* ========================= */
/* CREATE CUSTOMER TOKEN */
/* ========================= */

app.post("/generate-token", (req, res) => {
  const { clientName } = req.body;

  if (!clientName) {
    return res.status(400).json({ message: "clientName required" });
  }

  const token = jwt.sign(
    { client: clientName },
    JWT_SECRET,
    { expiresIn: "365d" }
  );

  res.json({
    message: "Token generated",
    token
  });
});

/* ========================= */
/* AUTH MIDDLEWARE */
/* ========================= */

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* ========================= */
/* CREATE LABEL */
/* ========================= */

app.post("/create-label", verifyToken, async (req, res) => {
  try {
    const createOrder = await axios.post(
      `${RM_BASE_URL}/orders`,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${RM_BEARER_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const orderId = createOrder.data.orderIdentifier;

    const label = await axios.get(
      `${RM_BASE_URL}/orders/${orderId}/label?documentType=postageLabel&includeReturnsLabel=false&includeCN=true`,
      {
        headers: {
          Authorization: `Bearer ${RM_BEARER_TOKEN}`
        },
        responseType: "arraybuffer"
      }
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${orderId}.pdf`
    });

    res.send(label.data);

  } catch (error) {
    console.log("RM ERROR:", error.response?.data || error.message);

    res.status(500).json({
      message: "Create label failed",
      error: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});