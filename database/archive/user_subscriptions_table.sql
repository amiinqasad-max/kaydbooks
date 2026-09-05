-- Create user_subscriptions table for managing user subscription data
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    transaction_id TEXT,
    receipt_data TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON public.user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON public.user_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON public.user_subscriptions(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own subscriptions
CREATE POLICY "Users can read own subscriptions" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow admin users to manage all subscriptions
CREATE POLICY "Admin can manage all subscriptions" ON public.user_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create policy to allow system to insert subscriptions (for in-app purchases)
CREATE POLICY "System can insert subscriptions" ON public.user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own subscription status (for cancellation)
CREATE POLICY "Users can update own subscription status" ON public.user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER handle_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create function to automatically expire subscriptions
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS void AS $$
BEGIN
    UPDATE public.user_subscriptions 
    SET status = 'expired', active = false, updated_at = NOW()
    WHERE expires_at < NOW() 
    AND status = 'active' 
    AND active = true;
END;
$$ LANGUAGE plpgsql;

-- Create function to check subscription limits
CREATE OR REPLACE FUNCTION public.check_user_limits(user_uuid UUID, limit_type TEXT)
RETURNS INTEGER AS $$
DECLARE
    user_plan_id TEXT;
    limit_value INTEGER := 0;
BEGIN
    -- Get user's current active plan
    SELECT plan_id INTO user_plan_id
    FROM public.user_subscriptions
    WHERE user_id = user_uuid 
    AND active = true 
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no active subscription, return free plan limits
    IF user_plan_id IS NULL THEN
        user_plan_id := 'free';
    END IF;
    
    -- Return limits based on plan and limit type
    CASE user_plan_id
        WHEN 'free' THEN
            CASE limit_type
                WHEN 'pdf_books' THEN limit_value := 3;
                WHEN 'audiobooks' THEN limit_value := 2;
                ELSE limit_value := 0;
            END CASE;
        WHEN 'basic' THEN
            CASE limit_type
                WHEN 'pdf_books' THEN limit_value := 20;
                WHEN 'audiobooks' THEN limit_value := 10;
                ELSE limit_value := 0;
            END CASE;
        WHEN 'premium', 'yearly' THEN
            limit_value := -1; -- -1 means unlimited
        ELSE
            limit_value := 0;
    END CASE;
    
    RETURN limit_value;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing (optional)
-- Uncomment the following lines if you want sample subscription data

/*
-- Sample subscription for testing (replace with actual user ID)
INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at) VALUES
(
    '00000000-0000-0000-0000-000000000000', -- Replace with actual user ID
    'basic',
    'active',
    (NOW() + INTERVAL '1 month')
);
*/
