import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { cleanOcrText } = await import("../src/modules/visual-shopping/ocr.service.js");

test("cleanOcrText: giữ từ ≥3 ký tự có chữ cái, loại nhiễu", () => {
  assert.equal(cleanOcrText("STARBUCKS coffee @#$ ab 12 XYZ!"), "STARBUCKS COFFEE XYZ");
});

test("cleanOcrText: bỏ trùng lặp, giới hạn 6 từ", () => {
  const result = cleanOcrText("coffee coffee coffee tea abc de fgh ijk lmn opq");
  assert.equal(result.split(" ").length, 6);
  assert.equal(new Set(result.split(" ")).size, result.split(" ").length);
});

test("cleanOcrText: trả null khi không có chữ hợp lệ", () => {
  assert.equal(cleanOcrText("12 34 @#"), null);
  assert.equal(cleanOcrText(""), null);
  assert.equal(cleanOcrText(null), null);
});
