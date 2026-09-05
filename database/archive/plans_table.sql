-- Create plans table for subscription pricing
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subtitle TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    original_price DECIMAL(10,2),
    duration TEXT NOT NULL DEFAULT 'month',
    currency TEXT NOT NULL DEFAULT '$',
    features JSONB NOT NULL DEFAULT '[]',
    popular BOOLEAN DEFAULT FALSE,
    color TEXT DEFAULT 'rgba(250, 181, 0, 0.2)',
    button_text TEXT DEFAULT 'Subscribe Now',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insert default plans
INSERT INTO public.plans (id, name, subtitle, price, duration, features, popular, color, button_text) VALUES
(
    'free',
    'Free Plan',
    'Trial',
    0,
    '7 days free trial',
    '[
        {"text": "Read 3 PDF books", "icon": "book-open", "included": true},
        {"text": "Listen to 2 short audiobooks", "icon": "headphones", "included": true},
        {"text": "Offline reading not allowed", "icon": "wifi-off", "included": false},
        {"text": "Download not allowed", "icon": "download-off", "included": false}
    ]'::jsonb,
    false,
    'rgba(250, 181, 0, 0.2)',
    'Start Free Trial'
),
(
    'basic',
    'Basic Plan',
    'Most Popular',
    3.00,
    'month',
    '[
        {"text": "Access up to 20 readable PDF books", "icon": "book-multiple", "included": true},
        {"text": "Listen to 10 audiobooks per month", "icon": "headphones", "included": true},
        {"text": "Offline reading & listening", "icon": "wifi-off", "included": true},
        {"text": "Somali + English interface", "icon": "translate", "included": true}
    ]'::jsonb,
    true,
    'rgba(250, 181, 0, 0.3)',
    'Subscribe Now'
),
(
    'premium',
    'Premium Plan',
    'Best Value',
    6.00,
    'month',
    '[
        {"text": "Unlimited access to all books", "icon": "infinity", "included": true},
        {"text": "High-quality audiobooks", "icon": "high-definition-box", "included": true},
        {"text": "Background play supported", "icon": "play-circle", "included": true},
        {"text": "Download books for offline", "icon": "download", "included": true}
    ]'::jsonb,
    false,
    'rgba(250, 181, 0, 0.4)',
    'Subscribe Now'
),
(
    'yearly',
    'Yearly Plan',
    'Save 30%',
    50.00,
    'year',
    '[
        {"text": "One-time annual subscription", "icon": "calendar-check", "included": true},
        {"text": "Includes all Premium features", "icon": "star-circle", "included": true},
        {"text": "Bonus: 3 exclusive books per year", "icon": "gift", "included": true},
        {"text": "Priority customer support", "icon": "account-supervisor", "included": true}
    ]'::jsonb,
    false,
    'rgba(250, 181, 0, 0.5)',
    'Subscribe Now'
);

-- Set original price for yearly plan to show savings
UPDATE public.plans SET original_price = 72.00 WHERE id = 'yearly';

-- Enable Row Level Security (RLS)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to plans" ON public.plans
    FOR SELECT USING (active = true);

-- Create policy to allow admin users to manage plans
CREATE POLICY "Allow admin to manage plans" ON public.plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_plans_updated_at BEFORE UPDATE ON public.plans
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
