# TEST_PAYLOADS.md

## Purpose

This file provides sample payloads for development and testing of the WhatsApp-native security operations MVP.

The payloads are intended to help developers test:

- webhook verification
- inbound WhatsApp message handling
- text messages
- location messages
- image/media messages
- message processing
- event generation
- verification logic
- error handling

These payloads are simplified but should remain structurally close to WhatsApp Cloud API webhook payloads.

---

# Testing Principles

- Use realistic WhatsApp webhook shapes
- Keep payloads easy to read
- Cover the main MVP flows:
  - check-in
  - patrol logging
  - incident reporting
  - missing location
  - media upload
  - unknown user
  - unsupported message type
- Include expected system behavior for each payload

---

# 1. Webhook Verification Request

This is the GET verification challenge used when configuring the webhook with Meta.

## Example Request Query Params

```txt
hub.mode=subscribe
hub.verify_token=your_verify_token_here
hub.challenge=123456789