const swaggerDocument = {
  openapi: "3.0.3",

  info: {
    title:
      "AI-Based Illegal Mining Detection API",

    version: "1.0.0",

    description:
      "REST API for geospatial mining monitoring, satellite image analysis, alerts, cases and field verification."
  },

  servers: [
    {
      url: "http://localhost:5000",
      description: "Local development server"
    }
  ],

  tags: [
    {
      name: "Health"
    },
    {
      name: "Authentication"
    },
    {
      name: "Mining Leases"
    },
    {
      name: "Satellite Images"
    },
    {
      name: "AI Analysis"
    },
    {
      name: "Alerts"
    },
    {
      name: "Cases"
    },
    {
      name: "Field Inspections"
    }
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },

  paths: {
    "/health": {
      get: {
        tags: ["Health"],

        summary:
          "Check backend health",

        responses: {
          "200": {
            description:
              "Backend is healthy"
          }
        }
      }
    },

    "/api/auth/login": {
      post: {
        tags: ["Authentication"],

        summary:
          "Authenticate a user",

        responses: {
          "200": {
            description:
              "Successful authentication"
          }
        }
      }
    },

    "/api/leases": {
      get: {
        tags: ["Mining Leases"],

        security: [
          {
            bearerAuth: []
          }
        ],

        summary:
          "Get mining leases",

        responses: {
          "200": {
            description:
              "Mining leases returned"
          }
        }
      },

      post: {
        tags: ["Mining Leases"],

        security: [
          {
            bearerAuth: []
          }
        ],

        summary:
          "Create a mining lease",

        responses: {
          "201": {
            description:
              "Mining lease created"
          }
        }
      }
    },

    "/api/analysis": {
      post: {
        tags: ["AI Analysis"],

        security: [
          {
            bearerAuth: []
          }
        ],

        summary:
          "Start satellite image analysis",

        responses: {
          "200": {
            description:
              "Analysis completed"
          }
        }
      }
    }
  }
};

module.exports = swaggerDocument;
