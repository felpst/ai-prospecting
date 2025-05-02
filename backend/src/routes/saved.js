import { Router } from 'express';
import { getSavedCompanies, saveCompany, unsaveCompany, checkIfSaved } from '../controllers/savedController.js';

const router = Router();

// GET /api/saved - Get all saved companies
router.get('/', getSavedCompanies);

// GET /api/saved/:companyId/check - Check if a company is saved
router.get('/:companyId/check', checkIfSaved);

// POST /api/saved/:companyId - Save a company
router.post('/:companyId', saveCompany);

// DELETE /api/saved/:companyId - Remove a company from saved list
router.delete('/:companyId', unsaveCompany);

export default router; 