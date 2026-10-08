require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 10000;

// =====================================================
// EXTERNAL QUOTE APIs
// =====================================================

// Primary API - Quotable
// Returns an array when using /quotes/random
const PRIMARY_API =
  process.env.QUOTE_API_URL?.trim() ||
  "https://api.quotable.io/quotes/random?limit=1";

// Backup API - DummyJSON
const SECONDARY_API =
  "https://dummyjson.com/quotes/random";

// Third API - RealInspire
const THIRD_API =
  "https://api.realinspire.live/v1/quotes/random?limit=1";

// =====================================================
// EXPRESS MIDDLEWARE
// =====================================================

app.use(express.json({ limit: "32kb" }));

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// =====================================================
// FALLBACK QUOTES
// =====================================================

const FALLBACK_PATH = path.join(
  __dirname,
  "quote_history_seed.json"
);

let fallbackQuotes = [];

try {
  fallbackQuotes = JSON.parse(
    fs.readFileSync(
      FALLBACK_PATH,
      "utf8"
    )
  );

  if (!Array.isArray(fallbackQuotes)) {
    throw new Error(
      "Fallback file must contain an array."
    );
  }

  console.log(
    `Loaded ${fallbackQuotes.length} fallback quotes.`
  );
} catch (error) {
  console.error(
    "Unable to load quote_history_seed.json:",
    error.message
  );
}

// =====================================================
// MONGODB SCHEMA
// =====================================================

const favoriteSchema =
  new mongoose.Schema(
    {
      quoteId: {
        type: String,
        required: true,
        trim: true,
        index: true
      },

      text: {
        type: String,
        required: true,
        trim: true
      },

      author: {
        type: String,
        required: true,
        trim: true
      },

      topic: {
        type: String,
        default: "General",
        trim: true
      },

      source: {
        type: String,
        default: "external-api",
        trim: true
      },

      userId: {
        type: String,
        default: "demo-user",
        index: true
      }
    },

    {
      timestamps: true
    }
  );

// Prevent the same quote from being saved twice
favoriteSchema.index(
  {
    userId: 1,
    quoteId: 1
  },
  {
    unique: true
  }
);

const Favorite =
  mongoose.model(
    "Favorite",
    favoriteSchema
  );

// =====================================================
// DATABASE STATUS
// =====================================================

let databaseReady = false;

// =====================================================
// DAILY QUOTE CACHE
// =====================================================

let dailyCache = {
  date: null,
  quote: null
};

// =====================================================
// TODAY'S DATE
// =====================================================

function getTodayKey() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

// =====================================================
// FALLBACK QUOTE
// =====================================================

function getFallbackQuote() {
  if (!fallbackQuotes.length) {
    return {
      quoteId: `fallback-${Date.now()}`,

      text:
        "Keep moving forward, one step at a time.",

      author:
        "Quote Generator",

      topic:
        "Motivation",

      source:
        "local-fallback"
    };
  }

  const item =
    fallbackQuotes[
      Math.floor(
        Math.random() *
          fallbackQuotes.length
      )
    ];

  return {
    quoteId:
      `fallback-${item.id}`,

    text:
      item.text,

    author:
      item.author,

    topic:
      item.topic || "General",

    source:
      "local-fallback"
  };
}

// =====================================================
// NORMALIZE QUOTE API RESPONSE
// =====================================================

function normalizeQuote(
  data,
  apiName
) {
  // Quotable returns:
  //
  // [
  //   {
  //     _id: "...",
  //     content: "...",
  //     author: "...",
  //     tags: [...]
  //   }
  // ]
  //
  // DummyJSON returns:
  //
  // {
  //   id: 62,
  //   quote: "...",
  //   author: "..."
  // }

  const raw =
    Array.isArray(data)
      ? data[0]
      : data;

  if (!raw) {
    throw new Error(
      `${apiName}: empty response`
    );
  }

  let text = "";
  let author = "";
  let quoteId = "";
  let topic = "Inspiration";

  // ---------------------------------------------------
  // Quotable / RealInspire
  // ---------------------------------------------------

  if (
    typeof raw.content === "string" &&
    raw.content.trim() &&
    typeof raw.author === "string" &&
    raw.author.trim()
  ) {
    text = raw.content.trim();

    author = raw.author.trim();

    quoteId =
      raw._id ||
      `${apiName}-${Date.now()}`;

    if (
      Array.isArray(raw.tags) &&
      raw.tags.length > 0
    ) {
      topic = String(
        raw.tags[0]
      );
    }
  }

  // ---------------------------------------------------
  // DummyJSON / QAPI
  // ---------------------------------------------------

  else if (
    typeof raw.quote === "string" &&
    raw.quote.trim() &&
    typeof raw.author === "string" &&
    raw.author.trim()
  ) {
    text = raw.quote.trim();

    author = raw.author.trim();

    quoteId =
      raw.id != null
        ? `${apiName}-${raw.id}`
        : `${apiName}-${Date.now()}`;

    topic = "Inspiration";
  }

  // ---------------------------------------------------
  // Invalid response
  // ---------------------------------------------------

  else {
    console.log(
      `${apiName} raw response:`,
      raw
    );

    throw new Error(
      `${apiName}: unsupported response format`
    );
  }

  return {
    quoteId: String(quoteId),

    text,

    author,

    topic,

    source: apiName
  };
}

// =====================================================
// FETCH JSON FROM API
// =====================================================

async function requestQuote(
  url,
  apiName
) {
  console.log(
    `Trying ${apiName}: ${url}`
  );

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        Accept:
          "application/json"
      },

      signal:
        AbortSignal.timeout(8000)
    });

  if (!response.ok) {
    throw new Error(
      `${apiName} returned HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  console.log(
    `${apiName} response received`
  );

  return normalizeQuote(
    data,
    apiName
  );
}

// =====================================================
// FETCH REAL QUOTE
// =====================================================

async function getQuote() {
  // ---------------------------------------------------
  // 1. PRIMARY: QUOTABLE
  // ---------------------------------------------------

  try {
    return await requestQuote(
      PRIMARY_API,
      "quotable"
    );
  } catch (error) {
    console.error(
      "Quotable failed:",
      error.message
    );
  }

  // ---------------------------------------------------
  // 2. BACKUP: DUMMYJSON
  // ---------------------------------------------------

  try {
    return await requestQuote(
      SECONDARY_API,
      "dummyjson"
    );
  } catch (error) {
    console.error(
      "DummyJSON failed:",
      error.message
    );
  }

  // ---------------------------------------------------
  // 3. BACKUP: REALINSPIRE
  // ---------------------------------------------------

  try {
    return await requestQuote(
      THIRD_API,
      "realinspire"
    );
  } catch (error) {
    console.error(
      "RealInspire failed:",
      error.message
    );
  }

  // ---------------------------------------------------
  // 4. LOCAL FALLBACK
  // ---------------------------------------------------

  console.warn(
    "All external quote APIs failed."
  );

  console.warn(
    "Using local fallback quotes."
  );

  return getFallbackQuote();
}

// =====================================================
// DAILY QUOTE
// =====================================================

async function getDailyQuote() {
  const today =
    getTodayKey();

  // Return cached external quote
  // if already requested today
  if (
    dailyCache.date === today &&
    dailyCache.quote
  ) {
    return dailyCache.quote;
  }

  const quote =
    await getQuote();

  // Only cache external API results.
  // A fallback should not remain permanently cached.
  if (
    quote.source !==
    "local-fallback"
  ) {
    dailyCache = {
      date: today,
      quote
    };
  }

  return quote;
}

// =====================================================
// DATABASE CHECK
// =====================================================

function requireDatabase(res) {
  if (!databaseReady) {
    res.status(503).json({
      error:
        "MongoDB is not connected. Check your MONGODB_URI."
    });

    return false;
  }

  return true;
}

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,

      database:
        databaseReady
          ? "connected"
          : "disconnected",

      primaryApi:
        PRIMARY_API,

      backupApi:
        SECONDARY_API
    });
  }
);

// =====================================================
// GET DAILY QUOTE
// =====================================================

app.get(
  "/api/quote",
  async (req, res) => {
    try {
      const quote =
        await getDailyQuote();

      res.json({
        ...quote,

        isFallback:
          quote.source ===
          "local-fallback"
      });
    } catch (error) {
      console.error(
        "Daily quote error:",
        error.message
      );

      res.status(500).json({
        error:
          "Unable to fetch quote."
      });
    }
  }
);

// =====================================================
// GET RANDOM QUOTE
// =====================================================

app.get(
  "/api/quote/random",
  async (req, res) => {
    try {
      const quote =
        await getQuote();

      res.json({
        ...quote,

        isFallback:
          quote.source ===
          "local-fallback"
      });
    } catch (error) {
      console.error(
        "Random quote error:",
        error.message
      );

      res.status(500).json({
        error:
          "Unable to fetch random quote."
      });
    }
  }
);

// =====================================================
// GET FAVORITES
// =====================================================

app.get(
  "/api/favorites",
  async (req, res) => {
    if (!requireDatabase(res)) {
      return;
    }

    try {
      const favorites =
        await Favorite.find({
          userId:
            "demo-user"
        })
          .sort({
            createdAt: -1
          })
          .lean();

      res.json(
        favorites
      );
    } catch (error) {
      console.error(
        "Get favorites error:",
        error.message
      );

      res.status(500).json({
        error:
          "Could not load favorites."
      });
    }
  }
);

// =====================================================
// SAVE FAVORITE
// =====================================================

app.post(
  "/api/favorites",
  async (req, res) => {
    if (!requireDatabase(res)) {
      return;
    }

    const {
      quoteId,
      text,
      author,
      topic,
      source
    } = req.body || {};

    // Validation
    if (
      !quoteId ||
      !text ||
      !author
    ) {
      return res.status(400).json({
        error:
          "quoteId, text and author are required."
      });
    }

    try {
      const favorite =
        await Favorite.create({
          quoteId:
            String(
              quoteId
            ).slice(0, 200),

          text:
            String(
              text
            ).slice(0, 2000),

          author:
            String(
              author
            ).slice(0, 200),

          topic:
            topic
              ? String(
                  topic
                ).slice(0, 100)
              : "General",

          source:
            source
              ? String(
                  source
                ).slice(0, 50)
              : "external-api",

          userId:
            "demo-user"
        });

      res.status(201).json(
        favorite
      );
    } catch (error) {
      // Duplicate quote
      if (
        error &&
        error.code === 11000
      ) {
        return res.status(409).json({
          error:
            "This quote is already in your favorites."
        });
      }

      console.error(
        "Save favorite error:",
        error.message
      );

      res.status(500).json({
        error:
          "Could not save favorite."
      });
    }
  }
);

// =====================================================
// DELETE FAVORITE
// =====================================================

app.delete(
  "/api/favorites/:id",
  async (req, res) => {
    if (!requireDatabase(res)) {
      return;
    }

    try {
      const result =
        await Favorite.deleteOne({
          _id:
            req.params.id,

          userId:
            "demo-user"
        });

      if (
        result.deletedCount === 0
      ) {
        return res.status(404).json({
          error:
            "Favorite not found."
        });
      }

      res.json({
        ok: true
      });
    } catch (error) {
      console.error(
        "Delete favorite error:",
        error.message
      );

      res.status(500).json({
        error:
          "Could not delete favorite."
      });
    }
  }
);

// =====================================================
// FRONTEND
// =====================================================

app.get(
  /.*/,
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

// =====================================================
// START SERVER
// =====================================================

async function startServer() {
  // ---------------------------------------------------
  // MongoDB
  // ---------------------------------------------------

  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI,
        {
          serverSelectionTimeoutMS:
            8000
        }
      );

      databaseReady = true;

      console.log(
        "MongoDB connected successfully."
      );
    } catch (error) {
      databaseReady = false;

      console.error(
        "MongoDB connection failed:",
        error.message
      );
    }
  } else {
    console.warn(
      "MONGODB_URI is not set."
    );

    console.warn(
      "Favorites history will be unavailable."
    );
  }

  // ---------------------------------------------------
  // Start Express
  // ---------------------------------------------------

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log("");
      console.log(
        "=========================================="
      );

      console.log(
        `Quote Generator running on port ${PORT}`
      );

      console.log(
        `Primary API: ${PRIMARY_API}`
      );

      console.log(
        `Backup API: ${SECONDARY_API}`
      );

      console.log(
        "=========================================="
      );

      console.log("");
    }
  );
}

startServer();