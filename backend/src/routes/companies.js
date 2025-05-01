import { Router } from 'express';
import { getCompanies, getCompanyById, enrichCompany } from '../controllers/companyController.js';
import { validateRequest, companySearchSchema, companyIdSchema } from '../utils/validation.js';

const router = Router();

// GET /api/companies - Get all companies with filters and pagination
router.get('/', validateRequest(companySearchSchema), getCompanies);

// GET /api/companies/:id - Get a single company by ID
router.get('/:id', validateRequest(companyIdSchema, 'params'), getCompanyById);

// POST /api/companies/:id/enrich - Generate AI enrichment for a company
router.post('/:id/enrich', validateRequest(companyIdSchema, 'params'), enrichCompany);

export default router; 