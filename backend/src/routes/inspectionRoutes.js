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

const upload = require("../middleware/upload");

const router = express.Router();


// ============================================================
// CREATE FIELD INSPECTION
// ============================================================

router.post(
  "/",

  authenticateToken,

  authorizeRoles(
    "ADMIN",
    "OFFICER"
  ),

  [
    body("case_id")
      .isUUID(),

    body("inspection_date")
      .optional()
      .isISO8601()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        case_id,
        inspection_date,
        latitude,
        longitude,
        findings,
        remarks
      } = req.body;

      const caseResult = await query(
        `
        SELECT id
        FROM cases
        WHERE id = $1
        `,
        [case_id]
      );

      if (caseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Case not found"
        });
      }

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
        INSERT INTO field_inspections (
          case_id,
          officer_id,
          inspection_date,
          latitude,
          longitude,
          location,
          findings,
          remarks,
          status
        )
        VALUES (
          $1,
          $2,
          COALESCE($3::timestamptz, NOW()),
          $4,
          $5,
          CASE
            WHEN $6 IS NULL
            THEN NULL
            ELSE ST_GeomFromEWKT($6)
          END,
          $7,
          $8,
          'COMPLETED'
        )
        RETURNING *
        `,
        [
          case_id,
          req.user.id,
          inspection_date || null,
          latitude || null,
          longitude || null,
          location,
          findings || null,
          remarks || null
        ]
      );

      res.status(201).json({
        success: true,
        message: "Field inspection recorded",
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// GET INSPECTIONS FOR CASE
// ============================================================

router.get(
  "/case/:caseId",

  authenticateToken,

  [
    param("caseId").isUUID()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const result = await query(
        `
        SELECT
          fi.*,

          u.name AS officer_name,

          ST_AsGeoJSON(fi.location)::json
            AS location

        FROM field_inspections fi

        LEFT JOIN users u
          ON u.id = fi.officer_id

        WHERE fi.case_id = $1

        ORDER BY fi.created_at DESC
        `,
        [req.params.caseId]
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
// UPLOAD INSPECTION PHOTO
// ============================================================

router.post(
  "/:inspectionId/photos",

  authenticateToken,

  authorizeRoles(
    "ADMIN",
    "OFFICER"
  ),

  upload.single("photo"),

  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Photo is required"
        });
      }

      const inspection =
        await query(
          `
          SELECT id
          FROM field_inspections
          WHERE id = $1
          `,
          [req.params.inspectionId]
        );

      if (inspection.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Inspection not found"
        });
      }

      const {
        latitude,
        longitude,
        captured_at,
        description
      } = req.body;

      const result = await query(
        `
        INSERT INTO inspection_photos (
          inspection_id,
          file_path,
          latitude,
          longitude,
          captured_at,
          description,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        RETURNING *
        `,
        [
          req.params.inspectionId,

          req.file.path,

          latitude || null,

          longitude || null,

          captured_at || null,

          description || null,

          JSON.stringify({
            uploaded_by:
              req.user.id,

            original_filename:
              req.file.originalname
          })
        ]
      );

      res.status(201).json({
        success: true,
        message:
          "Inspection photo uploaded",
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;
