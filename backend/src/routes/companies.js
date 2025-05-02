import { Router } from 'express';
import * as companyController from '../controllers/companyController.js';
import { cacheCompanyDetails } from '../middleware/cacheMiddleware.js';
import { cacheTTL } from '../utils/cacheConfig.js';
import { validateRequest } from '../utils/validation.js';
import { companySearchSchema, companyIdSchema } from '../utils/validation.js';

const router = Router();

// GET /api/companies - Get all companies with filters and pagination
router.get('/', validateRequest(companySearchSchema), companyController.getCompanies);

// GET /api/companies/:id - Get a single company by ID
router.get('/:id', validateRequest(companyIdSchema, 'params'), cacheCompanyDetails(cacheTTL.COMPANY_DETAILS), companyController.getCompanyById);

// POST /api/companies/:id/enrich - Generate AI enrichment for a company
router.post('/:id/enrich', validateRequest(companyIdSchema, 'params'), companyController.enrichCompany);

export default router; 