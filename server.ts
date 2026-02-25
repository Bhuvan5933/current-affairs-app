import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import session from "express-session";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import type { Credentials } from "google-auth-library";

declare module "express-session" {
  interface SessionData {
    tokens: Credentials;
  }
}

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(cors({
    origin: true,
    credentials: true,
  }));

  app.use(express.json({ limit: '50mb' }));

  app.use(session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/auth/callback`
  );

  // Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/spreadsheets"],
      prompt: "consent",
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session!.tokens = tokens;
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ connected: !!req.session?.tokens });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    res.json({ success: true });
  });

  // Sheets Update Route
  app.post("/api/sheets/update", async (req, res) => {
    if (!req.session || !req.session.tokens) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data } = req.body;
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      return res.status(500).json({ error: "SPREADSHEET_ID is not configured on server" });
    }
    if (!data) {
      return res.status(400).json({ error: "Missing data" });
    }

    try {
      oauth2Client.setCredentials(req.session.tokens);
      const sheets = google.sheets({ version: "v4", auth: oauth2Client });

      // Prepare data for appending — one row per NewsItem
      const values = data.map((item: any) => [
        item.title,
        item.subTitle,
        item.date,
        item.headline,
        Array.isArray(item.content) ? item.content.join("\n") : item.content,
        Array.isArray(item.staticGk) && item.staticGk.length > 0
          ? item.staticGk.join("\n")
          : "Not applicable",
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Current Affairs!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating sheet:", error);
      res.status(500).json({ error: error.message || "Failed to update sheet" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
