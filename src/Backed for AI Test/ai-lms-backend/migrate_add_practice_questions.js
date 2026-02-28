import { pool } from './db.js';

const run = async () => {
  try {
    console.log('Running migration: create practice_questions table if missing');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS practice_questions (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        question_text TEXT,
        question_image TEXT,
        model_answer TEXT,
        max_marks INTEGER DEFAULT 10,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
};

run();
