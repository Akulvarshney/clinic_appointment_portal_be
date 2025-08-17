import { Router } from "express";
import { loginMiddleware } from "../../middleware/authMiddleware.js";
import {
  createRoleController,
  createEmployeeController,
  getRolesController,
  createDoctorController,
  getEmployeesController,
  getTabsAndFeaturesByRoleController,
  getDoctorController,
  updateTabAndFeatureAccess,
  updateRoleController,
  getUserDetails,
} from "../../controller/userMgmtController.js";
import {
  validateCreateRole,
  validateCreateUser,
  validateGetDetials,
  validateCreateDoctor,
} from "../../validations/clientAdminValidations.js";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../../controller/categoriesManagement.js";

const router = Router();

router.post("/createRole", validateCreateRole, createRoleController);
router.get("/getRoles", validateGetDetials, getRolesController);

router.get("/getTabsAndFeaturesByRole", getTabsAndFeaturesByRoleController);

router.post("/updateTabAndFeatureAccess", updateTabAndFeatureAccess);

router.post("/createEmployee", validateCreateUser, createEmployeeController);
router.get("/getEmployees", validateGetDetials, getEmployeesController);
router.put("/updateUserRole", updateRoleController);

router.post("/createDoctor", validateCreateDoctor, createDoctorController);
router.get("/getDoctors", validateGetDetials, getDoctorController);

router.post("/category", createCategory);
router.get("/category", getCategories);
router.get("/category/:id", getCategoryById);
router.put("/category/:id", updateCategory);
router.delete("/category/:id", deleteCategory);

router.get("/getUserDetails/:userId", getUserDetails);

export default router;
