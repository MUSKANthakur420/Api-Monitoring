import { Router } from "express";
import userController from "../controller/user.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);

// Protected routes
router.get("/me", verifyJWT, userController.getCurrentUser);
router.post("/logout", verifyJWT, userController.logoutUser);
router.put("/update", verifyJWT, userController.UpdateUser);
router.delete("/delete", verifyJWT, userController.deleteUser);

export default router;
