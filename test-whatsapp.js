import dotenv from "dotenv";
import twilio from "twilio";

// Load environment variables from .env file
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error("❌ Missing Twilio credentials in .env file");
  process.exit(1);
}

// Ensure the recipient number is properly formatted with country code (assuming India +91)
const recipientNumber = "whatsapp:+918800252885";

// Ensure the sender number has the 'whatsapp:' prefix
let twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";
if (!twilioNumber.startsWith("whatsapp:")) {
  twilioNumber = `whatsapp:${twilioNumber}`;
}

const client = twilio(accountSid, authToken);

async function testWhatsapp() {
  try {
    console.log(`Attempting to send a test message from ${twilioNumber} to ${recipientNumber}...`);

    const response = await client.messages.create({
      from: twilioNumber,
      to: recipientNumber,
      // Using the Content API with your specific template SID from the screenshot
      contentSid: "HX8883a43058090ae4fd815682cefb7814",
      contentVariables: JSON.stringify({
        "1": "Akul Varshney",
        "2": "Dr. Siddhant Srivastava",
        "3": "12th July 2026",
        "4": "23:45 pm",
        "5": "Elaria Estheque",
        "6": "+918844557733"
      })
      // If your template has variables (like {{1}}), you pass them here:
      // contentVariables: JSON.stringify({ "1": "Name" }),
    });

    console.log("✅ Success! Message sent successfully.");
    console.log("Message SID:", response.sid);
    console.log("Message status:", response.status);
  } catch (error) {
    console.error("\n❌ Failed to send message.");
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);

    if (error.code === 63016 || error.message.includes("freeform")) {
      console.log("\n💡 Note: You are trying to initiate a conversation with a free-form message instead of an approved WhatsApp template.");
      console.log("To fix this for testing quickly: Send ANY WhatsApp message from your phone (8800252885) to your Twilio number first. This opens a 24-hour window where free-form messages are allowed, then run this script again.");
    }
  }
}

testWhatsapp();
