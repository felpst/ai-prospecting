import { getDataStatus, importCompanyData } from '../services/dataImportService.js';

/**
 * Initialize the database with a small subset of the data
 * This is used during development to make sure we have some data to work with
 */
export const initializeData = async () => {
  try {
    // Check if we already have data
    const status = await getDataStatus();
    
    if (status.isImported) {
      console.log(`Database already contains ${status.count} companies. Skipping import.`);
      return;
    }
    
    // Import a small number of companies for development
    console.log('No company data found. Importing a small subset...');
    const result = await importCompanyData(100);
    
    if (result.success) {
      console.log(`Successfully initialized database: ${result.message}`);
    } else {
      console.warn(`Failed to initialize data: ${result.message}`);
    }
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}; 