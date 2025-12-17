import { ApiError } from "./errors";

export function zodToBadRequest(details: unknown) {
  return new ApiError({
    status: 400,
    code: "BAD_REQUEST",
    message: "Invalid request",
    details
  });
}


