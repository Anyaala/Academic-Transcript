# Deployment Guide for Verifiable Academic Vault

## 🚀 Option 1: Vercel (Recommended)

### Steps:
1. **Push to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your repository
   - Vercel will auto-detect it's a Vite app
   - Click "Deploy"

3. **Set Environment Variables** (in Vercel dashboard)
   ```
   VITE_SUPABASE_URL=https://nohrizhxwrsinsyyojju.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### ✅ **Benefits**: 
- Automatic builds on git push
- Free tier available
- Great performance
- Easy custom domain setup

---

## 🌐 Option 2: Netlify

### Steps:
1. **Build the project locally**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop the `dist` folder
   - Or connect to GitHub for automatic deployments

3. **Set Environment Variables** (in Netlify dashboard)
   - Go to Site settings → Environment variables
   - Add the same variables as above

---

## 📱 Option 3: GitHub Pages

### Steps:
1. **Install gh-pages**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update package.json**
   ```json
   {
     "homepage": "https://yourusername.github.io/verifiable-academic-vault-main",
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

---

## ⚡ Option 4: Railway

### Steps:
1. **Connect to Railway**
   - Go to [railway.app](https://railway.app)
   - Connect GitHub repository
   - Railway auto-detects Vite configuration

2. **Add Environment Variables**
   - Set the same Supabase variables

---

## 🔧 Pre-Deployment Checklist

### ✅ **Required Environment Variables**
```env
VITE_SUPABASE_URL=https://nohrizhxwrsinsyyojju.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### ✅ **Supabase Configuration**
- Edge functions are deployed: ✅
- Database tables are set up: ✅
- RLS policies are configured: ✅
- Storage buckets are created: ✅

### ✅ **Build Test**
Run this locally to ensure everything builds correctly:
```bash
npm run build
npm run preview
```

### ✅ **Domain Setup** (Optional)
Most platforms allow custom domain setup in their dashboard settings.

---

## 🎯 **Recommended Workflow**

1. **Start with Vercel** (easiest and most reliable)
2. **Test the deployment** with a few transcript verifications
3. **Set up custom domain** if needed
4. **Monitor performance** and scaling needs

## 🔒 **Security Notes**

- All sensitive keys are already in Supabase (service keys, etc.)
- Only public keys are in the frontend environment variables
- HTTPS is automatically enabled on all recommended platforms
- Content Security Policy headers are configured

## 📞 **Need Help?**

If you encounter issues:
1. Check the build logs on your chosen platform
2. Verify all environment variables are set correctly
3. Test the build locally first with `npm run build && npm run preview`
