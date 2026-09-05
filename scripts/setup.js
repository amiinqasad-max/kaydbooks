#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Book Reader App Setup');
console.log('========================\n');

const questions = [
  {
    key: 'EXPO_PUBLIC_SUPABASE_URL',
    question: 'Enter your Supabase Project URL: ',
    validate: (value) => value.includes('supabase.co') || 'Please enter a valid Supabase URL'
  },
  {
    key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    question: 'Enter your Supabase Anon Key: ',
    validate: (value) => value.length > 50 || 'Please enter a valid Supabase anon key'
  }
];

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question.question, (answer) => {
      const validation = question.validate(answer);
      if (validation === true || typeof validation === 'undefined') {
        resolve(answer);
      } else {
        console.log(`❌ ${validation}`);
        resolve(askQuestion(question));
      }
    });
  });
}

async function setup() {
  const envVars = {};

  for (const question of questions) {
    const answer = await askQuestion(question);
    envVars[question.key] = answer;
  }

  // Create .env file
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync('.env', envContent);

  // Update supabase.js file
  const supabaseFile = path.join('services', 'supabase.js');
  let supabaseContent = fs.readFileSync(supabaseFile, 'utf8');
  
  supabaseContent = supabaseContent
    .replace('YOUR_SUPABASE_URL', envVars.EXPO_PUBLIC_SUPABASE_URL)
    .replace('YOUR_SUPABASE_ANON_KEY', envVars.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  fs.writeFileSync(supabaseFile, supabaseContent);

  console.log('\n✅ Setup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Set up your Supabase database schema (see README.md)');
  console.log('2. Configure Supabase Storage (see README.md)');
  console.log('3. Run: npm start');
  
  rl.close();
}

setup().catch(console.error);
