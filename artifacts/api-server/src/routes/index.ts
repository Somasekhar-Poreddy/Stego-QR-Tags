import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminUsersRouter from "./admin-users";
import trackScanRouter from "./track-scan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminUsersRouter);
router.use(trackScanRouter);

export default router;
