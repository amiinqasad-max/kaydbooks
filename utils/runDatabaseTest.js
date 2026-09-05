/**
 * Run Database Test - Safe way to test database schema
 * 
 * This file can be run to test your database connection and schema
 * without causing SQL syntax errors.
 */

import { testDatabaseSchema } from './databaseTest.js';

// Function to run the database test
export const runTest = async () => {
  console.log('🔍 Starting database schema test...');
  
  try {
    const result = await testDatabaseSchema();
    
    if (result.success) {
      console.log('✅ Database test completed successfully!');
      console.log('📋 Available columns:', result.availableColumns);
      console.log('🪣 Storage buckets:', result.buckets);
      
      if (result.sampleData) {
        console.log('📄 Sample book data structure:', result.sampleData);
      }
    } else {
      console.error('❌ Database test failed:', result.error);
      
      if (result.availableColumns) {
        console.log('📋 Available columns found:', result.availableColumns);
      }
      
      if (result.buckets) {
        console.log('🪣 Storage buckets found:', result.buckets);
      }
    }
    
    return result;
  } catch (error) {
    console.error('💥 Test runner error:', error);
    return { success: false, error: error.message };
  }
};

// Auto-run if this file is executed directly
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  runTest();
}

export default runTest;
