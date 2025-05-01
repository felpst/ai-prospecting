import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Company from '../models/company.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Import company data from the JSON file
 * @param {number} limit - Maximum number of companies to import
 */
export const importCompanyData = async (limit = 100) => {
  try {
    // Get the path to the company dataset
    const datasetPath = path.resolve(process.cwd(), '../../company_dataset.json');
    
    console.log(`Importing up to ${limit} companies from ${datasetPath}`);
    
    // Check if file exists
    if (!fs.existsSync(datasetPath)) {
      console.error(`File not found: ${datasetPath}`);
      return { success: false, message: 'Dataset file not found' };
    }
    
    // Read the file
    const data = fs.readFileSync(datasetPath, 'utf8');
    
    // Parse the JSON
    let companies = JSON.parse(data);
    
    // Limit the number of companies for development
    companies = companies.slice(0, limit);
    
    console.log(`Parsed ${companies.length} companies from dataset`);
    
    // Check if we already have companies in the database
    const count = await Company.countDocuments();
    if (count > 0) {
      console.log(`Database already has ${count} companies. Skipping import.`);
      return { success: true, message: `Database already has ${count} companies` };
    }
    
    // Insert companies
    await Company.insertMany(companies);
    
    console.log(`Successfully imported ${companies.length} companies`);
    
    return { 
      success: true, 
      message: `Imported ${companies.length} companies` 
    };
  } catch (error) {
    console.error('Error importing company data:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Check data import status
 */
export const getDataStatus = async () => {
  try {
    const count = await Company.countDocuments();
    return {
      success: true,
      count,
      isImported: count > 0
    };
  } catch (error) {
    console.error('Error checking data status:', error);
    return { success: false, message: error.message };
  }
}; 