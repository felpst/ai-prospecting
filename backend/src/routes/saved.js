import { Router } from 'express';
import { getSavedCompanies, saveCompany, unsaveCompany } from '../controllers/savedController.js';

const router = Router();

// GET /api/saved - Get all saved companies
router.get('/', getSavedCompanies);

// POST /api/saved/:companyId - Save a company
router.post('/:companyId', saveCompany);

// DELETE /api/saved/:companyId - Remove a company from saved list
router.delete('/:companyId', unsaveCompany);

export default router; 