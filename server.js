const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   CONFIG
================================= */

const PORT = process.env.PORT || 3000;

// Royal Mail v1 - TOKEN CỐ ĐỊNH
const RM_BEARER_TOKEN = process.env.RM_BEARER_TOKEN;
const RM_API_URL = "https://api.parcel.royalmail.com/api/v1/orders";

const CUSTOMER_FILE = "customers.json";

/* ===============================
   LOAD & SAVE CUSTOMER
================================= */

function loadCustomers() {
  if (!fs.existsSync(CUSTOMER_FILE)) {
    fs.writeFileSync(CUSTOMER_FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(CUSTOMER_FILE));
}

function saveCustomers(data) {
  fs.writeFileSync(CUSTOMER_FILE, JSON.stringify(data, null, 2));
}

/* ===============================
   CREATE CUSTOMER (TOKEN CỐ ĐỊNH CHO KHÁCH)
================================= */

app.post("/api/create-customer", (req, res) => {
  const { companyName } = req.body;

  if (!companyName) {
    return res.status(400).json({ message: "companyName is required" });
  }

  const customers = loadCustomers();
  const token = crypto.randomBytes(20).toString("hex");

  const newCustomer = {
    id: customers.length + 1,
    companyName,
    token,
    createdAt: new Date()
  };

  customers.push(newCustomer);
  saveCustomers(customers);

  res.json({
    message: "Customer created successfully",
    token
  });
});

/* ===============================
   VERIFY CUSTOMER TOKEN
================================= */

function verifyCustomerToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }

  const token = authHeader.split(" ")[1];
  const customers = loadCustomers();

  const customer = customers.find(c => c.token === token);

  if (!customer) {
    return res.status(401).json({ message: "Invalid token" });
  }

  req.customer = customer;
  next();
}

/* ===============================
   CREATE LABEL (ROYAL MAIL V1)
================================= */

app.post("/api/create-label", verifyCustomerToken, async (req, res) => {
  try {

    const response = await axios.post(
      RM_API_URL,
      req.body,
      {
        headers: {
          Authorization: `Bearer ${RM_BEARER_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }
    );

    res.json({
      message: "Label created successfully",
      customer: req.customer.companyName,
      data: response.data
    });

  } catch (error) {

    console.log("RM ERROR:", error.response?.data || error.message);

    res.status(error.response?.status || 500).json({
      message: "Create label failed",
      error: error.response?.data || error.message
    });
  }
});

/* ===============================
   GET ALL CUSTOMERS (ADMIN)
================================= */

app.get("/api/customers", (req, res) => {
  const customers = loadCustomers();
  res.json(customers);
});

/* ===============================
   HEALTH CHECK
================================= */

app.get("/", (req, res) => {
  res.send("RM API v1 running...");
});

/* ===============================
   START SERVER
================================= */

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});