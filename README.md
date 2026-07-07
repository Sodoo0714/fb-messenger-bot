# Self-hosted Facebook Messenger Bot

A minimal, real Messenger bot that runs on your own server — no Manychat,
no contact limits, no monthly fee. It replies with a quick-reply menu and
simple keyword matching (currently in Mongolian — edit `server.js` to change
the wording or logic).

## What you need before starting
- A Facebook Page (you already have one)
- A Facebook Developer account (free) — developers.facebook.com
- A place to host the code, since Facebook needs a public HTTPS URL to send
  messages to. Free options that work well for this: **Render.com** (free
  web service tier) or **Railway.app**. You cannot run this only on your own
  laptop unless you also expose it publicly (e.g. with ngrok for testing).

## Step 1 — Create a Facebook App
1. Go to https://developers.facebook.com/apps and click **Create App**.
2. Choose **"Other"** → **"Business"** as the app type.
3. Once created, on the app dashboard, click **Add Product** and set up
   **Messenger**.

## Step 2 — Connect your Page and get a Page Access Token
1. In the Messenger product settings, under **Access Tokens**, click
   **Add or Remove Pages** and select your Facebook Page.
2. Facebook will generate a **Page Access Token** — copy it into your `.env`
   file as `PAGE_ACCESS_TOKEN`.

## Step 3 — Deploy the code so it has a public URL
Using Render.com (free tier) as an example:
1. Push this folder to a GitHub repo.
2. On Render.com, click **New > Web Service**, connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add environment variables `VERIFY_TOKEN` and `PAGE_ACCESS_TOKEN` in
   Render's dashboard (same values as your `.env`).
5. Once deployed, Render gives you a URL like
   `https://your-bot.onrender.com`.

## Step 4 — Set up the Webhook in Facebook
1. Back in Messenger settings → **Webhooks** → **Add Callback URL**.
2. Callback URL: `https://your-bot.onrender.com/webhook`
3. Verify Token: the same string you put in `VERIFY_TOKEN`.
4. Subscribe to these fields: `messages`, `messaging_postbacks`.
5. Subscribe your Page to the webhook.

## Step 5 — Test it
Message your own Page from a personal Facebook account. As the app
Developer/Admin/Tester on the app, this works immediately without any
Facebook review.

## Important: going live to the public
While your app is in **Development mode**, only people listed as Admins,
Developers, or Testers on the Facebook App can message the bot and get
replies — real customers can't yet. To let any customer message your Page:
1. Go to **App Review** in the Developer Console.
2. Request the `pages_messaging` permission.
3. Facebook requires **Business Verification** (submitting business
   documents) and a review of how you use the permission — this can take
   from a few days to a couple of weeks, and is unfortunately a real,
   unavoidable step Meta requires of every business bot, whether built on
   Manychat or by hand.

## Customizing the bot
All reply logic lives in `server.js` inside `handleMessage()` and
`handleQuickReply()`. Add more keyword checks or menu buttons there —
no other files need to change for basic edits.
