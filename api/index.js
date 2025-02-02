const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const accessToken = process.env["ACCESSTOKEN"];
const verifyToken = process.env["VERIFYTOKEN"];
const PORT = process.env["PORT"];

const uri = "mongodb+srv://misodev:misodev@cluster0.jl2gn.mongodb.net/";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.log("Check"));

const prompts = {
  init_prompt: ["hi", "hello", "hey", "hola", "yo", "sup", "howdy"],
};

const responses = {
  initial_message: {
    header: {
      type: "text",
      text: "Welcome to the Shubham Bot!",
    },
    body: {
      text: "Welcome to the Shubham Bot! I am here to help you with your queries. Please select an option below to get started.",
    },
    footer: {
      text: "Powered by HyperDigital",
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: { id: "fetch_report", title: "📄 Get Report" },
        },
        {
          type: "reply",
          reply: { id: "book_appt", title: "📆 Book Appointment" },
        },
        { type: "reply", reply: { id: "ask_faq", title: "❓ FAQ" } },
      ],
    },
  },
};

const action_map = {
  fetch_report: fetchReport,
  book_appt: bookAppointment,
  ask_faq: askFaq,
}; // Add functions and id's here for more actions

// Functions to be called for each action
async function fetchReport(phoneNumberId, from) {
  await sendTextMessage(phoneNumberId, from, "Fetching your report...");
}

async function bookAppointment(phoneNumberId, from) {
  await sendTextMessage(phoneNumberId, from, "Booking your appointment...");
}

async function askFaq(phoneNumberId, from) {
  await sendTextMessage(
    phoneNumberId,
    from,
    "Here are some frequently asked questions..."
  );
}

app.listen(PORT, () => {
  console.log(`Webhook is listening on port ${PORT}`);
});

// Webhook Verification
app.get("/webhook", (req, res) => {
  const {
    "hub.mode": mode,
    "hub.challenge": challenge,
    "hub.verify_token": token,
  } = req.query;

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(mode && token ? 403 : 400);
});

// Webhook for Incoming Messages
app.post("/webhook", async (req, res) => {
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const phoneNumberId =
    req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (message && phoneNumberId) {
    const { from, type, text } = message;

    if (type === "text") {
      const body = text?.body?.toLowerCase().split(" ");

      if (body.some((word) => prompts.init_prompt.includes(word))) {
        await sendButtonMessage(phoneNumberId, from, responses.initial_message);
      } else {
        await sendTextMessage(
          phoneNumberId,
          from,
          "I'm sorry, I didn't understand that."
        );
      }
    } else if (type === "interactive") {
      const interaction_id = message.interactive?.button_reply.id;

      if (action_map[interaction_id]) {
        await action_map[interaction_id](phoneNumberId, from);
      } else {
        await sendTextMessage(
          phoneNumberId,
          from,
          "I'm sorry, I didn't understand that."
        );
      }
    }
    return res.sendStatus(200);
  }

  res.sendStatus(400);
});

// Function to send a text message
async function sendTextMessage(phoneNumberId, to, message) {
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages?access_token=${accessToken}`;
  const data = {
    messaging_product: "whatsapp",
    to,
    text: { body: message },
  };
  const config = {
    headers: { "Content-Type": "application/json" },
  };

  await axios.post(url, data, config);
}

// Function to send a message with buttons
async function sendButtonMessage(phoneNumberId, to, content) {
  await axios.post(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages?access_token=${accessToken}`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        ...content,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

// Default Route
app.get("/", (req, res) => {
  res.status(200).send("Hello, this is the webhook setup.");
});

module.exports = app;
