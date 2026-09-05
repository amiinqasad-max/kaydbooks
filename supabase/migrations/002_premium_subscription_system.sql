-- Enhanced subscription system for Kayd Books
-- Supports custom 7-day trial + production Apple/Google subscriptions

-- Add new subscription fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trial_started BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS premium_access BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'trial', 'active', 'expired', 'expired_trial', 'cancelled')),
ADD COLUMN IF NOT EXISTS subscription_type TEXT CHECK (subscription_type IN ('monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Create purchase_transactions table for audit trail
CREATE TABLE IF NOT EXISTS purchase_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  purchase_time TIMESTAMP WITH TIME ZONE,
  verified BOOLEAN DEFAULT FALSE,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscription_history table for tracking changes
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('trial_started', 'trial_expired', 'subscription_purchased', 'subscription_renewed', 'subscription_cancelled', 'subscription_expired')),
  subscription_type TEXT,
  product_id TEXT,
  transaction_id TEXT,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create premium_features table for feature access control
CREATE TABLE IF NOT EXISTS premium_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_name TEXT UNIQUE NOT NULL,
  feature_description TEXT,
  requires_trial BOOLEAN DEFAULT TRUE,
  requires_subscription BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default premium features
INSERT INTO premium_features (feature_name, feature_description, requires_trial, requires_subscription) VALUES
('unlimited_books', 'Access to all books in the library', true, true),
('offline_reading', 'Download books for offline reading', true, true),
('premium_audiobooks', 'Access to premium audiobook collection', true, true),
('no_advertisements', 'Ad-free reading experience', true, true),
('advanced_search', 'Advanced search and filtering options', true, true),
('priority_support', 'Priority customer support', false, true),
('early_access', 'Early access to new book releases', false, true)
ON CONFLICT (feature_name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_trial_started ON users(trial_started);
CREATE INDEX IF NOT EXISTS idx_users_trial_end_date ON users(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_users_premium_access ON users(premium_access);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_end_date ON users(subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_user_id ON purchase_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_transaction_id ON purchase_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_action ON subscription_history(action);

-- Enable RLS (Row Level Security)
ALTER TABLE purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE premium_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_transactions
CREATE POLICY "Users can view their own purchase transactions" ON purchase_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage purchase transactions" ON purchase_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for subscription_history
CREATE POLICY "Users can view their own subscription history" ON subscription_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscription history" ON subscription_history
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for premium_features
CREATE POLICY "Anyone can view premium features" ON premium_features
  FOR SELECT USING (true);

CREATE POLICY "Only service role can manage premium features" ON premium_features
  FOR ALL USING (auth.role() = 'service_role');

-- Function to check if user has premium access
CREATE OR REPLACE FUNCTION check_premium_access(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
  has_access BOOLEAN := FALSE;
BEGIN
  -- Get user subscription info
  SELECT 
    trial_started,
    trial_end_date,
    premium_access,
    subscription_status,
    subscription_end_date
  INTO user_record
  FROM users 
  WHERE id = user_id;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check trial access
  IF user_record.trial_started AND user_record.trial_end_date > NOW() AND user_record.subscription_status = 'trial' THEN
    has_access := TRUE;
  END IF;
  
  -- Check subscription access
  IF user_record.premium_access AND user_record.subscription_status = 'active' AND user_record.subscription_end_date > NOW() THEN
    has_access := TRUE;
  END IF;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log subscription events
CREATE OR REPLACE FUNCTION log_subscription_event(
  user_id UUID,
  action TEXT,
  subscription_type TEXT DEFAULT NULL,
  product_id TEXT DEFAULT NULL,
  transaction_id TEXT DEFAULT NULL,
  previous_status TEXT DEFAULT NULL,
  new_status TEXT DEFAULT NULL,
  metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  history_id UUID;
BEGIN
  INSERT INTO subscription_history (
    user_id,
    action,
    subscription_type,
    product_id,
    transaction_id,
    previous_status,
    new_status,
    metadata
  ) VALUES (
    user_id,
    action,
    subscription_type,
    product_id,
    transaction_id,
    previous_status,
    new_status,
    metadata
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start trial
CREATE OR REPLACE FUNCTION start_user_trial(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  trial_end_date TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  -- Calculate trial end date (7 days from now)
  trial_end_date := NOW() + INTERVAL '7 days';
  
  -- Update user record
  UPDATE users SET
    trial_started = TRUE,
    trial_start_date = NOW(),
    trial_end_date = trial_end_date,
    premium_access = TRUE,
    subscription_status = 'trial',
    updated_at = NOW()
  WHERE id = user_id;
  
  -- Log the event
  PERFORM log_subscription_event(
    user_id,
    'trial_started',
    NULL,
    NULL,
    NULL,
    'free',
    'trial',
    jsonb_build_object('trial_end_date', trial_end_date)
  );
  
  -- Return result
  result := jsonb_build_object(
    'success', TRUE,
    'trial_end_date', trial_end_date,
    'days_remaining', 7
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire trial
CREATE OR REPLACE FUNCTION expire_user_trial(user_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Update user record
  UPDATE users SET
    premium_access = FALSE,
    subscription_status = 'expired_trial',
    updated_at = NOW()
  WHERE id = user_id AND subscription_status = 'trial';
  
  -- Log the event
  PERFORM log_subscription_event(
    user_id,
    'trial_expired',
    NULL,
    NULL,
    NULL,
    'trial',
    'expired_trial',
    jsonb_build_object('expired_at', NOW())
  );
  
  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT ON purchase_transactions TO authenticated;
GRANT SELECT, INSERT ON subscription_history TO authenticated;
GRANT SELECT ON premium_features TO authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION check_premium_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_subscription_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION start_user_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_user_trial(UUID) TO authenticated;
