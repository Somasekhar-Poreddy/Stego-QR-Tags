import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminUsersRouter from "./admin-users";
import adminInventoryRouter from "./admin-inventory";
import trackScanRouter from "./track-scan";
import adminConfigRouter from "./admin-config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminUsersRouter);
router.use(adminInventoryRouter);
router.use(trackScanRouter);
router.use(adminConfigRouter);

export default router;
