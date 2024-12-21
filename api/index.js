const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const accessToken = process.env.ACCESSTOKEN;
const verifyToken = process.env.VERIFYTOKEN;
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Webhook is listening on port ${PORT}`);
});

// Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  res.sendStatus(400);
});

// Webhook for Incoming Messages
app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (body.object) {
    const changes = body.entry?.[0]?.changes?.[0]?.value;
    const messages = changes?.messages?.[0];

    if (messages) {
      const phoneNumberId = changes.metadata.phone_number_id;
      const from = messages.from;

      // Handle button responses
      const buttonResponse = messages.button?.reply?.id;

      if (buttonResponse) {
        console.log(`Button clicked: ${buttonResponse}`);

        if (buttonResponse === "hi_button") {
          await sendTextMessage(phoneNumberId, from, "Hi there!");
        } else if (buttonResponse === "bye_button") {
          await sendTextMessage(phoneNumberId, from, "Goodbye!");
        } else {
          await sendTextMessage(
            phoneNumberId,
            from,
            "I didn't understand your button click."
          );
        }
        return res.sendStatus(200);
      }

      // Handle text messages
      const messageBody = messages.text?.body?.toLowerCase();

      if (messageBody === "hi") {
        await sendButtonMessage(phoneNumberId, from);
      } else {
        await sendTextMessage(phoneNumberId, from, "I didn't understand that.");
      }
      return res.sendStatus(200);
    }
    return res.sendStatus(404);
  }
  res.sendStatus(400);
});

// Function to send a text message
async function sendTextMessage(phoneNumberId, to, message) {
  await axios.post(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages?access_token=${accessToken}`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: message },
    },
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

// Function to send a message with buttons
async function sendButtonMessage(phoneNumberId, to) {
  await axios.post(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages?access_token=${accessToken}`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: "Choose an option:",
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "hi_button", title: "Hi" } },
            { type: "reply", reply: { id: "bye_button", title: "Bye" } },
          ],
        },
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
