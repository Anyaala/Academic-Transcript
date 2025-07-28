#!/bin/bash

# Deploy Blockchain Edge Functions Script
echo "🚀 Deploying Blockchain Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npm/npx is not installed"
    exit 1
fi

# Deploy test function first
echo "📡 Deploying test-blockchain-connection..."
npx supabase functions deploy test-blockchain-connection
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy test-blockchain-connection"
    exit 1
fi
echo "✅ test-blockchain-connection deployed"

# Deploy blockchain-auth function
echo "🔐 Deploying blockchain-auth..."
npx supabase functions deploy blockchain-auth
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy blockchain-auth"
    exit 1
fi
echo "✅ blockchain-auth deployed"

# Deploy blockchain-verify function
echo "🔍 Deploying blockchain-verify..."
npx supabase functions deploy blockchain-verify
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy blockchain-verify"
    exit 1
fi
echo "✅ blockchain-verify deployed"

# Deploy blockchain-audit function
echo "📋 Deploying blockchain-audit..."
npx supabase functions deploy blockchain-audit
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy blockchain-audit"
    exit 1
fi
echo "✅ blockchain-audit deployed"

echo ""
echo "🎉 All blockchain functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Set environment variables in Supabase Dashboard"
echo "2. Test the functions using the URLs below:"
echo ""
echo "📡 Test Connection:"
echo "curl -X POST https://your-project.supabase.co/functions/v1/test-blockchain-connection"
echo ""
echo "🔐 Test Auth (requires auth):"
echo "curl -X POST https://your-project.supabase.co/functions/v1/blockchain-auth \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"action\": \"status_check\"}'"
echo ""
echo "Replace 'your-project' with your actual Supabase project reference."
