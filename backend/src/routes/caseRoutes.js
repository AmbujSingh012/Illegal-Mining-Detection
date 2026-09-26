const express = require("express");

const {
  body,
  param
} = require("express-validator");

const {
  query
} = require("../db/pool");

const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/auth");

const {
  handleValidationErrors
} = require("../utils/validation");

const router = express.Router();


// ============================================================
// GET CASES
// ============================================================

router.get(
  "/",

  authenticateToken,

  async (req, res, next) => {
    try {
      const {
        status,
        priority
      } = req.query;

      const conditions = [];
      const values = [];

      if (status) {
        values.push(status);

        conditions.push(
          `c.status = $${values.length}`
        );
      }

      if (priority) {
        values.push(priority);

        conditions.push(
          `c.priority = $${values.length}`
        );
      }

      const whereClause =
        conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const result = await query(
        `
        SELECT
          c.id,
          c.case_number,
          c.status,
          c.priority,
          c.title,
          c.description,
          c.detected_area_hectares,
          c.outside_lease_area_hectares,
          c.opened_at,
          c.closed_at,

          l.lease_number,

          u.name AS assigned_officer

        FROM cases c

        LEFT JOIN mining_leases l
          ON l.id = c.lease_id

        LEFT JOIN users u
          ON u.id = c.assigned_officer_id

        ${whereClause}

        ORDER BY c.created_at DESC
        `,
        values
      );

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// GET CASE
// ============================================================

router.get(
  "/:id",

  authenticateToken,

  [
    param("id").isUUID()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const result = await query(
        `
        SELECT
          c.*,

          l.lease_number,
          l.owner_name,
          l.district,
          l.tehsil,
          l.village,

          u.name AS assigned_officer_name,

          ST_AsGeoJSON(c.location)::json
            AS location

        FROM cases c

        LEFT JOIN mining_leases l
          ON l.id = c.lease_id

        LEFT JOIN users u
          ON u.id = c.assigned_officer_id

        WHERE c.id = $1
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found"
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// CREATE CASE
// ============================================================

router.post(
  "/",

  authenticateToken,

  authorizeRoles(
    "ADMIN",
    "OFFICER",
    "ANALYST"
  ),

  [
    body("title")
      .trim()
      .notEmpty(),

    body("lease_id")
      .optional()
      .isUUID(),

    body("alert_id")
      .optional()
      .isUUID(),

    body("priority")
      .optional()
      .isIn([
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL"
      ])
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        title,
        description,
        lease_id,
        alert_id,
        priority = "MEDIUM",
        latitude,
        longitude
      } = req.body;

      const caseNumber =
        `CASE-${Date.now()}`;

      let location = null;

      if (
        latitude !== undefined &&
        longitude !== undefined
      ) {
        location =
          `SRID=4326;POINT(${longitude} ${latitude})`;
      }

      const result = await query(
        `
        INSERT INTO cases (
          case_number,
          alert_id,
          lease_id,
          status,
          priority,
          title,
          description,
          latitude,
          longitude,
          location
        )
        VALUES (
          $1,
          $2,
          $3,
          'NEW',
          $4,
          $5,
          $6,
          $7,
          $8,
          CASE
            WHEN $9 IS NULL
            THEN NULL
            ELSE ST_GeomFromEWKT($9)
          END
        )
        RETURNING
          id,
          case_number,
          status,
          priority,
          title,
          description,
          created_at
        `,
        [
          caseNumber,
          alert_id || null,
          lease_id || null,
          priority,
          title,
          description || null,
          latitude || null,
          longitude || null,
          location
        ]
      );

      await query(
        `
        INSERT INTO audit_logs (
          user_id,
          entity_type,
          entity_id,
          action,
          previous_status,
          new_status,
          remarks
        )
        VALUES (
          $1,
          'CASE',
          $2,
          'CASE_CREATED',
          NULL,
          'NEW',
          $3
        )
        `,
        [
          req.user.id,
          result.rows[0].id,
          "Case created"
        ]
      );

      res.status(201).json({
        success: true,
        message: "Case created successfully",
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// UPDATE CASE STATUS
// ============================================================

router.patch(
  "/:id/status",

  authenticateToken,

  authorizeRoles(
    "ADMIN",
    "OFFICER"
  ),

  [
    param("id").isUUID(),

    body("status")
      .isIn([
        "NEW",
        "UNDER_VERIFICATION",
        "CONFIRMED_VIOLATION",
        "NO_VIOLATION",
        "FALSE_ALARM",
        "ACTION_TAKEN"
      ]),

    body("remarks")
      .optional()
      .isString()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        status,
        remarks
      } = req.body;

      const existing = await query(
        `
        SELECT status
        FROM cases
        WHERE id = $1
        `,
        [req.params.id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found"
        });
      }

      const previousStatus =
        existing.rows[0].status;

      const result = await query(
        `
        UPDATE cases

        SET
          status = $1,
          remarks = COALESCE($2, remarks),

          closed_at =
            CASE
              WHEN $1 IN (
                'CONFIRMED_VIOLATION',
                'NO_VIOLATION',
                'FALSE_ALARM',
                'ACTION_TAKEN'
              )
              THEN NOW()
              ELSE closed_at
            END

        WHERE id = $3

        RETURNING *
        `,
        [
          status,
          remarks || null,
          req.params.id
        ]
      );

      await query(
        `
        INSERT INTO audit_logs (
          user_id,
          entity_type,
          entity_id,
          action,
          previous_status,
          new_status,
          remarks
        )
        VALUES (
          $1,
          'CASE',
          $2,
          'STATUS_CHANGED',
          $3,
          $4,
          $5
        )
        `,
        [
          req.user.id,
          req.params.id,
          previousStatus,
          status,
          remarks || null
        ]
      );

      res.json({
        success: true,
        message: "Case status updated",
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// ASSIGN CASE
// ============================================================

router.patch(
  "/:id/assign",

  authenticateToken,

  authorizeRoles("ADMIN"),

  [
    param("id").isUUID(),

    body("officer_id")
      .isUUID()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        officer_id
      } = req.body;

      const officer = await query(
        `
        SELECT id
        FROM users
        WHERE id = $1
        AND role = 'OFFICER'
        AND is_active = TRUE
        `,
        [officer_id]
      );

      if (officer.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Active officer not found"
        });
      }

      const result = await query(
        `
        UPDATE cases
        SET assigned_officer_id = $1
        WHERE id = $2
        RETURNING id, case_number, assigned_officer_id
        `,
        [
          officer_id,
          req.params.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found"
        });
      }

      await query(
        `
        INSERT INTO audit_logs (
          user_id,
          entity_type,
          entity_id,
          action,
          remarks
        )
        VALUES (
          $1,
          'CASE',
          $2,
          'CASE_ASSIGNED',
          $3
        )
        `,
        [
          req.user.id,
          req.params.id,
          `Assigned to officer ${officer_id}`
        ]
      );

      res.json({
        success: true,
        message: "Case assigned",
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;
