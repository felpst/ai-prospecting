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
      console.log(`Database already has ${count} companies. Continuing import.`);
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
        let companiesSkipped = 0;
        let companiesFailed = 0;
        let currentBatch = [];
        let seenIds = new Set(); // Track IDs we've seen to prevent duplicates
        
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
            
            // Skip duplicates
            if (seenIds.has(company.id)) {
              companiesSkipped++;
              return;
            }
            
            // Add ID to tracking set
            seenIds.add(company.id);
            
            // Add to current batch
            currentBatch.push(company);
            
            // Process the batch when it reaches the batch size
            if (currentBatch.length >= batchSize || companiesProcessed >= limit) {
              // Pause line reading to avoid memory pressure
              rl.pause();
              
              try {
                // Insert the batch with ordered:false to continue on error
                await Company.insertMany(currentBatch, { ordered: false });
                companiesImported += currentBatch.length;
                
                const progress = Math.min(100, Math.round((companiesProcessed / limit) * 100));
                console.log(`Progress: ${progress}% (${companiesImported} companies imported, ${companiesSkipped} skipped, ${companiesFailed} failed)`);
                
                // Clear the batch
                currentBatch = [];
                
                // Resume line reading
                rl.resume();
              } catch (error) {
                // With ordered:false, some documents may have been inserted despite errors
                if (error.writeErrors) {
                  // Count how many actually failed vs succeeded
                  const failedInBatch = error.writeErrors.length;
                  const succeededInBatch = currentBatch.length - failedInBatch;
                  
                  companiesFailed += failedInBatch;
                  companiesImported += succeededInBatch;
                  
                  // Extract duplicate key errors for logging
                  const duplicateIds = error.writeErrors
                    .filter(err => err.code === 11000)
                    .map(err => {
                      try {
                        // Extract ID from error message 
                        const match = err.errmsg.match(/id:\s*"([^"]+)"/);
                        return match ? match[1] : 'unknown';
                      } catch (e) {
                        return 'unparseable';
                      }
                    });
                  
                  if (duplicateIds.length > 0) {
                    console.log(`Skipped ${duplicateIds.length} duplicate records`);
                  }
                } else {
                  companiesFailed += currentBatch.length;
                  console.error(`Error inserting batch: ${error.message}`);
                }
                
                // Clear the batch
                currentBatch = [];
                
                // Resume line reading
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
              await Company.insertMany(currentBatch, { ordered: false });
              companiesImported += currentBatch.length;
            } catch (error) {
              if (error.writeErrors) {
                companiesFailed += error.writeErrors.length;
                companiesImported += (currentBatch.length - error.writeErrors.length);
              } else {
                companiesFailed += currentBatch.length;
                console.error(`Error inserting final batch: ${error.message}`);
              }
            }
          }
          
          const finalCount = await Company.countDocuments();
          console.log(`
Import completed: 
- ${companiesProcessed} companies processed
- ${companiesImported} companies imported successfully
- ${companiesSkipped} companies skipped (duplicates)
- ${companiesFailed} companies failed to import
- ${finalCount} total companies in database
          `);
          
          resolve({ 
            success: true, 
            message: `Imported ${companiesImported} companies (${finalCount} total in database)` 
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