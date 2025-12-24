export class ApiError extends Error {
    status;
    code;
    details;
    constructor(args) {
        super(args.message);
        this.status = args.status;
        this.code = args.code;
        this.details = args.details;
    }
}
export function errorHandler(err, req, res, _next) {
    if (err instanceof ApiError) {
        return res.status(err.status).json({
            error: { code: err.code, message: err.message, details: err.details }
        });
    }
    console.error(err);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } });
}
//# sourceMappingURL=errors.js.map