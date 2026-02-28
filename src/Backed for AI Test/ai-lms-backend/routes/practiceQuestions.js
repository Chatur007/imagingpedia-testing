import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../db.js";

const router = express.Router();

const uploadsPath = path.join(process.cwd(), "uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  },
});
const upload = multer({ storage });

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM practice_questions ORDER BY subject_id, id"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Practice questions fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/subject/:subjectId", async (req, res) => {
  try {
    const { subjectId } = req.params;
    const result = await pool.query(
      "SELECT * FROM practice_questions WHERE subject_id = $1 ORDER BY id",
      [subjectId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Practice questions fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM practice_questions WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Question not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Practice question fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const { subject_id, question_text, question_image, model_answer, max_marks } = req.body;
    let imagePath = question_image || null;
    if (req.file) imagePath = `/uploads/${req.file.filename}`;

    if (!subject_id || !model_answer) return res.status(400).json({ error: "Missing required fields" });

    // Ensure the referenced practice subject exists. If not, try to copy from main subjects or create a minimal record.
    const subjId = parseInt(subject_id, 10);
    if (isNaN(subjId)) return res.status(400).json({ error: "Invalid subject_id" });
    try {
      const check = await pool.query("SELECT id FROM practice_subjects WHERE id = $1", [subjId]);
      if (check.rowCount === 0) {
        // Try to copy from main subjects
        const main = await pool.query("SELECT subject_name, parent_id, subject_description, display_order, created_at FROM subjects WHERE id = $1", [subjId]);
        if (main.rowCount > 0) {
          const m = main.rows[0];
          await pool.query(
            "INSERT INTO practice_subjects(id, subject_name, parent_id, subject_description, display_order, created_at) VALUES($1,$2,$3,$4,$5,$6)",
            [subjId, m.subject_name, m.parent_id || null, m.subject_description || null, m.display_order || 0, m.created_at || new Date()]
          );
        } else {
          // Create a minimal placeholder subject
          await pool.query(
            "INSERT INTO practice_subjects(id, subject_name, created_at) VALUES($1,$2,$3)",
            [subjId, `Subject ${subjId}`, new Date()]
          );
        }
        // Optionally advance the sequence to avoid conflicts on future inserts
        try {
          await pool.query(`SELECT setval(pg_get_serial_sequence('practice_subjects','id'), COALESCE((SELECT MAX(id) FROM practice_subjects), 1), true)`);
        } catch (e) {
          // ignore sequence update errors
        }
      }
    } catch (e) {
      console.error("Error ensuring practice subject exists:", e.message || e);
    }

    const result = await pool.query(
      "INSERT INTO practice_questions(subject_id, question_text, question_image, model_answer, max_marks) VALUES($1, $2, $3, $4, $5) RETURNING *",
      [subject_id, question_text || null, imagePath, model_answer, max_marks || 10]
    );

    console.log("Practice question created:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Practice question creation error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { subject_id, question_text, question_image, model_answer, max_marks } = req.body;

    const exists = await pool.query("SELECT * FROM practice_questions WHERE id = $1", [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: "Question not found" });

    let imagePath = question_image || exists.rows[0].question_image || null;
    if (req.file) {
      const oldPath = exists.rows[0].question_image;
      if (oldPath && oldPath.startsWith("/uploads/")) {
        const oldFile = path.join(process.cwd(), oldPath.replace("/", ""));
        try { fs.unlinkSync(oldFile); } catch (e) { }
      }
      imagePath = `/uploads/${req.file.filename}`;
    }

    // Ensure the referenced practice subject exists when updating
    const subjId = parseInt(subject_id, 10);
    if (isNaN(subjId)) return res.status(400).json({ error: "Invalid subject_id" });
    try {
      const check = await pool.query("SELECT id FROM practice_subjects WHERE id = $1", [subjId]);
      if (check.rowCount === 0) {
        const main = await pool.query("SELECT subject_name, parent_id, subject_description, display_order, created_at FROM subjects WHERE id = $1", [subjId]);
        if (main.rowCount > 0) {
          const m = main.rows[0];
          await pool.query(
            "INSERT INTO practice_subjects(id, subject_name, parent_id, subject_description, display_order, created_at) VALUES($1,$2,$3,$4,$5,$6)",
            [subjId, m.subject_name, m.parent_id || null, m.subject_description || null, m.display_order || 0, m.created_at || new Date()]
          );
        } else {
          await pool.query("INSERT INTO practice_subjects(id, subject_name, created_at) VALUES($1,$2,$3)", [subjId, `Subject ${subjId}`, new Date()]);
        }
        try {
          await pool.query(`SELECT setval(pg_get_serial_sequence('practice_subjects','id'), COALESCE((SELECT MAX(id) FROM practice_subjects), 1), true)`);
        } catch (e) { }
      }
    } catch (e) {
      console.error("Error ensuring practice subject exists (update):", e.message || e);
    }

    const result = await pool.query(
      "UPDATE practice_questions SET subject_id = $1, question_text = $2, question_image = $3, model_answer = $4, max_marks = $5 WHERE id = $6 RETURNING *",
      [subjId, question_text || null, imagePath, model_answer, max_marks || 10, id]
    );

    console.log("Practice question updated:", result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Practice question update error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await pool.query("SELECT * FROM practice_questions WHERE id = $1", [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: "Question not found" });

    const img = exists.rows[0].question_image;
    if (img && img.startsWith("/uploads/")) {
      const fileOnDisk = path.join(process.cwd(), img.replace("/", ""));
      try { fs.unlinkSync(fileOnDisk); } catch (e) { }
    }

    await pool.query("DELETE FROM practice_questions WHERE id = $1", [id]);
    console.log("Practice question deleted:", id);
    res.json({ message: "Practice question deleted successfully", id });
  } catch (error) {
    console.error("Practice question deletion error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
