import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Get all practice subjects
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM practice_subjects ORDER BY display_order, subject_name");
    res.json(result.rows);
  } catch (error) {
    console.error("Practice subjects fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get parent practice subjects
router.get("/parents", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM practice_subjects WHERE parent_id IS NULL ORDER BY display_order, subject_name");
    res.json(result.rows);
  } catch (error) {
    console.error("Practice parent fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get a single practice subject with children
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM practice_subjects WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Practice subject not found" });
    const children = await pool.query("SELECT * FROM practice_subjects WHERE parent_id = $1 ORDER BY display_order, subject_name", [id]);
    res.json({ ...result.rows[0], children: children.rows });
  } catch (error) {
    console.error("Practice subject fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create practice subject
router.post("/", async (req, res) => {
  try {
    const { subject_name, subject_description, parent_id, display_order } = req.body;
    if (!subject_name || subject_name.trim() === "") return res.status(400).json({ error: "Subject name is required" });

    if (parent_id) {
      const parentCheck = await pool.query("SELECT * FROM practice_subjects WHERE id = $1", [parent_id]);
      if (parentCheck.rows.length === 0) return res.status(400).json({ error: "Parent practice subject not found" });
    }

    const existing = await pool.query(
      "SELECT * FROM practice_subjects WHERE LOWER(subject_name) = LOWER($1) AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))",
      [subject_name, parent_id || null]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: "Practice subject already exists" });

    const result = await pool.query(
      `INSERT INTO practice_subjects (subject_name, subject_description, parent_id, display_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [subject_name, subject_description || null, parent_id || null, display_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Practice subject creation error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update practice subject
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_name, subject_description, parent_id, display_order } = req.body;
    const exists = await pool.query("SELECT * FROM practice_subjects WHERE id = $1", [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: "Practice subject not found" });

    if (parent_id !== undefined && parent_id !== null) {
      if (parseInt(parent_id) === parseInt(id)) return res.status(400).json({ error: "Subject cannot be its own parent" });
      const p = await pool.query("SELECT * FROM practice_subjects WHERE id = $1", [parent_id]);
      if (p.rows.length === 0) return res.status(400).json({ error: "Parent practice subject not found" });
    }

    const result = await pool.query(
      `UPDATE practice_subjects SET subject_name = COALESCE($1, subject_name), subject_description = COALESCE($2, subject_description), parent_id = $3, display_order = COALESCE($4, display_order) WHERE id = $5 RETURNING *`,
      [subject_name, subject_description, parent_id !== undefined ? parent_id : exists.rows[0].parent_id, display_order, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Practice subject update error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete practice subject (and cascade deletes to practice questions via FK)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await pool.query("SELECT * FROM practice_subjects WHERE id = $1", [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: "Practice subject not found" });
    await pool.query("DELETE FROM practice_subjects WHERE id = $1", [id]);
    res.json({ message: "Practice subject deleted", id });
  } catch (error) {
    console.error("Practice subject deletion error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
