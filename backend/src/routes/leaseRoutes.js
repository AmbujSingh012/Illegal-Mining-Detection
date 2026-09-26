const express = require("express");
const { body, param } = require("express-validator");

const { query } = require("../db/pool");

const {
  authenticateToken,
  authorizeRoles
} = require("../middleware/auth");

const {
  handleValidationErrors
} = require("../utils/validation");

const router = express.Router();


// ============================================================
// GET ALL LEASES
// ============================================================

router.get(
  "/",
  authenticateToken,

  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        district,
        status,
        search
      } = req.query;

      const pageNumber =
        Math.max(parseInt(page, 10) || 1, 1);

      const limitNumber =
        Math.min(
          Math.max(parseInt(limit, 10) || 20, 1),
          100
        );

      const offset =
        (pageNumber - 1) * limitNumber;

      const conditions = [];
      const values = [];

      if (district) {
        values.push(district);

        conditions.push(
          `district ILIKE $${values.length}`
        );
      }

      if (status) {
        values.push(status);

        conditions.push(
          `status = $${values.length}`
        );
      }

      if (search) {
        values.push(`%${search}%`);

        conditions.push(`
          (
            lease_number ILIKE $${values.length}
            OR owner_name ILIKE $${values.length}
            OR village ILIKE $${values.length}
          )
        `);
      }

      const whereClause =
        conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      const countResult = await query(
        `
        SELECT COUNT(*)::integer AS total
        FROM mining_leases
        ${whereClause}
        `,
        values
      );

      const total =
        countResult.rows[0].total;

      const dataValues = [
        ...values,
        limitNumber,
        offset
      ];

      const result = await query(
        `
        SELECT
          id,
          lease_number,
          owner_name,
          mineral_type,
          district,
          tehsil,
          village,
          survey_khasra,
          approved_area_hectares,
          lease_start_date,
          lease_expiry_date,
          approved_depth_meters,
          ST_AsGeoJSON(boundary)::json AS boundary,
          status,
          created_at,
          updated_at
        FROM mining_leases
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length}
        `,
        dataValues
      );

      res.json({
        success: true,

        data: result.rows,

        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages:
            Math.ceil(total / limitNumber)
        }
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// GET SINGLE LEASE
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
          id,
          lease_number,
          owner_name,
          mineral_type,
          district,
          tehsil,
          village,
          survey_khasra,
          approved_area_hectares,
          lease_start_date,
          lease_expiry_date,
          approved_depth_meters,
          ST_AsGeoJSON(boundary)::json AS boundary,
          status,
          metadata,
          created_at,
          updated_at
        FROM mining_leases
        WHERE id = $1
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Mining lease not found"
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
// CREATE LEASE
// ============================================================

router.post(
  "/",

  authenticateToken,

  authorizeRoles(
    "ADMIN",
    "ANALYST"
  ),

  [
    body("lease_number")
      .trim()
      .notEmpty(),

    body("owner_name")
      .trim()
      .notEmpty(),

    body("boundary")
      .isObject()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        lease_number,
        owner_name,
        mineral_type,
        district,
        tehsil,
        village,
        survey_khasra,
        approved_area_hectares,
        lease_start_date,
        lease_expiry_date,
        approved_depth_meters,
        boundary,
        metadata = {}
      } = req.body;

      if (
        boundary.type !== "Polygon" &&
        boundary.type !== "MultiPolygon"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Boundary must be a GeoJSON Polygon or MultiPolygon"
        });
      }

      const geoJsonString =
        JSON.stringify(boundary);

      const result = await query(
        `
        INSERT INTO mining_leases (
          lease_number,
          owner_name,
          mineral_type,
          district,
          tehsil,
          village,
          survey_khasra,
          approved_area_hectares,
          lease_start_date,
          lease_expiry_date,
          approved_depth_meters,
          boundary,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          ST_Multi(
            ST_SetSRID(
              ST_GeomFromGeoJSON($12),
              4326
            )
          ),
          $13
        )
        RETURNING
          id,
          lease_number,
          owner_name,
          mineral_type,
          district,
          tehsil,
          village,
          survey_khasra,
          approved_area_hectares,
          lease_start_date,
          lease_expiry_date,
          approved_depth_meters,
          ST_AsGeoJSON(boundary)::json AS boundary,
          status,
          metadata,
          created_at
        `,
        [
          lease_number,
          owner_name,
          mineral_type || null,
          district || null,
          tehsil || null,
          village || null,
          survey_khasra || null,
          approved_area_hectares || null,
          lease_start_date || null,
          lease_expiry_date || null,
          approved_depth_meters || null,
          geoJsonString,
          metadata
        ]
      );

      res.status(201).json({
        success: true,
        message: "Mining lease created",
        data: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// DELETE LEASE
// ============================================================

router.delete(
  "/:id",

  authenticateToken,

  authorizeRoles("ADMIN"),

  [
    param("id").isUUID()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const result = await query(
        `
        DELETE FROM mining_leases
        WHERE id = $1
        RETURNING id
        `,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Mining lease not found"
        });
      }

      res.json({
        success: true,
        message: "Mining lease deleted"
      });

    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;
