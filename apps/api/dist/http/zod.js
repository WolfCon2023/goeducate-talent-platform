import { ApiError } from "./errors.js";
export function zodToBadRequest(details) {
    return new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid request",
        details
    });
}
//# sourceMappingURL=zod.js.map