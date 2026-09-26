const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { body } = require("express-validator");

const { query } = require("../db/pool");

const {
  handleValidationErrors
} = require("../utils/validation");

const {
  authenticateToken
} = require("../middleware/auth");

const router = express.Router();


// ============================================================
// REGISTER
// ============================================================

router.post(
  "/register",

  [
    body("name")
      .trim()
      .isLength({ min: 2, max: 150 }),

    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),

    body("password")
      .isLength({ min: 8 }),

    body("role")
      .optional()
      .isIn([
        "ADMIN",
        "OFFICER",
        "ANALYST"
      ])
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        name,
        email,
        password,
        role = "ANALYST"
      } = req.body;

      const existingUser = await query(
        `
        SELECT id
        FROM users
        WHERE email = $1
        `,
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already registered"
        });
      }

      const passwordHash =
        await bcrypt.hash(password, 12);

      const result = await query(
        `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, role, created_at
        `,
        [
          name,
          email,
          passwordHash,
          role
        ]
      );

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// LOGIN
// ============================================================

router.post(
  "/login",

  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),

    body("password")
      .notEmpty()
  ],

  handleValidationErrors,

  async (req, res, next) => {
    try {
      const {
        email,
        password
      } = req.body;

      const result = await query(
        `
        SELECT
          id,
          name,
          email,
          password_hash,
          role,
          is_active
        FROM users
        WHERE email = $1
        `,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: "User account is inactive"
        });
      }

      const passwordValid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          role: user.role
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "8h"
        }
      );

      res.json({
        success: true,

        message: "Login successful",

        token,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      next(error);
    }
  }
);


// ============================================================
// CURRENT USER
// ============================================================

router.get(
  "/me",

  authenticateToken,

  async (req, res) => {
    res.json({
      success: true,
      user: req.user
    });
  }
);


module.exports = router;
