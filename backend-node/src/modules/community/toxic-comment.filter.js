import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const VIETNAMESE_WORDLIST_PATH = fileURLToPath(
  new URL("../../../data/vietnamese-offensive-words.txt", import.meta.url),
);
const ENGLISH_WORDLIST_PATH = fileURLToPath(
  new URL("../../../data/profane-words.json", import.meta.url),
);

export const TOXIC_COMMENT_WARNING =
  "Bình luận có thể chứa ngôn từ không phù hợp. Vui lòng kiểm tra lại nội dung.";

const LEETSPEAK_MAP = new Map([
  ["@", "a"],
  ["$", "s"],
  ["0", "o"],
  ["1", "i"],
  ["3", "e"],
  ["4", "a"],
  ["5", "s"],
  ["7", "t"],
  ["8", "b"],
  ["9", "g"],
]);

// NFKD tách dấu khỏi ký tự gốc; bỏ combining marks và chuẩn hóa đ/Đ.
// Emoji, dấu câu và mọi ký tự không phải chữ/số được đổi thành khoảng trắng
// để chúng trở thành word boundary thay vì che mất từ đứng cạnh.
export const normalizeForToxicFilter = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[’‘`´]/g, "")
    .replace(/[@$01345789]/g, (character) => LEETSPEAK_MAP.get(character))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const loadVietnameseWords = () => {
  const content = readFileSync(VIETNAMESE_WORDLIST_PATH, "utf8").replace(/^\uFEFF/, "");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
};

const loadEnglishWords = () => {
  const content = readFileSync(ENGLISH_WORDLIST_PATH, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
};

const createNode = () => ({ children: new Map(), fail: null, outputs: [] });

export const buildAhoCorasick = (terms) => {
  const root = createNode();
  const uniqueTerms = new Set();

  for (const rawTerm of terms) {
    const term = normalizeForToxicFilter(rawTerm);
    // Từ khóa một ký tự sau normalization tạo quá nhiều false positive,
    // đặc biệt với các mẫu chỉ gồm ký tự đặc biệt như "b`".
    if (term.length < 2 || uniqueTerms.has(term)) continue;
    uniqueTerms.add(term);

    let node = root;
    for (const character of Array.from(term)) {
      if (!node.children.has(character)) node.children.set(character, createNode());
      node = node.children.get(character);
    }
    node.outputs.push(term);
  }

  const queue = [];
  for (const child of root.children.values()) {
    child.fail = root;
    queue.push(child);
  }

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    for (const [character, child] of current.children) {
      let fallback = current.fail;
      while (fallback && !fallback.children.has(character)) fallback = fallback.fail;
      child.fail = fallback?.children.get(character) || root;
      if (child.fail !== child) child.outputs.push(...child.fail.outputs);
      queue.push(child);
    }
  }

  return { root, size: uniqueTerms.size };
};

const isWordCharacter = (character) => Boolean(character && /[\p{L}\p{N}]/u.test(character));

export const findToxicTerms = (automaton, value) => {
  const text = normalizeForToxicFilter(value);
  if (!text) return [];

  const matches = new Set();
  let node = automaton.root;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    while (node !== automaton.root && !node.children.has(character)) {
      node = node.fail;
    }
    node = node.children.get(character) || automaton.root;

    for (const term of node.outputs) {
      const start = index - term.length + 1;
      const end = index + 1;
      const isStartBoundary = start === 0 || !isWordCharacter(text[start - 1]);
      const isEndBoundary = end === text.length || !isWordCharacter(text[end]);
      if (isStartBoundary && isEndBoundary) matches.add(term);
    }
  }

  return [...matches];
};

let automaton;

export const getToxicAutomaton = () => {
  if (!automaton) {
    automaton = buildAhoCorasick([
      ...loadVietnameseWords(),
      ...loadEnglishWords(),
    ]);
  }
  return automaton;
};

export const detectToxicContent = (value) => {
  const matches = findToxicTerms(getToxicAutomaton(), value);
  return { isToxic: matches.length > 0, matches };
};
