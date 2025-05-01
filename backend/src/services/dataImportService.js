import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import Company from '../models/company.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Import company data from the JSON Lines file with batch processing
 * @param {number} limit - Maximum number of companies to import
 * @param {number} batchSize - Size of each batch for import
 */
export const importCompanyData = async (limit = 100, batchSize = 100) => {
  try {
    // Get the path to the company dataset
    const datasetPath = path.resolve(process.cwd(), '../company_dataset.json');
    
    console.log(`Importing up to ${limit} companies from ${datasetPath}`);
    
    // Check if file exists
    if (!fs.existsSync(datasetPath)) {
      console.error(`File not found: ${datasetPath}`);
      return { success: false, message: 'Dataset file not found' };
    }
    
    // Check if we already have companies in the database
    const count = await Company.countDocuments();
    if (count > 0) {
      console.log(`Database already has ${count} companies. Skipping import.`);
      return { success: true, message: `Database already has ${count} companies` };
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Create read stream and line interface
        const fileStream = fs.createReadStream(datasetPath);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });
        
        let companiesProcessed = 0;
        let companiesImported = 0;
        let currentBatch = [];
        
        console.log(`Processing file in line-by-line streaming mode...`);
        
        // Process each line (company) as it's read
        rl.on('line', async (line) => {
          // Stop if we've reached the limit
          if (companiesProcessed >= limit) {
            return;
          }
          
          try {
            // Parse the JSON line
            const company = JSON.parse(line);
            companiesProcessed++;
            
            // Add to current batch
            currentBatch.push(company);
            
            // Process the batch when it reaches the batch size
            if (currentBatch.length >= batchSize || companiesProcessed >= limit) {
              // Pause line reading to avoid memory pressure
              rl.pause();
              
              try {
                // Insert the batch
                await Company.insertMany(currentBatch);
                companiesImported += currentBatch.length;
                
                const progress = Math.min(100, Math.round((companiesProcessed / limit) * 100));
                console.log(`Progress: ${progress}% (${companiesImported}/${limit} companies imported)`);
                
                // Clear the batch
                currentBatch = [];
                
                // Resume line reading
                rl.resume();
              } catch (error) {
                console.error(`Error inserting batch: ${error.message}`);
                // Resume the stream for next batch despite error
                rl.resume();
              }
            }
          } catch (error) {
            console.error(`Error parsing JSON line: ${error.message}`);
            // Skip this line and continue
            companiesProcessed++;
          }
        });
        
        // Handle the end of the stream
        rl.on('close', async () => {
          // Insert any remaining companies
          if (currentBatch.length > 0) {
            try {
              await Company.insertMany(currentBatch);
              companiesImported += currentBatch.length;
            } catch (error) {
              console.error(`Error inserting final batch: ${error.message}`);
            }
          }
          
          console.log(`Import completed: ${companiesImported} companies imported`);
          resolve({ 
            success: true, 
            message: `Imported ${companiesImported} companies` 
          });
        });
        
        // Handle errors
        fileStream.on('error', (error) => {
          console.error(`Stream error: ${error.message}`);
          reject({ success: false, message: error.message });
        });
      } catch (error) {
        console.error(`Setup error: ${error.message}`);
        reject({ success: false, message: error.message });
      }
    });
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

/**
 * Clear all companies from the database
 * @warning This will delete all company data
 */
export const clearCompanyData = async () => {
  try {
    await Company.deleteMany({});
    console.log('Cleared all company data from database');
    return { success: true, message: 'Cleared all company data' };
  } catch (error) {
    console.error('Error clearing company data:', error);
    return { success: false, message: error.message };
  }
}; 