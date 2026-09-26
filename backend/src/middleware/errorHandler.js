const logger = require("../utils/logger");

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(error, req, res, next) {
  logger.error("Unhandled server error", {
    message: error.message,
    stack: error.stack,
    method: req.method,
    path: req.originalUrl
  });

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : error.message
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
