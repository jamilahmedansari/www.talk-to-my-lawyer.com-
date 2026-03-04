import 'dotenv/config';

console.log('OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY);
console.log('PERPLEXITY_API_KEY set:', !!process.env.PERPLEXITY_API_KEY);
console.log('SUPABASE_URL set:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('STRIPE_SECRET_KEY set:', !!process.env.STRIPE_SECRET_KEY);
console.log('RESEND_API_KEY set:', !!process.env.RESEND_API_KEY);
