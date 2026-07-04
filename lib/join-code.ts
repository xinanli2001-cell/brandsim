// 加入码：短、可读、排除易混淆字符（0/O, 1/I）。老师建挑战时生成，学生凭码+昵称加入。

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}
