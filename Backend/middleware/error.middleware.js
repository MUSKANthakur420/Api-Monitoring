import { apierror } from "../utils/apierror.js";

export const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof apierror)) {
        const statusCode = error.statusCode || error.status || 500;
        const message = error.message || "Internal Server Error";
        error = new apierror(statusCode, message, error?.errors || [], err.stack);
    }

    const response = {
        statuscode: error.statuscode || 500,
        message: error.message,
        success: false,
        errors: error.errors || [],
        ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
    };

    return res.status(error.statuscode || 500).json(response);
};

export default errorHandler;
