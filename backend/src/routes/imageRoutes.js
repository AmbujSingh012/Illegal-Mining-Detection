const express = require("express");
const path = require("path");

const { body, param } = require("express-validator");

const { query } = require("../db/pool");

const upload = require("../middleware/upload");

const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/auth");

const {
  handleValidationErrors
} = require("../utils/validation");

const router = express.Router();


// ============================================================
// UPLOAD SATELLITE IMAGE
// ============================================================

router.post(
  "/upload",

  authenticateToken,

  authorizeRoles(
    "ADMIN",
    "ANALYST"
  ),

  upload.single("image"),

  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Satellite image file is required"
        });
      }

      const {
        lease_id,
        source,
        acquisition_date,
        cloud_percentage,
        crs
      } = req.body;

      if (!lease_id) {
        return res.status(400).json({
          success: false,
          message: "lease_id is required"
        });
      }

      const leaseResult = await query(
        `
        SELECT id
        FROM mining_leases
        WHERE id = $1
        `,
        [lease_id]
      );

      if (leaseResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Mining lease not found"
        });
      }

      const relativePath = path
        .relative(
          process.cwd(),
          req.file.path
        )
        .replace(/\\/g, "/");

      const result = await query(
        `
        INSERT INTO satellite_images (
          lease_id,
          source,
          acquisition_date,
          file_path,
          cloud_percentage,
          crs,
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
          lease_id,
          source || "LOCAL_UPLOAD",
          acquisition_date,
          relativePath,
          cloud_percentage || null,
          crs || null,
          JSON.stringify({
            original_filename:
              req.file.originalname,

            uploaded_by:
              req.user.id
          })
        ]
      );

      res.status(201).json({
        success: true,
        message: "Satellite image uploaded",
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// GET SATELLITE IMAGES
// ============================================================

router.get(
  "/",

  authenticateToken,

  async (req, res, next) => {
    try {
      const {
        lease_id
      } = req.query;

      const values = [];

      let whereClause = "";

      if (lease_id) {
        values.push(lease_id);

        whereClause =
          `WHERE lease_id = $1`;
      }

      const result = await query(
        `
        SELECT
          id,
          lease_id,
          source,
          acquisition_date,
          file_path,
          cloud_percentage,
          crs,
          width,
          height,
          bands,
          metadata,
          created_at
        FROM satellite_images
        ${whereClause}
        ORDER BY acquisition_date DESC
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
// GET SINGLE IMAGE
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
        SELECT *
        FROM satellite_images
        WHERE id = $1
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Satellite image not found"
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


module.exports = router;
