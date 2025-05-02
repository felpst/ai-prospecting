import User from '../models/user.js';
import Company from '../models/company.js';
import { ApiError, asyncHandler } from '../utils/errorHandler.js';

// Helper to get or create a user
// In a real app, this would use authentication to identify the user
// For this demo, we'll create a default user if none exists
const getOrCreateUser = async () => {
  // Use a fixed email for demo purposes
  const defaultEmail = 'demo@example.com';
  
  let user = await User.findOne({ email: defaultEmail });
  
  if (!user) {
    user = new User({
      email: defaultEmail,
      saved_companies: []
    });
    await user.save();
  }
  
  return user;
};

/**
 * Get all saved companies
 * @route GET /api/saved
 */
export const getSavedCompanies = asyncHandler(async (req, res) => {
  const user = await getOrCreateUser();
  
  // If no saved companies, return empty array
  if (!user.saved_companies || user.saved_companies.length === 0) {
    return res.json([]);
  }
  
  // Get all saved companies
  const companies = await Company.find({
    id: { $in: user.saved_companies }
  }).lean();
  
  res.json(companies);
});

/**
 * Check if a company is saved
 * @route GET /api/saved/:companyId/check
 */
export const checkIfSaved = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const user = await getOrCreateUser();
  
  const isSaved = user.saved_companies.includes(companyId);
  
  res.json({
    isSaved,
    companyId
  });
});

/**
 * Save a company
 * @route POST /api/saved/:companyId
 */
export const saveCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  
  // Check if company exists
  const company = await Company.findOne({ id: companyId });
  
  if (!company) {
    throw new ApiError(`Company with ID ${companyId} not found`, 404);
  }
  
  const user = await getOrCreateUser();
  
  // Add company to saved list if not already there
  if (!user.saved_companies.includes(companyId)) {
    user.saved_companies.push(companyId);
    await user.save();
  }
  
  res.json({
    message: 'Company saved successfully',
    companyId
  });
});

/**
 * Remove company from saved list
 * @route DELETE /api/saved/:companyId
 */
export const unsaveCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  
  const user = await getOrCreateUser();
  
  // Remove company from saved list
  user.saved_companies = user.saved_companies.filter(id => id !== companyId);
  await user.save();
  
  res.json({
    message: 'Company removed from saved list',
    companyId
  });
}); 