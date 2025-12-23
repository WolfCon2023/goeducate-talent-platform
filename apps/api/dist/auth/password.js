import bcrypt from "bcryptjs";
export async function hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}
export async function verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
}
//# sourceMappingURL=password.js.map