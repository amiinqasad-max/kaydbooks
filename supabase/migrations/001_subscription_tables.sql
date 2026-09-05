-- Add subscription fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP WITH TIME ZONE;

-- Create local_payments table for local payment verification
CREATE TABLE IF NOT EXISTS local_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  transaction_code TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_transactions table for tracking all purchases
CREATE TABLE IF NOT EXISTS purchase_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'local')),
  transaction_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('trial', 'monthly', 'yearly')),
  amount DECIMAL(10,2) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_premium ON users(premium);
CREATE INDEX IF NOT EXISTS idx_users_subscription_end ON users(subscription_end);
CREATE INDEX IF NOT EXISTS idx_local_payments_transaction_code ON local_payments(transaction_code);
CREATE INDEX IF NOT EXISTS idx_local_payments_verified ON local_payments(verified);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_user_id ON purchase_transactions(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE local_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for local_payments
CREATE POLICY "Users can view their own local payments" ON local_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own local payments" ON local_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for purchase_transactions  
CREATE POLICY "Users can view their own transactions" ON purchase_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT ON local_payments TO authenticated;
GRANT SELECT ON purchase_transactions TO authenticated;
