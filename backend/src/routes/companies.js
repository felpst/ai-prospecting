import { Router } from 'express';
import { getCompanies, getCompanyById, enrichCompany } from '../controllers/companyController.js';

const router = Router();

// GET /api/companies - Get all companies with filters and pagination
router.get('/', getCompanies);

// GET /api/companies/:id - Get a single company by ID
router.get('/:id', getCompanyById);

// POST /api/companies/:id/enrich - Generate AI enrichment for a company
router.post('/:id/enrich', enrichCompany);

export default router; 