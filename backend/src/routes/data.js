import { Router } from 'express';
import { getStatus, importData } from '../controllers/dataController.js';

const router = Router();

// GET /api/data/status - Get data import status
router.get('/status', getStatus);

// POST /api/data/import - Import company data
router.post('/import', importData);

export default router; 