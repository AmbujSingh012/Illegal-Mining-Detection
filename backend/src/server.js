require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const swaggerUi =
  require("swagger-ui-express");

const {
  testDatabaseConnection
} = require("./db/pool");

const swaggerDocument =
  require("./config/swagger");

const logger =
  require("./utils/logger");

const {
  notFoundHandler,
  errorHandler
} = require("./middleware/errorHandler");

const authRoutes =
  require("./routes/authRoutes");

const leaseRoutes =
  require("./routes/leaseRoutes");

const imageRoutes =
  require("./routes/imageRoutes");

const analysisRoutes =
  require("./routes/analysisRoutes");

const alertRoutes =
  require("./routes/alertRoutes");

const caseRoutes =
  require("./routes/caseRoutes");

const inspectionRoutes =
  require("./routes/inspectionRoutes");


const app = express();

const PORT =
  process.env.PORT || 5000;


// ============================================================
// SECURITY
// ============================================================

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);


app.use(
  cors({
    origin: true,
    credentials: true
  })
);


// ============================================================
// BODY PARSING
// ============================================================

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);


// ============================================================
// LOGGING
// ============================================================

app.use(morgan("combined"));


// ============================================================
// RATE LIMIT
// ============================================================

const apiLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,

    max: 500,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      success: false,
      message:
        "Too many requests. Please try again later."
    }
  });

app.use("/api", apiLimiter);


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/health",
  async (req, res) => {
    try {
      const database =
        await testDatabaseConnection();

      res.json({
        success: true,

        service:
          "illegal-mining-backend",

        status: "healthy",

        database: "connected",

        timestamp:
          database.current_time
      });

    } catch (error) {
      res.status(503).json({
        success: false,

        service:
          "illegal-mining-backend",

        status: "unhealthy",

        database: "disconnected"
      });
    }
  }
);


// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,

    message:
      "AI-Based Illegal Mining Detection Backend",

    version: "1.0.0",

    documentation:
      "/api-docs",

    health:
      "/health"
  });
});


// ============================================================
// API ROUTES
// ============================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/leases",
  leaseRoutes
);

app.use(
  "/api/images",
  imageRoutes
);

app.use(
  "/api/analysis",
  analysisRoutes
);

app.use(
  "/api/alerts",
  alertRoutes
);

app.use(
  "/api/cases",
  caseRoutes
);

app.use(
  "/api/inspections",
  inspectionRoutes
);


// ============================================================
// API DOCUMENTATION
// ============================================================

app.use(
  "/api-docs",

  swaggerUi.serve,

  swaggerUi.setup(
    swaggerDocument
  )
);


// ============================================================
// ERROR HANDLING
// ============================================================

app.use(notFoundHandler);

app.use(errorHandler);


// ============================================================
// SERVER START
// ============================================================

async function startServer() {
  try {
    await testDatabaseConnection();

    logger.info(
      "PostgreSQL connection successful"
    );

    app.listen(
      PORT,
      () => {
        logger.info(
          `Backend running on port ${PORT}`
        );

        logger.info(
          `API documentation available at http://localhost:${PORT}/api-docs`
        );
      }
    );

  } catch (error) {
    logger.error(
      "Failed to start backend",
      {
        error: error.message
      }
    );

    process.exit(1);
  }
}


if (require.main === module) {
  startServer();
}


module.exports = app;
