import { asyncHandler } from '../utils/errorHandler.js';
import { importCompanyData, getDataStatus } from '../services/dataImportService.js';

/**
 * Get data import status
 * @route GET /api/data/status
 */
export const getStatus = asyncHandler(async (req, res) => {
  const status = await getDataStatus();
  res.json(status);
});

/**
 * Import company data
 * @route POST /api/data/import
 */
export const importData = asyncHandler(async (req, res) => {
  const { limit = 100 } = req.body;
  const result = await importCompanyData(limit);
  res.json(result);
}); 