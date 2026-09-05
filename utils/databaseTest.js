/**
 * Simple database test to check what fields are actually available
 */

import { supabase } from '../services/supabase';

export const testDatabaseSchema = async () => {
  try {
    console.log('Testing database schema...');
    
    // Test 1: Check if books table exists and what columns it has
    const { data: books, error: booksError } = await supabase
      .from('books')
      .select('*')
      .limit(1);
    
    if (booksError) {
      console.error('Books table error:', booksError);
      return { success: false, error: booksError.message };
    }
    
    if (books && books.length > 0) {
      console.log('Available book columns:', Object.keys(books[0]));
      console.log('Sample book data:', books[0]);
    } else {
      console.log('No books found in database');
    }
    
    // Test 2: Check storage buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Storage buckets error:', bucketsError);
    } else {
      console.log('Available storage buckets:', buckets.map(b => b.name));
    }
    
    // Test 3: Try to create a simple book entry (only with existing columns)
    const testBook = {
      title: 'Test Book',
      author: 'Test Author',
      description: 'Test Description',
      category: 'Test Category',
      cover_url: 'https://example.com/cover.jpg',
      pdf_url: 'https://example.com/book.pdf',
      audio_url: null,
      isbn: null,
      publication_year: null,
      page_count: null,
      created_at: new Date().toISOString(),
    };
    
    const { data: createResult, error: createError } = await supabase
      .from('books')
      .insert([testBook])
      .select();
    
    if (createError) {
      console.error('Create test book error:', createError);
      return { 
        success: false, 
        error: createError.message,
        availableColumns: books && books.length > 0 ? Object.keys(books[0]) : [],
        buckets: buckets ? buckets.map(b => b.name) : []
      };
    } else {
      console.log('Test book created successfully:', createResult);
      
      // Clean up - delete the test book
      if (createResult && createResult.length > 0) {
        await supabase
          .from('books')
          .delete()
          .eq('id', createResult[0].id);
      }
    }
    
    return { 
      success: true, 
      availableColumns: books && books.length > 0 ? Object.keys(books[0]) : [],
      buckets: buckets ? buckets.map(b => b.name) : [],
      sampleData: books && books.length > 0 ? books[0] : null
    };
    
  } catch (error) {
    console.error('Database test failed:', error);
    return { success: false, error: error.message };
  }
};

export default testDatabaseSchema;
