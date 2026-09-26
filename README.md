# AI-Based Illegal Mining & Environmental Damage Detection System

An AI-powered geospatial monitoring platform for detecting probable excavation, mining-related land-use changes and possible boundary violations using satellite imagery, computer vision and GIS analysis.

> **Important:** This system provides decision-support information. It does not independently declare an activity legally illegal. Final determination requires authorized field verification.

## Features

- Satellite before/after image comparison
- Computer-vision based change detection
- Mining lease boundary visualization
- Geospatial boundary intersection
- Inside/outside lease area calculation
- Interactive GIS dashboard
- Automated alerts
- Investigation case management
- Officer field verification
- Geo-tagged inspection information
- Automated PDF case reports
- PostgreSQL + PostGIS spatial database
- FastAPI AI/geospatial service
- Express.js REST API
- JWT authentication
- Docker Compose deployment

## Architecture

```text
React + Vite
     |
     | REST API
     v
Node.js + Express
     |
     +-------------------+
     |                   |
     v                   v
PostgreSQL/PostGIS    FastAPI AI Engine
                         |
                         v
                  Image Change Detection
                         |
                         v
                  Geospatial Analysis
