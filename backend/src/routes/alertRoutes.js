const express = require("express");

const {
  authenticateToken
} = require("../middleware/auth");

const {
  query
} = require("../db/pool");

const router = express.Router();


// ============================================================
// GET ALERTS
// ============================================================

router.get(
  "/",

  authenticateToken,

  async (req, res, next) => {
    try {
      const {
        status,
        risk_level,
        page = 1,
        limit = 20
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

      if (status) {
        values.push(status);

        conditions.push(
          `a.status = $${values.length}`
        );
      }

      if (risk_level) {
        values.push(risk_level);

        conditions.push(
          `a.risk_level = $${values.length}`
        );
      }

      const whereClause =
        conditions.length
          ? `WHERE ${conditions.join(" AND ")}`
          : "";

      values.push(limitNumber);
      values.push(offset);

      const result = await query(
        `
        SELECT
          a.id,
          a.alert_type,
          a.risk_level,
          a.status,
          a.title,
          a.reason,
          a.affected_area_hectares,
          a.outside_lease_area_hectares,
          a.created_at,

          l.lease_number,
          l.district,
          l.village

        FROM alerts a

        LEFT JOIN mining_leases l
          ON l.id = a.lease_id

        ${whereClause}

        ORDER BY a.created_at DESC

        LIMIT $${values.length - 1}
        OFFSET $${values.length}
        `,
        values
      );

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: pageNumber,
          limit: limitNumber
        }
      });

    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;
