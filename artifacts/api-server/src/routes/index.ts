import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminUsersRouter from "./admin-users";
import adminInventoryRouter from "./admin-inventory";
import trackScanRouter from "./track-scan";
import adminConfigRouter from "./admin-config";
import adminVendorEmailRouter from "./admin-vendor-email";
import commsPublicRouter from "./comms-public";
import commsAdminRouter from "./comms-admin";
import commsWebhooksRouter from "./comms-webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminUsersRouter);
router.use(adminInventoryRouter);
router.use(trackScanRouter);
router.use(adminConfigRouter);
router.use(adminVendorEmailRouter);
router.use(commsPublicRouter);
router.use(commsAdminRouter);
router.use(commsWebhooksRouter);

export default router;
