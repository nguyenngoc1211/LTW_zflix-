import dotenv from "dotenv";
import { detectToxicContent } from "../src/modules/community/toxic-comment.filter.js";

dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url), override: false });
const { pool } = await import("../src/core/database/pool.js");

const addColumnIfMissing = async (tableName, columnName, definition) => {
  const [columns] = await pool.execute(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1`,
    [tableName, columnName],
  );

  if (columns.length) return false;
  await pool.query(
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`,
  );
  return true;
};

try {
  const commentsAdded = await addColumnIfMissing(
    "comments",
    "is_toxic",
    "TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`",
  );
  console.log(commentsAdded ? "Added comments.is_toxic" : "comments.is_toxic already exists");

  if (commentsAdded) {
    const [comments] = await pool.query("SELECT id, content FROM comments");
    let flagged = 0;
    for (const comment of comments) {
      if (!detectToxicContent(comment.content).isToxic) continue;
      await pool.execute("UPDATE comments SET is_toxic=1 WHERE id=?", [comment.id]);
      flagged += 1;
    }
    console.log(`Flagged ${flagged} existing comments`);
  }

  const ratingsAdded = await addColumnIfMissing(
    "ratings",
    "is_toxic",
    "TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_edited`",
  );
  console.log(ratingsAdded ? "Added ratings.is_toxic" : "ratings.is_toxic already exists");

  if (ratingsAdded) {
    const [ratings] = await pool.query(
      "SELECT user_id, production_id, review_title, review_content FROM ratings",
    );
    let flagged = 0;
    for (const rating of ratings) {
      const content = [rating.review_title, rating.review_content]
        .filter(Boolean)
        .join("\n");
      if (!detectToxicContent(content).isToxic) continue;
      await pool.execute(
        "UPDATE ratings SET is_toxic=1 WHERE user_id=? AND production_id=?",
        [rating.user_id, rating.production_id],
      );
      flagged += 1;
    }
    console.log(`Flagged ${flagged} existing ratings`);
  }
} finally {
  await pool.end();
}
