function timestamp() {
  return new Date().toISOString();
}

function info(message, metadata = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      timestamp: timestamp(),
      message,
      ...metadata
    })
  );
}

function warn(message, metadata = {}) {
  console.warn(
    JSON.stringify({
      level: "warn",
      timestamp: timestamp(),
      message,
      ...metadata
    })
  );
}

function error(message, metadata = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: timestamp(),
      message,
      ...metadata
    })
  );
}

module.exports = {
  info,
  warn,
  error
};
