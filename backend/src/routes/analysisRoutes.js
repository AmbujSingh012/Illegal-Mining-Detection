const express = require("express");

const {
  body
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

const {
  analyzeImages
} = require("../services/aiService");

const router = express.Router();


// ============================================================
// START AI ANALYSIS
// ============================================================

router.post(
  "/",

  authenticateToken,

  authorizeRoles(
    "ADMIN",
    "ANALYST"
  ),

  [
    body("lease_id")
      .isUUID(),

    body("before_image_id")
      .isUUID(),

    body("after_image_id")
      .isUUID()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        lease_id,
        before_image_id,
        after_image_id,
        dem_image_id
      } = req.body;

      const leaseResult = await query(
        `
        SELECT
          id,
          lease_number,
          ST_AsGeoJSON(boundary)::json AS boundary
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

      const imageResult = await query(
        `
        SELECT
          id,
          file_path,
          acquisition_date,
          crs,
          metadata
        FROM satellite_images
        WHERE id = ANY($1::uuid[])
        `,
        [[
          before_image_id,
          after_image_id,
          ...(dem_image_id
            ? [dem_image_id]
            : [])
        ]]
      );

      if (
        imageResult.rows.length < 2
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Before and after satellite images are required"
        });
      }

      const beforeImage =
        imageResult.rows.find(
          image =>
            image.id === before_image_id
        );

      const afterImage =
        imageResult.rows.find(
          image =>
            image.id === after_image_id
        );

      if (!beforeImage || !afterImage) {
        return res.status(400).json({
          success: false,
          message:
            "Unable to resolve before/after images"
        });
      }

      const aiPayload = {
        lease: {
          id: lease_id,
          boundary:
            leaseResult.rows[0].boundary
        },

        before_image: {
          id: beforeImage.id,
          file_path:
            beforeImage.file_path,
          acquisition_date:
            beforeImage.acquisition_date,
          crs: beforeImage.crs
        },

        after_image: {
          id: afterImage.id,
          file_path:
            afterImage.file_path,
          acquisition_date:
            afterImage.acquisition_date,
          crs: afterImage.crs
        },

        dem_image: dem_image_id
          ? imageResult.rows.find(
              image =>
                image.id === dem_image_id
            )
          : null,

        options: {
          generate_evidence: true,
          calculate_boundary_intersection: true
        }
      };

      const aiResult =
        await analyzeImages(aiPayload);

      res.status(200).json({
        success: true,

        message:
          "AI analysis completed",

        data: aiResult
      });

    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;
