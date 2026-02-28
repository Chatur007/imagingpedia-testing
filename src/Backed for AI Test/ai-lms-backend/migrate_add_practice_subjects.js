import { pool } from './db.js';

const run = async () => {
  try {
    console.log('Running migration: create practice_subjects table if missing');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS practice_subjects (
        id SERIAL PRIMARY KEY,
        subject_name TEXT NOT NULL,
        subject_description TEXT,
        parent_id INTEGER REFERENCES practice_subjects(id) ON DELETE CASCADE,
        display_order INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
